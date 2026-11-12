/* ================================================================
   retry-policy.js — small helpers shared by the Ollama client and
   any future network layer: exponential backoff + abort controller
   with a timeout.
   ================================================================ */

/**
 * Exponential backoff delay. Attempt is 1-indexed.
 *
 *   attempt=1 → 300ms
 *   attempt=2 → 600ms
 *   attempt=3 → 1200ms
 *   attempt=4 → 2400ms  (capped at max)
 *
 * @param {number} attempt
 * @param {number} [base=300]
 * @param {number} [max=3000]
 * @returns {number} milliseconds
 */
export function backoffDelay(attempt, base = 300, max = 3000) {
  return Math.min(base * Math.pow(2, Math.max(0, attempt - 1)), max);
}

/**
 * Create an AbortController that auto-aborts after `timeoutMs`.
 * Returns both the controller and a `clear()` to cancel the timer
 * if the request finishes early.
 *
 * @param {number} timeoutMs
 * @returns {{ controller: AbortController, clear: () => void, didTimeout: () => boolean }}
 */
export function createAbortController(timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    controller,
    clear: () => clearTimeout(timer),
    didTimeout: () => timedOut,
  };
}

/**
 * Sleep helper for manual backoff between retries.
 * @param {number} ms
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}