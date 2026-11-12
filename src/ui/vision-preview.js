/* ================================================================
   vision-preview.js — HUD thumbnail of the exact PNG sent to Ollama.

   PRIVACY: this module only ever receives an in-memory data URL
   (base64). It never persists the image to localStorage,
   IndexedDB, the Cache API, a service worker, or disk. When the
   page reloads, the image is gone.
   ================================================================ */

import { events } from '../core/events.js';
import { qs } from '../utils/dom.js';

/**
 * @returns {{ setSnapshot: (snap: {dataURL:string, timestamp?:number}) => void }}
 */
export function mountVisionPreview() {
  const img    = qs('#vision-preview');
  const status = qs('#vision-status');

  let lastShown = 0;

  function setSnapshot({ dataURL, timestamp }) {
    if (!dataURL) return;
    img.src = dataURL;
    img.style.display = 'block';

    const ts = timestamp || Date.now();
    lastShown = ts;
    const d = new Date(ts);
    status.textContent = `Snapshot ${d.toLocaleTimeString()}`;
  }

  /* main.js emits this after vision-capture returns for each turn */
  events.on('vision:snapshot', setSnapshot);

  return { setSnapshot };
}