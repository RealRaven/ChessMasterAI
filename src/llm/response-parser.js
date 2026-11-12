/* ================================================================
   response-parser.js — safely extract a JSON object from an LLM
   message. Models frequently wrap JSON in markdown fences, prefix
   it with commentary, or add trailing text. This tries four layers
   of extraction before giving up.
   ================================================================ */

/**
 * Attempt to parse an LLM response string into a JSON object.
 * Returns `null` if nothing parseable is found.
 *
 * @param {string} content
 * @returns {object|null}
 */
export function parseResponse(content) {
  if (!content || typeof content !== 'string') return null;

  const trimmed = content.trim();

  /* 1. Direct parse (the happy path: format:'json' worked) */
  const direct = tryParse(trimmed);
  if (direct) return direct;

  /* 2. Strip ```json ... ``` or ``` ... ``` fences */
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    const inner = tryParse(fenced[1].trim());
    if (inner) return inner;
  }

  /* 3. First balanced { ... } block (naive but robust enough) */
  const braceMatch = extractFirstBalancedObject(trimmed);
  if (braceMatch) {
    const inner = tryParse(braceMatch);
    if (inner) return inner;
  }

  /* 4. Last resort — find any {...} substring */
  const loose = trimmed.match(/\{[\s\S]*\}/);
  if (loose) {
    const inner = tryParse(loose[0]);
    if (inner) return inner;
  }

  return null;
}

/* ------------------------------------------------------------------ */

function tryParse(str) {
  try {
    const parsed = JSON.parse(str);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/**
 * Walk the string and return the first `{...}` substring whose
 * braces balance. Handles strings containing braces correctly by
 * tracking quote state.
 */
function extractFirstBalancedObject(str) {
  const open = str.indexOf('{');
  if (open === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = open; i < str.length; i++) {
    const ch = str[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return str.slice(open, i + 1);
    }
  }

  return null;
}