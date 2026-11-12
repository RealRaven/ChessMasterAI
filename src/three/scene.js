/* ================================================================
   scene.js — creates the main scene, camera, both renderers,
   lights, orbit controls, and the resize handler.
   Returns a facade object that the rest of the app mutates.
   ================================================================ */

import { CONFIG } from '../config.js';
import { getTheme } from './themes.js';

/**
 * Build the scene and everything attached to the root.
 * @returns {{
 *   scene: THREE.Scene,
 *   camera: THREE.PerspectiveCamera,
 *   renderer: THREE.WebGLRenderer,
 *   labelRenderer: THREE.CSS2DRenderer,
 *   controls: THREE.OrbitControls,
 *   lights: { ambient: THREE.AmbientLight, dir: THREE.DirectionalLight, fill: THREE.PointLight },
 * }}
 */
export function createScene() {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    100
  );
  camera.position.set(6, 7, 6);

  /* --- WebGL renderer --- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  document.getElementById('webgl-container').appendChild(renderer.domElement);

  /* --- CSS2D overlay for speech bubbles + labels --- */
  const labelRenderer = new THREE.CSS2DRenderer();
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.top = '0';
  labelRenderer.domElement.style.left = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';
  document.getElementById('css2d-container').appendChild(labelRenderer.domElement);

  /* --- Orbit controls --- */
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 3;
  controls.maxDistance = 22;
  controls.target.set(0, 0.4, 0);

  /* --- Lights --- */
  const ambient = new THREE.AmbientLight(0x404060, 1.15);
  scene.add(ambient);

  const dir = new THREE.DirectionalLight(0xffffff, 1.5);
  dir.position.set(5, 10, 7);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.left = -8;
  dir.shadow.camera.right = 8;
  dir.shadow.camera.top = 8;
  dir.shadow.camera.bottom = -8;
  dir.shadow.bias = -0.0005;
  scene.add(dir);

  const fill = new THREE.PointLight(0x4466ff, 0.5, 30);
  fill.position.set(-5, 5, -5);
  scene.add(fill);

  /* --- Resize --- */
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    labelRenderer.setSize(window.innerWidth, window.innerHeight);
  });

  const api = { scene, camera, renderer, labelRenderer, controls, lights: { ambient, dir, fill } };

  /* Start with the default theme applied */
  applyTheme(api, 'classic');

  return api;
}

/**
 * Swap the active theme in the live scene.
 * Board tiles rebuild themselves; this function only owns the
 * scene-wide bits (background, fog, lights).
 *
 * @param {object} api  - returned object from createScene()
 * @param {string} id   - theme key from THEMES
 */
export function applyTheme(api, id) {
  const theme = getTheme(id);
  const { scene, lights } = api;

  scene.background = new THREE.Color(theme.bg);
  scene.fog = new THREE.FogExp2(theme.bg, theme.fogDensity);

  lights.ambient.color.setHex(theme.ambient.color);
  lights.ambient.intensity = theme.ambient.intensity;

  lights.dir.color.setHex(theme.directional.color);
  lights.dir.intensity = theme.directional.intensity;
  lights.dir.position.set(...theme.directional.pos);

  lights.fill.color.setHex(theme.fill.color);
  lights.fill.intensity = theme.fill.intensity;
  lights.fill.position.set(...theme.fill.pos);
}