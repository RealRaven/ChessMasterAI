/* ================================================================
   glb-loader.js — load a user-uploaded .glb/.gltf, normalize it to
   a standard height, recenter it on its seat, orient it to face the
   board, and wire up any embedded AnimationClips.
   ================================================================ */

const TARGET_HEIGHT = 1.8;

/**
 * Load a GLB file from a File object (from <input type="file">).
 *
 * @param {File} file
 * @param {'white'|'black'} side
 * @returns {Promise<object>} a unified avatar handle
 */
export function loadGLBAvatar(file, side) {
  const url = URL.createObjectURL(file);
  const loader = new THREE.GLTFLoader();

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url);

        try {
          resolve(buildHandle(gltf, side));
        } catch (err) {
          reject(err);
        }
      },
      undefined,
      (err) => {
        URL.revokeObjectURL(url);
        reject(err);
      }
    );
  });
}

function buildHandle(gltf, side) {
  const model = gltf.scene;

  /* --- 1. Normalize scale --- */
  const box  = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const maxDim = Math.max(size.x, size.y, size.z) || 1;
  const scale  = TARGET_HEIGHT / maxDim;
  model.scale.setScalar(scale);

  /* --- 2. Recenter: feet on y=0, centered on x/z --- */
  const box2 = new THREE.Box3().setFromObject(model);
  const center = box2.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.z -= center.z;
  model.position.y -= box2.min.y;

  /* --- 3. Face the board --- */
  model.rotation.y = side === 'white' ? 0 : Math.PI;

  /* --- 4. Shadows --- */
  model.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  /* --- 5. Wrap in a container so callers see one consistent API --- */
  const group = new THREE.Group();
  group.add(model);

  /* --- 6. Animation mixer --- */
  let mixer = null;
  if (Array.isArray(gltf.animations) && gltf.animations.length > 0) {
    mixer = new THREE.AnimationMixer(model);
    gltf.animations.forEach((clip) => mixer.clipAction(clip).play());
  }

  /* --- 7. Compute normalised height for bubble anchor --- */
  const finalBox = new THREE.Box3().setFromObject(model);
  const finalSize = finalBox.getSize(new THREE.Vector3());
  const bubbleHeight = finalSize.y + 0.4;

  /* --- 8. Fallback bob when there are no clips --- */
  let elapsed = 0;
  let emotion = 'confident';

  function setEmotion(next) {
    emotion = next || 'confident';
  }

  function update(dt) {
    elapsed += dt;
    if (mixer) mixer.update(dt);

    /* Subtle procedural bob when there are no embedded clips */
    if (!mixer) {
      if (emotion === 'nervous') {
        group.position.y = Math.sin(elapsed * 6) * 0.02;
      } else if (emotion === 'triumphant') {
        group.position.y = Math.abs(Math.sin(elapsed * 2.2)) * 0.05;
      } else {
        group.position.y = Math.sin(elapsed * 1.4) * 0.015;
      }
    }
  }

  function getBubbleAnchor() {
    return new THREE.Vector3(
      group.position.x,
      bubbleHeight,
      group.position.z
    );
  }

  function dispose() {
    group.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    if (mixer) mixer.stopAllAction();
  }

  return {
    group,
    setEmotion,
    update,
    getBubbleAnchor,
    dispose,
    isProcedural: false,
    mixer,
    animations: gltf.animations || [],
  };
}