// Landscape module — procedural terrain, gradient skybox, sun directional light.
// None of these are pipeline "objects" — they form the environment.

import { S } from './pipeline_3d_state.js';

// ─── TERRAIN HEIGHT ───────────────────────────────────────────────────────────
// Pure function exported so other modules can sample ground level at any (x, z).
export function terrainHeight(x, z) {
  return Math.sin(x * 0.3) * Math.cos(z * 0.3) * 1.5
       + Math.sin(x * 0.7 + 1.0) * 0.6
       + Math.cos(z * 0.5 - 0.5) * 0.4;
}

// ─── TERRAIN GEOMETRY ────────────────────────────────────────────────────────
function buildTerrainGeometry() {
  const geo = new THREE.PlaneGeometry(30, 30, 60, 60);
  geo.rotateX(-Math.PI / 2);

  const pos = geo.attributes.position;
  const colors = [];
  const minH = -2.5, maxH = 2.5;

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const y = terrainHeight(x, z);
    pos.setY(i, y);

    // Three-stop color gradient: dark-green → grass-green → tan/rocky
    const t = Math.max(0, Math.min(1, (y - minH) / (maxH - minH)));
    let r, g, b;
    if (t < 0.5) {
      const s = t * 2;
      r = 0.13 + s * (0.22 - 0.13);
      g = 0.28 + s * (0.52 - 0.28);
      b = 0.06 + s * (0.12 - 0.06);
    } else {
      const s = (t - 0.5) * 2;
      r = 0.22 + s * (0.64 - 0.22);
      g = 0.52 + s * (0.50 - 0.52);
      b = 0.12 + s * (0.36 - 0.12);
    }
    colors.push(r, g, b);
  }

  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}

// Swap terrain material between lit (Stage 3 on) and unlit (Stage 3 off).
// Avoids rebuilding the geometry on every stage toggle.
export function applyTerrainMaterial(useLit) {
  if (!S.terrain) return;
  S.terrain.material.dispose();
  S.terrain.material = useLit
    ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 })
    : new THREE.MeshBasicMaterial({ vertexColors: true });
  S.terrain.receiveShadow = useLit;
}

// ─── SUN POSITION ────────────────────────────────────────────────────────────
export function updateSunPosition() {
  const phi   = THREE.MathUtils.degToRad(S.sunElevation);
  const theta = THREE.MathUtils.degToRad(S.sunAzimuth);
  const dx = Math.cos(phi) * Math.sin(theta);
  const dy = Math.sin(phi);
  const dz = Math.cos(phi) * Math.cos(theta);
  if (S.dirLight) {
    S.dirLight.position.set(dx * 30, dy * 30, dz * 30);
    S.dirLight.target.position.set(0, 0, 0);
    S.dirLight.target.updateMatrixWorld();
  }
  if (S.sunSphere) {
    S.sunSphere.position.set(dx * 62, dy * 62, dz * 62);
  }
}

// ─── INIT ────────────────────────────────────────────────────────────────────
export function initLandscape() {
  // Terrain — starts with BasicMaterial (Stage 3 is off at boot)
  const terrainGeo = buildTerrainGeometry();
  S.terrain = new THREE.Mesh(terrainGeo, new THREE.MeshBasicMaterial({ vertexColors: true }));
  S.terrain.receiveShadow = false;
  S.terrain.userData.isTerrain = true;
  S.scene.add(S.terrain);

  // Gradient skybox — inverted sphere with GLSL gradient
  const skyGeo = new THREE.SphereGeometry(80, 32, 16);
  S.skybox = new THREE.Mesh(skyGeo, new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      skyTop: { value: new THREE.Color(0x3a5f8a) },
      skyBot: { value: new THREE.Color(0xf4c8a8) },
    },
    vertexShader: `
      varying float vY;
      void main() {
        vY = position.y;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 skyTop;
      uniform vec3 skyBot;
      varying float vY;
      void main() {
        float t = clamp((vY + 5.0) / 85.0, 0.0, 1.0);
        gl_FragColor = vec4(mix(skyBot, skyTop, t), 1.0);
      }
    `,
  }));
  S.scene.add(S.skybox);

  // Visible sun sphere (emissive marker)
  S.sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(2.5, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff4a0 })
  );
  S.sunSphere.visible = false;
  S.scene.add(S.sunSphere);

  // Directional sun light
  S.dirLight = new THREE.DirectionalLight(0xfff4e0, 1.0);
  S.dirLight.castShadow = true;
  S.dirLight.shadow.mapSize.width  = 1024;
  S.dirLight.shadow.mapSize.height = 1024;
  S.dirLight.shadow.camera.near   = 0.5;
  S.dirLight.shadow.camera.far    = 80;
  S.dirLight.shadow.camera.left   = -20;
  S.dirLight.shadow.camera.right  = 20;
  S.dirLight.shadow.camera.top    = 20;
  S.dirLight.shadow.camera.bottom = -20;
  S.dirLight.visible = false;
  S.scene.add(S.dirLight);
  S.scene.add(S.dirLight.target);

  updateSunPosition();
}
