/* ================================================================
   procedural-avatar.js — built-in robot/bust avatars.
   Returns a unified avatar handle with setEmotion/update/dispose.
   ================================================================ */

/**
 * @param {'white'|'black'} side
 * @returns {{
 *   group: THREE.Group,
 *   setEmotion: (emotion: string) => void,
 *   update: (dt: number) => void,
 *   getBubbleAnchor: () => THREE.Vector3,
 *   dispose: () => void,
 *   isProcedural: true,
 * }}
 */
export function createProceduralAvatar(side) {
  const group = new THREE.Group();

  const accentColor = side === 'white' ? 0x00e5ff : 0xff4dc4;
  const bodyColor   = side === 'white' ? 0x334455 : 0x443344;

  const bodyMat = new THREE.MeshStandardMaterial({
    color: bodyColor,
    roughness: 0.4,
    metalness: 0.55,
  });
  const accentMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: new THREE.Color(accentColor).multiplyScalar(0.4),
    roughness: 0.2,
    metalness: 0.85,
  });

  /* Torso */
  const torso = new THREE.Mesh(
    new THREE.CylinderGeometry(0.35, 0.45, 0.8, 16),
    bodyMat
  );
  torso.position.y = 0.5;
  torso.castShadow = true;
  group.add(torso);

  /* Head group (we tilt this for emotions) */
  const head = new THREE.Group();
  head.position.y = 1.15;

  const skull = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 20, 20),
    bodyMat
  );
  skull.castShadow = true;
  head.add(skull);

  /* Eyes */
  const eyeGeo = new THREE.SphereGeometry(0.055, 10, 10);
  const eyeL = new THREE.Mesh(eyeGeo, accentMat);
  eyeL.position.set(-0.11, 0.05, -0.22);
  head.add(eyeL);

  const eyeR = new THREE.Mesh(eyeGeo, accentMat);
  eyeR.position.set(0.11, 0.05, -0.22);
  head.add(eyeR);

  /* Visor */
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.06, 0.04),
    accentMat
  );
  visor.position.set(0, 0.05, -0.27);
  head.add(visor);

  group.add(head);

  /* Arms */
  const armGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.5, 10);
  const armL = new THREE.Mesh(armGeo, bodyMat);
  armL.position.set(-0.42, 0.65, 0);
  armL.rotation.z = 0.25;
  armL.castShadow = true;
  group.add(armL);

  const armR = new THREE.Mesh(armGeo, bodyMat);
  armR.position.set(0.42, 0.65, 0);
  armR.rotation.z = -0.25;
  armR.castShadow = true;
  group.add(armR);

  /* Face the board: white at -z faces +z, black at +z faces -z */
  group.rotation.y = side === 'white' ? 0 : Math.PI;

  /* Emotion state */
  let emotion   = 'confident';
  let elapsed   = 0;
  let headBaseY = head.position.y;

  function setEmotion(next) {
    emotion = next || 'confident';
  }

  function update(dt) {
    elapsed += dt;
    const t = elapsed;

    /* Reset per-frame defaults */
    head.rotation.set(0, 0, 0);
    head.position.y = headBaseY;
    group.position.y = Math.sin(t * 1.4) * 0.02;   // gentle idle bob

    switch (emotion) {
      case 'nervous':
        head.rotation.z = Math.sin(t * 6) * 0.12;
        group.position.y = Math.sin(t * 4) * 0.03;
        break;
      case 'thinking':
        head.rotation.z = 0.18;
        head.rotation.x = -0.12;
        break;
      case 'triumphant':
        head.rotation.x = -0.08;
        group.position.y = Math.abs(Math.sin(t * 2.2)) * 0.06;
        break;
      case 'confident':
      default:
        head.rotation.z = Math.sin(t * 0.9) * 0.04;
        break;
    }
  }

  function getBubbleAnchor() {
    /* Bubble sits ~0.4 above the top of the head */
    return new THREE.Vector3(
      group.position.x,
      head.position.y + 0.7,
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
  }

  return { group, setEmotion, update, getBubbleAnchor, dispose, isProcedural: true };
}