// Main entry point — 3D Graphics Pipeline Simulator (Landscape Scene)
// Sets up Three.js, the landscape scene, orbit controls, stage UI, and the render loop.

import { S, THEMES } from './pipeline_3d_state.js';
import { initLandscape, applyTerrainMaterial, terrainHeight, updateSunPosition } from './pipeline_3d_landscape.js';
import { buildRepr, buildDetail0, updateDetail0, selectObject, clearSelection } from './pipeline_3d_stage1.js';
import { buildDetail1, updateDetail1 } from './pipeline_3d_stage2.js';
import { buildDetail2 } from './pipeline_3d_stage3.js';
import { buildDetail3, applySplitView, getOrthoCamera } from './pipeline_3d_stage4.js';
import { buildDetail4, applyPixelation, updateEffRes, drawZoomInset } from './pipeline_3d_stage5.js';

// ─── THREE.JS SETUP ──────────────────────────────────────────────────────────
S.renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('main-canvas'), antialias: true });
S.renderer.shadowMap.enabled = false;
S.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
S.renderer.setPixelRatio(window.devicePixelRatio);

S.scene = new THREE.Scene();
S.scene.background = new THREE.Color(0xc8d8f0);

S.camera = new THREE.PerspectiveCamera(60, 1, 0.1, 200);

S.godRenderer = new THREE.WebGLRenderer({ canvas: document.getElementById('god-eye-canvas'), antialias: true });
S.godRenderer.setPixelRatio(window.devicePixelRatio);
S.godRenderer.shadowMap.enabled = false;

S.godCamera = new THREE.OrthographicCamera(-12, 12, 9, -9, 0.1, 200);
S.godCamera.position.set(0, 20, 0);
S.godCamera.lookAt(0, 0, 0);

// Camera helper (shown in god view)
S.cameraHelper = new THREE.CameraHelper(S.camera);
S.cameraHelper.visible = false;
S.scene.add(S.cameraHelper);

// Axes helper for orientation
S.scene.add(new THREE.AxesHelper(3));

// Ambient light
S.ambientLight = new THREE.AmbientLight(0xfff0e0, 0.35);
S.ambientLight.visible = false;
S.scene.add(S.ambientLight);

// ─── ORBIT STATE ─────────────────────────────────────────────────────────────
S.orbit.target    = new THREE.Vector3(0, 0.5, 0);
S.godOrbit.target = new THREE.Vector3(0, 0, 0);

// ─── LANDSCAPE INIT ──────────────────────────────────────────────────────────
// Creates terrain, skybox, sun sphere, and directional light — all on S.*
initLandscape();

// ─── SCENE OBJECTS (selectable props) ────────────────────────────────────────
S.objectDefs = [
  {
    name: 'Tree',
    worldPos:   new THREE.Vector3(2,  terrainHeight(2, 1),   1),
    worldRot:   new THREE.Euler(0,  0.3,  0),
    worldScale: new THREE.Vector3(1, 1, 1),
    color: 0x2d5a1b, grayColor: 0x707070,
    geoType: 'tree',
    repr: 'brep', reprGroup: null, mesh: null,
    pointSize: 0.05, pointDensity: 200, voxelRes: 5, sweepAngle: 360,
    wireframeOn: false, normalsOn: false,
  },
  {
    name: 'Rock',
    worldPos:   new THREE.Vector3(-5, terrainHeight(-5, -3), -3),
    worldRot:   new THREE.Euler(0,  0.8,  0.1),
    worldScale: new THREE.Vector3(1, 1, 1),
    color: 0x7a7065, grayColor: 0x909090,
    geoType: 'rock',
    repr: 'brep', reprGroup: null, mesh: null,
    pointSize: 0.05, pointDensity: 150, voxelRes: 4, sweepAngle: 360,
    wireframeOn: false, normalsOn: false,
  },
  {
    name: 'Cabin',
    worldPos:   new THREE.Vector3(4,  terrainHeight(4, -3),  -3),
    worldRot:   new THREE.Euler(0, -0.5,  0),
    worldScale: new THREE.Vector3(1, 1, 1),
    color: 0x8b5e3c, grayColor: 0x808080,
    geoType: 'cabin',
    repr: 'brep', reprGroup: null, mesh: null,
    pointSize: 0.05, pointDensity: 180, voxelRes: 4, sweepAngle: 360,
    wireframeOn: false, normalsOn: false,
  },
];

