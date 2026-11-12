/* ================================================================
   speech-bubbles.js — CSS2D anchored chat bubbles above each avatar.
   ================================================================ */

const HIDE_DELAY_MS = 6500;

/**
 * @param {THREE.Scene} scene
 * @returns {{
 *   show: (side:'white'|'black', text:string, emotion?:string) => void,
 *   hide: (side:'white'|'black') => void,
 *   setAnchor: (side:'white'|'black', worldPos: THREE.Vector3) => void,
 * }}
 */
export function createSpeechBubbles(scene) {
  const entries = new Map();

  function ensure(side) {
    if (entries.has(side)) return entries.get(side);

    const div = document.createElement('div');
    div.className = 'speech-bubble' + (side === 'black' ? ' black-bubble' : '');

    const obj = new THREE.CSS2DObject(div);
    obj.position.set(0, 2.2, side === 'white' ? -5.5 : 5.5);
    scene.add(obj);

    const entry = { div, obj, timer: null };
    entries.set(side, entry);
    return entry;
  }

  function show(side, text, emotion = 'confident') {
    const entry = ensure(side);

    entry.div.textContent = text;
    entry.div.dataset.emotion = emotion;
    entry.div.classList.add('visible');

    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = setTimeout(() => {
      entry.div.classList.remove('visible');
      entry.timer = null;
    }, HIDE_DELAY_MS);
  }

  function hide(side) {
    const entry = entries.get(side);
    if (!entry) return;
    if (entry.timer) clearTimeout(entry.timer);
    entry.timer = null;
    entry.div.classList.remove('visible');
  }

  function setAnchor(side, worldPos) {
    const entry = ensure(side);
    entry.obj.position.copy(worldPos);
  }

  function clear() {
    for (const side of entries.keys()) hide(side);
  }

  return { show, hide, setAnchor, clear };
}