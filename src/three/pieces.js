/* ================================================================
   pieces.js — procedural piece geometries and a layer that keeps
   a Map<square, THREE.Group> synchronized with the chess.js board.
   ================================================================ */

import { CONFIG } from '../config.js';
import { squareToWorld } from '../utils/coords.js';

const PIECE_Y = CONFIG.board.pieceLiftY;

/* Shared materials per colour — created lazily, reused by all pieces. */
const MATERIALS = new Map();

function bodyMaterial(color) {
  const key = `body-${color}`;
  if (MATERIALS.has(key)) return MATERIALS.get(key);

  const mat = new THREE.MeshStandardMaterial({
    color: color === 'w' ? 0xe8e2d5 : 0x222026,
    roughness: 0.5,
    metalness: 0.35,
  });
  MATERIALS.set(key, mat);
  return mat;
}

function accentMaterial(color) {
  const key = `accent-${color}`;
  if (MATERIALS.has(key)) return MATERIALS.get(key);

  const accent = color === 'w' ? 0x00e5ff : 0xff4dc4;
  const mat = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: new THREE.Color(accent).multiplyScalar(0.25),
    roughness: 0.25,
    metalness: 0.9,
  });
  MATERIALS.set(key, mat);
  return mat;
}

/* ------------------------------------------------------------------
   Geometry per piece type — all centred so the base sits at y = 0.
   ------------------------------------------------------------------ */

function makeBase(color) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.32, 0.10, 20),
    bodyMaterial(color)
  );
  m.position.y = 0.05;
  m.castShadow = true;
  return m;
}

function makePawn(color) {
  const g = new THREE.Group();
  g.add(makeBase(color));

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.20, 0.34, 16),
    bodyMaterial(color)
  );
  body.position.y = 0.27;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 16, 16),
    bodyMaterial(color)
  );
  head.position.y = 0.50;
  head.castShadow = true;
  g.add(head);

  return g;
}

function makeRook(color) {
  const g = new THREE.Group();
  g.add(makeBase(color));

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.24, 0.45, 12),
    bodyMaterial(color)
  );
  body.position.y = 0.32;
  body.castShadow = true;
  g.add(body);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.24, 0.10, 12),
    bodyMaterial(color)
  );
  crown.position.y = 0.60;
  crown.castShadow = true;
  g.add(crown);

  /* Battlements */
  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2;
    const merlon = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.14, 0.10),
      accentMaterial(color)
    );
    merlon.position.set(
      Math.cos(angle) * 0.16,
      0.72,
      Math.sin(angle) * 0.16
    );
    merlon.castShadow = true;
    g.add(merlon);
  }
  return g;
}

function makeKnight(color) {
  const g = new THREE.Group();
  g.add(makeBase(color));

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.23, 0.28, 12),
    bodyMaterial(color)
  );
  body.position.y = 0.24;
  body.castShadow = true;
  g.add(body);

  /* Neck + head */
  const neck = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.28, 0.22),
    bodyMaterial(color)
  );
  neck.position.set(0.05, 0.45, 0);
  neck.rotation.z = -0.15;
  neck.castShadow = true;
  g.add(neck);

  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.22, 0.30),
    bodyMaterial(color)
  );
  head.position.set(0.10, 0.62, 0.06);
  head.castShadow = true;
  g.add(head);

  /* Muzzle (accent) */
  const muzzle = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.10, 0.10),
    accentMaterial(color)
  );
  muzzle.position.set(0.16, 0.58, 0.20);
  muzzle.castShadow = true;
  g.add(muzzle);

  return g;
}

function makeBishop(color) {
  const g = new THREE.Group();
  g.add(makeBase(color));

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.20, 0.42, 16),
    bodyMaterial(color)
  );
  body.position.y = 0.29;
  body.castShadow = true;
  g.add(body);

  const crown = new THREE.Mesh(
    new THREE.SphereGeometry(0.16, 16, 16),
    bodyMaterial(color)
  );
  crown.position.y = 0.56;
  crown.scale.set(1, 1.25, 1);
  crown.castShadow = true;
  g.add(crown);

  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.05, 0.16, 12),
    accentMaterial(color)
  );
  tip.position.y = 0.75;
  tip.castShadow = true;
  g.add(tip);

  return g;
}

function makeQueen(color) {
  const g = new THREE.Group();
  g.add(makeBase(color));

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.24, 0.48, 16),
    bodyMaterial(color)
  );
  body.position.y = 0.32;
  body.castShadow = true;
  g.add(body);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.19, 0.12, 16),
    bodyMaterial(color)
  );
  crown.position.y = 0.62;
  crown.castShadow = true;
  g.add(crown);

  /* Ring of small orbs */
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 8, 8),
      accentMaterial(color)
    );
    orb.position.set(
      Math.cos(angle) * 0.15,
      0.72,
      Math.sin(angle) * 0.15
    );
    g.add(orb);
  }
  return g;
}

function makeKing(color) {
  const g = new THREE.Group();
  g.add(makeBase(color));

  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.26, 0.55, 16),
    bodyMaterial(color)
  );
  body.position.y = 0.35;
  body.castShadow = true;
  g.add(body);

  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.20, 0.18, 0.10, 16),
    bodyMaterial(color)
  );
  crown.position.y = 0.68;
  crown.castShadow = true;
  g.add(crown);

  /* Cross */
  const vert = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.20, 0.06),
    accentMaterial(color)
  );
  vert.position.y = 0.82;
  vert.castShadow = true;
  g.add(vert);

  const horiz = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.06, 0.06),
    accentMaterial(color)
  );
  horiz.position.y = 0.82;
  g.add(horiz);

  return g;
}

const MAKERS = {
  p: makePawn,
  r: makeRook,
  n: makeKnight,
  b: makeBishop,
  q: makeQueen,
  k: makeKing,
};

export function createPieceMesh(type, color) {
  const maker = MAKERS[type];
  if (!maker) throw new Error(`Unknown piece type: ${type}`);
  return maker(color);
}

/* ------------------------------------------------------------------
   Layer that syncs to a chess.js board matrix.
   ------------------------------------------------------------------ */

export function createPieceLayer() {
  const group  = new THREE.Group();
  const meshes = new Map();   // square -> THREE.Group

  /**
   * Rebuild the layer from chess.board() output.
   * @param {Array<Array<{type:string,color:string}|null>>} matrix
   */
  function syncBoard(matrix) {
    while (group.children.length) group.remove(group.children[0]);
    meshes.clear();

    for (let rank = 0; rank < 8; rank++) {
      for (let file = 0; file < 8; file++) {
        const piece = matrix[rank][file];
        if (!piece) continue;

        const chessRank = 8 - rank;                     // board[0] is rank 8
        const square = String.fromCharCode(97 + file) + chessRank;

        const mesh = createPieceMesh(piece.type, piece.color);
        const pos  = squareToWorld(square);
        mesh.position.set(pos.x, PIECE_Y, pos.z);
        mesh.userData.square = square;
        mesh.userData.type   = piece.type;
        mesh.userData.color  = piece.color;

        group.add(mesh);
        meshes.set(square, mesh);
      }
    }
  }

  function getMesh(square) {
    return meshes.get(square) || null;
  }

  function removeMesh(square) {
    const mesh = meshes.get(square);
    if (!mesh) return;
    group.remove(mesh);
    meshes.delete(square);
  }

  return { group, syncBoard, getMesh, removeMesh };
}