S.objectDefs.forEach(def => buildRepr(def));

// ─── ORBIT CONTROLS ──────────────────────────────────────────────────────────
function updateCameraFromOrbit(orb, cam) {
  const phiRad   = THREE.MathUtils.degToRad(orb.phi);
  const thetaRad = THREE.MathUtils.degToRad(orb.theta);
  cam.position.set(
    orb.target.x + orb.radius * Math.cos(phiRad) * Math.sin(thetaRad),
    orb.target.y + orb.radius * Math.sin(phiRad),
    orb.target.z + orb.radius * Math.cos(phiRad) * Math.cos(thetaRad)
  );
  cam.lookAt(orb.target);
}

updateCameraFromOrbit(S.orbit, S.camera);

// ─── KEYBOARD STATE (for camera movement) ────────────────────────────────────
const keyboardState = {
  w: false, a: false, s: false, d: false,
  moveSpeed: 0.1, // units per frame
};

document.addEventListener('keydown', e => {
  const key = e.key.toLowerCase();
  if (key === 'w') keyboardState.w = true;
  if (key === 'a') keyboardState.a = true;
  if (key === 's') keyboardState.s = true;
  if (key === 'd') keyboardState.d = true;
});

document.addEventListener('keyup', e => {
  const key = e.key.toLowerCase();
  if (key === 'w') keyboardState.w = false;
  if (key === 'a') keyboardState.a = false;
  if (key === 's') keyboardState.s = false;
  if (key === 'd') keyboardState.d = false;
});

// ─── CANVAS EVENTS ───────────────────────────────────────────────────────────
const mainCanvas = document.getElementById('main-canvas');
const godCanvas  = document.getElementById('god-eye-canvas');
const raycaster  = new THREE.Raycaster();
raycaster.params.Points = { threshold: 0.15 };
const mouse      = new THREE.Vector2();
let mouseDownX = 0, mouseDownY = 0;

mainCanvas.addEventListener('mousedown', e => {
  const rect = mainCanvas.getBoundingClientRect();
  if (S.splitActive && e.clientX < rect.left + rect.width / 2) return;
  S.orbit.dragging = true;
  S.orbit.button   = e.button;
  S.orbit.lastX    = e.clientX;
  S.orbit.lastY    = e.clientY;
  mouseDownX = e.clientX;
  mouseDownY = e.clientY;
});

document.addEventListener('mousemove', e => {
  if (S.orbit.dragging) {
    const dx = e.clientX - S.orbit.lastX;
    const dy = e.clientY - S.orbit.lastY;
    S.orbit.lastX = e.clientX;
    S.orbit.lastY = e.clientY;
    if (S.orbit.button === 0) {
      S.orbit.theta -= dx * 0.4;
      S.orbit.phi   += dy * 0.3;
      S.orbit.phi    = Math.max(-89, Math.min(89, S.orbit.phi));
    }
    updateCameraFromOrbit(S.orbit, S.camera);
  }
  if (S.godOrbit.dragging) {
    const dx = e.clientX - S.godOrbit.lastX;
    const dy = e.clientY - S.godOrbit.lastY;
    S.godOrbit.lastX   = e.clientX;
    S.godOrbit.lastY   = e.clientY;
    S.godOrbit.theta  -= dx * 0.4;
    S.godOrbit.phi    += dy * 0.3;
    S.godOrbit.phi     = Math.max(10, Math.min(89, S.godOrbit.phi));
    updateCameraFromOrbit(S.godOrbit, S.godCamera);
  }
});

document.addEventListener('mouseup', () => {
  S.orbit.dragging    = false;
  S.godOrbit.dragging = false;
});

mainCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  S.orbit.radius = Math.max(3, Math.min(50, S.orbit.radius + e.deltaY * 0.02));
  updateCameraFromOrbit(S.orbit, S.camera);
}, { passive: false });

