/* ================================================================
   dom.js — tiny DOM helper shorthands so UI modules stay terse.
   ================================================================ */

/** querySelector shorthand */
export const qs = (selector, root = document) => root.querySelector(selector);

/** querySelectorAll → real array */
export const qsa = (selector, root = document) =>
  Array.from(root.querySelectorAll(selector));

/**
 * Create an element with attributes and children.
 * @param {string} tag
 * @param {object} [attrs] — supports class, style, textContent, innerHTML,
 *                           and any other DOM property via `setAttribute`.
 * @param {(Node|string)[]} [children]
 * @returns {HTMLElement}
 */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class')       node.className = value;
    else if (key === 'style' && typeof value === 'object')
      Object.assign(node.style, value);
    else if (key === 'textContent')  node.textContent = value;
    else if (key === 'innerHTML')    node.innerHTML = value;
    else if (key === 'dataset')
      Object.assign(node.dataset, value);
    else
      node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    node.appendChild(
      typeof child === 'string' ? document.createTextNode(child) : child
    );
  }
  return node;
}

/**
 * Attach an event listener, returning the detach function.
 */
export function on(target, event, handler, options) {
  target.addEventListener(event, handler, options);
  return () => target.removeEventListener(event, handler, options);
}

/**
 * Escape HTML-special characters so we can safely interpolate
 * untrusted strings (LLM banter, model names) into innerHTML.
 */
export function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}