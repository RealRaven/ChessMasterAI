/* ================================================================
   ollama-client.js — the ONLY module that talks to Ollama over the
   network. Wraps /api/chat, enforces format:'json', and delegates
   to response-parser for extraction.
   ================================================================ */

import { CONFIG } from '../config.js';
import { parseResponse } from './response-parser.js';
import { createAbortController } from './retry-policy.js';

/**
 * Send a chat request to Ollama and return the parsed JSON object.
 *
 * @param {object} opts
 * @param {string} opts.model                    — e.g. 'qwen3.5:9b'
 * @param {Array<object>} opts.messages          — from prompt-builder
 * @param {string} [opts.endpoint=CONFIG.ollamaEndpoint]
 * @param {number} [opts.timeoutMs=120000]
 * @param {number} [opts.temperature=0.8]
 * @returns {Promise<{move:string, speech:string, emotion:string}>}
 * @throws if the HTTP call fails or the response cannot be parsed
 */
export async function chat({
  model,
  messages,
  endpoint = CONFIG.ollamaEndpoint,
  timeoutMs = 120000,
  temperature = 0.8,
}) {
  if (!model) throw new Error('ollama-client: model is required');
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error('ollama-client: messages array is required');
  }

  const { controller, clear, didTimeout } = createAbortController(timeoutMs);

  let response;
  try {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        format: 'json',
        options: {
          temperature,
          top_p: 0.9,
        },
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (didTimeout()) {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms`);
    }
    // Most commonly: CORS not configured, or Ollama not running.
    throw new Error(
      `Ollama request failed: ${err.message}. ` +
        `Is Ollama running on ${endpoint}? ` +
        `Did you set OLLAMA_ORIGINS? (see README)`
    );
  } finally {
    clear();
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(
      `Ollama HTTP ${response.status}: ${body.slice(0, 300) || '(no body)'}`
    );
  }

  const data = await response.json();
  const content = data?.message?.content;

  if (!content) {
    throw new Error('Ollama returned an empty message.content');
  }

  const parsed = parseResponse(content);
  if (!parsed) {
    throw new Error(
      `Ollama response was not parseable as JSON: ${content.slice(0, 200)}`
    );
  }

  return parsed;
}

/**
 * Quick liveness probe — GET /api/tags on the same host.
 * Returns true if Ollama is reachable, false otherwise.
 *
 * @param {string} [endpoint=CONFIG.ollamaEndpoint]
 * @returns {Promise<boolean>}
 */
export async function isAvailable(endpoint = CONFIG.ollamaEndpoint) {
  try {
    const base = endpoint.replace(/\/api\/.*$/, '');
    const r = await fetch(`${base}/api/tags`, { method: 'GET' });
    return r.ok;
  } catch {
    return false;
  }
}

/**
 * List locally-pulled model tags. Useful for a "which models do I
 * have?" hint in the HUD. Returns [] if Ollama isn't reachable.
 *
 * @param {string} [endpoint=CONFIG.ollamaEndpoint]
 * @returns {Promise<Array<{name:string, size:number}>>}
 */
export async function listModels(endpoint = CONFIG.ollamaEndpoint) {
  try {
    const base = endpoint.replace(/\/api\/.*$/, '');
    const r = await fetch(`${base}/api/tags`, { method: 'GET' });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data?.models) ? data.models : [];
  } catch {
    return [];
  }
}