mainCanvas.addEventListener('click', e => {
  if (Math.abs(e.clientX - mouseDownX) > 5 || Math.abs(e.clientY - mouseDownY) > 5) return;
  const rect = mainCanvas.getBoundingClientRect();
  let nx, ny;
  if (S.splitActive) {
    const halfW = rect.width / 2;
    if (e.clientX - rect.left < halfW) return;
    nx = ((e.clientX - rect.left - halfW) / halfW) * 2 - 1;
    ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  } else {
    nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  }
  mouse.set(nx, ny);
  raycaster.setFromCamera(mouse, S.camera);

  const pickable = [];
  S.objectDefs.forEach(def => {
    if (def.reprGroup?.visible)
      def.reprGroup.traverse(o => { if (o.isMesh || o.isPoints) pickable.push(o); });
  });

  const hits = raycaster.intersectObjects(pickable);
  if (hits.length > 0) {
    let hitDef = null;
    for (const def of S.objectDefs) {
      if (!def.reprGroup) continue;
      let found = false;
      def.reprGroup.traverse(o => { if (o === hits[0].object) found = true; });
      if (found) { hitDef = def; break; }
    }
    if (hitDef) selectObject(hitDef);
  } else {
    clearSelection();
  }
});

godCanvas.addEventListener('mousedown', e => {
  S.godOrbit.dragging = true;
  S.godOrbit.lastX    = e.clientX;
  S.godOrbit.lastY    = e.clientY;
  e.stopPropagation();
});
godCanvas.addEventListener('wheel', e => {
  e.preventDefault();
  S.godOrbit.radius = Math.max(8, Math.min(60, S.godOrbit.radius + e.deltaY * 0.02));
  updateCameraFromOrbit(S.godOrbit, S.godCamera);
}, { passive: false });

// ─── RESIZE ──────────────────────────────────────────────────────────────────
function resizeAll() {
  const wrap = document.getElementById('viewport-wrap');
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;

  if (S.splitActive) {
    const hw = Math.floor(W / 2);
    godCanvas.style.width  = hw + 'px';
    godCanvas.style.height = H + 'px';
    godCanvas.width  = hw * window.devicePixelRatio;
    godCanvas.height = H  * window.devicePixelRatio;
    S.godRenderer.setSize(hw, H, false);
    const aspect = hw / H;
    const frustH = 9;
    S.godCamera.left  = -frustH * aspect;
    S.godCamera.right =  frustH * aspect;
    S.godCamera.updateProjectionMatrix();

    mainCanvas.style.width  = hw + 'px';
    mainCanvas.style.height = H + 'px';
    S.renderer.setSize(hw, H, false);
    S.camera.aspect = hw / H;
    S.camera.updateProjectionMatrix();

    document.getElementById('label-cam').style.left = (hw + 8) + 'px';
  } else {
    godCanvas.style.width  = '0';
    godCanvas.style.height = '0';
    mainCanvas.style.width  = W + 'px';
    mainCanvas.style.height = H + 'px';
    S.renderer.setSize(W, H, false);
    S.camera.aspect = W / H;
    S.camera.updateProjectionMatrix();
  }
  updateEffRes();
}
S.resizeAll = resizeAll;
window.addEventListener('resize', resizeAll);

// ─── STAGE UI ────────────────────────────────────────────────────────────────
const stageData = [
  { num: 1, label: 'Object Representation' },
  { num: 2, label: 'Modeling Transform' },
  { num: 3, label: 'Lighting' },
  { num: 4, label: 'Viewing Pipeline' },
  { num: 5, label: 'Scan Conversion' },
];

const stageList = document.getElementById('stage-list');
stageData.forEach((sd, i) => {
  const row = document.createElement('div');
  row.className = 'stage-row';
  row.id = `stage-row-${i}`;
  row.innerHTML = `
    <div class="stage-header" data-idx="${i}">
      <div class="stage-badge">${sd.num}</div>
      <div class="stage-name">${sd.label}</div>
      <button class="toggle-pill" id="toggle-${i}" aria-label="Toggle stage ${sd.num}"></button>
    </div>
    <div class="dep-note" id="dep-note-${i}" style="display:none"></div>
    <div class="detail-panel" id="detail-${i}"></div>
  `;
  stageList.appendChild(row);
});

