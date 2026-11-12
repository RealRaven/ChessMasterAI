/* ================================================================
   pgn-export.js — download the current game as a .pgn file.
   This is a user-initiated download of game *history* (text),
   not the vision snapshot — safe to save to disk.
   ================================================================ */

import { getPgn } from '../core/chess-engine.js';
import { qs } from '../utils/dom.js';

export function mountPgnExport() {
  const btn = qs('#btn-export-pgn');

  btn.addEventListener('click', () => {
    const pgn = getPgn();
    if (!pgn || pgn.trim() === '') {
      window.alert('No moves to export yet.');
      return;
    }

    const blob = new Blob([pgn], { type: 'application/x-chess-pgn' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `chessmasterai-${Date.now()}.pgn`;
    document.body.appendChild(a);
    a.click();
    a.remove();

    /* Clean up the object URL on the next tick */
    setTimeout(() => URL.revokeObjectURL(url), 0);
  });
}