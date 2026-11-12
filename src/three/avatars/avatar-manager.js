/* ================================================================
   avatar-manager.js — owns both avatar seats, swaps between
   procedural and GLB, ticks mixers each frame, and reports bubble
   anchor positions.
   ================================================================ */

import { CONFIG } from '../../config.js';
import { createProceduralAvatar } from './procedural-avatar.js';
import { loadGLBAvatar } from './glb-loader.js';

/**
 * @param {THREE.Scene} scene
 * @returns {{
 *   setEmotion: (side:'white'|'black', emotion:string) => void,
 *   setGLB: (side:'white'|'black', file: File) => Promise<void>,
 *   resetToProcedural: (side:'white'|'black') => void,
 *   update: (dt: number) => void,
 *   getBubbleAnchor: (side:'white'|'black') => THREE.Vector3,
 *   getAvatar: (side:'white'|'black') => object,
 * }}
 */
export function createAvatarManager(scene) {
  /** @type {{ white: object, black: object }} */
  const avatars = {
    white: null,
    black: null,
  };

  const seats = {
    white: new THREE.Vector3(...CONFIG.avatarSeats.white),
    black: new THREE.Vector3(...CONFIG.avatarSeats.black),
  };

  /* --- Seat containers so we can swap children without losing world position --- */
  const containers = {
    white: new THREE.Group(),
    black: new THREE.Group(),
  };
  containers.white.position.copy(seats.white);
  containers.black.position.copy(seats.black);
  scene.add(containers.white, containers.black);

  /* ---------- Helpers ---------- */
  function attach(side, avatarHandle) {
    const container = containers[side];

    /* Detach previous avatar */
    if (avatars[side]) {
      container.remove(avatars[side].group);
      avatars[side].dispose?.();
    }

    /* Detach everything else (belt and braces) */
    while (container.children.length) {
      container.remove(container.children[0]);
    }

    container.add(avatarHandle.group);
    avatars[side] = avatarHandle;
  }

  function resetToProcedural(side) {
    attach(side, createProceduralAvatar(side));
  }

  /* ---------- Initial avatars ---------- */
  resetToProcedural('white');
  resetToProcedural('black');

  /* ---------- Public API ---------- */
  function setEmotion(side, emotion) {
    avatars[side]?.setEmotion(emotion);
  }

  async function setGLB(side, file) {
    const handle = await loadGLBAvatar(file, side);
    attach(side, handle);
  }

  function update(dt) {
    avatars.white?.update(dt);
    avatars.black?.update(dt);
  }

  function getBubbleAnchor(side) {
    if (!avatars[side]) {
      return new THREE.Vector3(0, 2, seats[side].z);
    }
    const local = avatars[side].getBubbleAnchor();
    return new THREE.Vector3(
      local.x + containers[side].position.x,
      local.y + containers[side].position.y,
      local.z + containers[side].position.z
    );
  }

  function getAvatar(side) {
    return avatars[side];
  }

  return {
    setEmotion,
    setGLB,
    resetToProcedural,
    update,
    getBubbleAnchor,
    getAvatar,
  };
}