function applyStageVisibility() {
  const s1 = S.stages[0];
  const s3 = S.stages[2];
  const s4 = S.stages[3];
  const s5 = S.stages[4];

  // Rebuild props (handles transform, material type changes)
  S.objectDefs.forEach(def => buildRepr(def));
  S.objectDefs.forEach(def => {
    if (def.reprGroup) def.reprGroup.visible = s1;
  });

  // Environment visibility (terrain + skybox follow Stage 1 presence)
  if (S.terrain) S.terrain.visible = s1;
  if (S.skybox)  S.skybox.visible  = s1;

  // Swap terrain material for lit vs unlit rendering
  applyTerrainMaterial(s3);
  if (S.terrain) S.terrain.visible = s1; // re-apply after material swap

  // Sun / lighting
  if (S.dirLight)   S.dirLight.visible   = s3;
  if (S.sunSphere)  S.sunSphere.visible   = s3;
  if (S.ambientLight) S.ambientLight.visible = s3 && S.s3AmbientOn;
  S.renderer.shadowMap.enabled = s3 && S.s3ShadowOn;

  // Atmospheric fog (Stage 3 lighting/atmosphere feature)
  S.scene.fog = s3 ? new THREE.Fog(0xf4c8a8, 35, 85) : null;

  applySplitView(s4);
  applyPixelation(s5);

  updateStats();
  updateStageUI();
  updateDetailPanels();
}

function updateStageUI() {
  stageData.forEach((sd, i) => {
    const row     = document.getElementById(`stage-row-${i}`);
    const toggle  = document.getElementById(`toggle-${i}`);
    const depNote = document.getElementById(`dep-note-${i}`);
    const isOn       = S.stages[i];
    const isDisabled = i > 0 && !S.stages[i - 1];

    row.classList.toggle('active-stage', isOn);
    row.classList.toggle('disabled', isDisabled);
    toggle.classList.toggle('on', isOn);
    toggle.classList.toggle('disabled-toggle', isDisabled);

    if (isDisabled) {
      depNote.style.display = 'block';
      depNote.textContent   = `Requires Stage ${i}: ${stageData[i - 1].label}`;
    } else {
      depNote.style.display = 'none';
    }
  });
  document.getElementById('stat-stages').textContent = S.stages.filter(Boolean).length;
}

function toggleStage(idx) {
  if (idx > 0 && !S.stages[idx - 1]) return;
  S.stages[idx] = !S.stages[idx];
  if (!S.stages[idx]) {
    for (let j = idx + 1; j < 5; j++) S.stages[j] = false;
  }
  applyStageVisibility();
}

stageData.forEach((sd, i) => {
  const header = document.querySelector(`#stage-row-${i} .stage-header`);
  const toggle = document.getElementById(`toggle-${i}`);

  toggle.addEventListener('click', e => {
    e.stopPropagation();
    toggleStage(i);
  });

  header.addEventListener('click', e => {
    if (e.target === toggle) return;
    S.openDetail = S.openDetail === i ? -1 : i;
    updateDetailPanels();
  });
});

function updateDetailPanels() {
  for (let i = 0; i < 5; i++) {
    document.getElementById(`detail-${i}`).classList.toggle('open', S.openDetail === i);
  }
  if (S.openDetail === 0) updateDetail0();
  if (S.openDetail === 1) updateDetail1();
}
S.updateDetailPanels = updateDetailPanels;

// ─── STATS ───────────────────────────────────────────────────────────────────
function updateStats() {
  let totalVerts = 0, totalTris = 0, objCount = 0;

  S.objectDefs.forEach(def => {
    if (!def.reprGroup?.visible) return;
    objCount++;
    def.reprGroup.traverse(obj => {
      const pos = obj.geometry?.attributes.position;
      if (!pos) return;
      totalVerts += pos.count;
      totalTris  += obj.geometry.index ? obj.geometry.index.count / 3 : pos.count / 3;
    });
  });

  const fmt = n => n > 999 ? (n / 1000).toFixed(1) + 'k' : n;
  document.getElementById('stat-objects').textContent = objCount;
  document.getElementById('stat-verts').textContent   = fmt(totalVerts);
  document.getElementById('stat-tris').textContent    = fmt(Math.floor(totalTris));
  document.getElementById('stat-stages').textContent  = S.stages.filter(Boolean).length;
}
S.updateStats = updateStats;

// ─── THEME ───────────────────────────────────────────────────────────────────
function setTheme(name) {
  if (name === S.currentTheme) return;
  S.currentTheme = name;
  const t = THEMES[name];

  document.documentElement.setAttribute('data-theme', name === 'dark' ? 'dark' : '');

  S.scene.background = new THREE.Color(t.sceneBg);

  // gridHelper is null in the landscape scene — null-check guards the original path
  if (S.gridHelper) {
    if (Array.isArray(S.gridHelper.material)) {
      S.gridHelper.material[0].color.setHex(t.gridMain);
      S.gridHelper.material[1].color.setHex(t.gridSub);
    } else {
      S.gridHelper.material.color.setHex(t.gridSub);
    }
  }

  applyStageVisibility();

  document.getElementById('btn-light').classList.toggle('active', name === 'light');
  document.getElementById('btn-dark').classList.toggle('active', name === 'dark');
}

document.getElementById('btn-light').addEventListener('click', () => setTheme('light'));
document.getElementById('btn-dark').addEventListener('click', () => setTheme('dark'));

// ─── RENDER LOOP ─────────────────────────────────────────────────────────────
function render() {
  requestAnimationFrame(render);

  // Apply WASD camera movement
  if (keyboardState.w || keyboardState.a || keyboardState.s || keyboardState.d) {
    // Calculate camera forward direction
    const forward = new THREE.Vector3();
    S.camera.getWorldDirection(forward);
    
    // Calculate right direction (perpendicular to forward)
    const right = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    right.crossVectors(forward, up).normalize();
    
    // Recalculate up to ensure orthogonality
    const trueUp = new THREE.Vector3();
    trueUp.crossVectors(right, forward).normalize();
    
    // Apply movement
    const movement = new THREE.Vector3();
    if (keyboardState.w) movement.addScaledVector(forward, keyboardState.moveSpeed);
    if (keyboardState.s) movement.addScaledVector(forward, -keyboardState.moveSpeed);
    if (keyboardState.d) movement.addScaledVector(right, keyboardState.moveSpeed);
    if (keyboardState.a) movement.addScaledVector(right, -keyboardState.moveSpeed);
    
    // Move camera and orbit target together
    S.camera.position.add(movement);
    S.orbit.target.add(movement);
  }

  if (S.cameraHelper && S.stages[3]) S.cameraHelper.update();

  if (S.stages[4] && S.s5ScanlineOn) {
    const bar = document.getElementById('scanline-bar');
    S.scanlineY = (S.scanlineY + 0.5) % 150;
    bar.style.top = S.scanlineY + 'px';
  }

  if (S.stages[4]) {
    const wrap = document.getElementById('viewport-wrap');
    const W = wrap.clientWidth * (S.splitActive ? 0.5 : 1);
    const H = wrap.clientHeight;
    const effW = Math.max(1, Math.floor(W / S.pixelSize));
    const effH = Math.max(1, Math.floor(H / S.pixelSize));
    S.renderer.setSize(effW, effH, false);
    mainCanvas.style.width  = W + 'px';
    mainCanvas.style.height = H + 'px';
    mainCanvas.style.imageRendering = 'pixelated';
  }

  if (S.splitActive && S.stages[3]) {
    S.cameraHelper.visible = true;
    S.godRenderer.render(S.scene, S.godCamera);
  }

  if (S.s4ProjOn && S.stages[3]) {
    S.renderer.render(S.scene, getOrthoCamera());
  } else {
    S.renderer.render(S.scene, S.camera);
  }

  if (S.stages[4]) drawZoomInset();

  updateStats();
}

// ─── INIT ────────────────────────────────────────────────────────────────────
buildDetail0();
buildDetail1();
buildDetail2();
buildDetail3();
buildDetail4();

updateCameraFromOrbit(S.godOrbit, S.godCamera);
updateStageUI();
applyStageVisibility();
resizeAll();
render();
