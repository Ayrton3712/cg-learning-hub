// Stage 2 - Modeling Transformation
// Handles the per-object transform sliders, 4x4 matrix display, and the Stage 2 detail panel.

import { S } from './pipeline_3d_state.js';
import { terrainHeight } from './pipeline_3d_landscape.js';

// Pre-allocated matrix scratchpads. Reused for every object; safe under the
// browser's single-threaded model since composeObjectMatrix + reprGroup.matrix.copy
// complete before the next call.
const _T = new THREE.Matrix4();
const _R = new THREE.Matrix4();
const _S = new THREE.Matrix4();
const _Sh = new THREE.Matrix4();
const _Refl = new THREE.Matrix4();
const _Euler = new THREE.Euler();

// State defaults for new per-object reflection / shear fields.
function ensureObjTransformState(def) {
  if (!def.reflectPlane) def.reflectPlane = null;
  if (!def.shear)
    def.shear = { xy: 0, xz: 0, yx: 0, yz: 0, zx: 0, zy: 0 };
}

// DETAIL PANEL
export function buildDetail1() {
  document.getElementById('detail-1').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Selected Object</div>
      <div id="s2-selected">None</div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Transform Matrix (Local → World)</div>
      <div id="matrix-grid"></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Translate</div>
      <div class="slider-row"><label>X</label><input type="range" id="tx" min="-6" max="6" step="0.1" value="0"><span class="slider-val" id="tx-v">0.0</span></div>
      <div class="slider-row"><label>Y</label><input type="range" id="ty" min="-4" max="4" step="0.1" value="0"><span class="slider-val" id="ty-v">0.0</span></div>
      <div class="slider-row"><label>Z</label><input type="range" id="tz" min="-6" max="6" step="0.1" value="0"><span class="slider-val" id="tz-v">0.0</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Rotate (°)</div>
      <div class="slider-row"><label>X</label><input type="range" id="rx" min="-180" max="180" step="1" value="0"><span class="slider-val" id="rx-v">0°</span></div>
      <div class="slider-row"><label>Y</label><input type="range" id="ry" min="-180" max="180" step="1" value="0"><span class="slider-val" id="ry-v">0°</span></div>
      <div class="slider-row"><label>Z</label><input type="range" id="rz" min="-180" max="180" step="1" value="0"><span class="slider-val" id="rz-v">0°</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Scale</div>
      <div class="slider-row"><label>X</label><input type="range" id="sx" min="0.1" max="3" step="0.05" value="1"><span class="slider-val" id="sx-v">1.0</span></div>
      <div class="slider-row"><label>Y</label><input type="range" id="sy" min="0.1" max="3" step="0.05" value="1"><span class="slider-val" id="sy-v">1.0</span></div>
      <div class="slider-row"><label>Z</label><input type="range" id="sz" min="0.1" max="3" step="0.05" value="1"><span class="slider-val" id="sz-v">1.0</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Reflect</div>
      <select id="reflect-plane" class="obj-select">
        <option value="">None</option>
        <option value="xy">XY plane (mirror Z)</option>
        <option value="yz">YZ plane (mirror X)</option>
        <option value="xz">XZ plane (mirror Y)</option>
      </select>
    </div>
    <div class="detail-section">
      <div class="detail-label">Shear</div>
      <div class="slider-row"><label>XY</label><input type="range" id="sh-xy" min="-1" max="1" step="0.05" value="0"><span class="slider-val" id="sh-xy-v">0.00</span></div>
      <div class="slider-row"><label>XZ</label><input type="range" id="sh-xz" min="-1" max="1" step="0.05" value="0"><span class="slider-val" id="sh-xz-v">0.00</span></div>
      <div class="slider-row"><label>YX</label><input type="range" id="sh-yx" min="-1" max="1" step="0.05" value="0"><span class="slider-val" id="sh-yx-v">0.00</span></div>
      <div class="slider-row"><label>YZ</label><input type="range" id="sh-yz" min="-1" max="1" step="0.05" value="0"><span class="slider-val" id="sh-yz-v">0.00</span></div>
      <div class="slider-row"><label>ZX</label><input type="range" id="sh-zx" min="-1" max="1" step="0.05" value="0"><span class="slider-val" id="sh-zx-v">0.00</span></div>
      <div class="slider-row"><label>ZY</label><input type="range" id="sh-zy" min="-1" max="1" step="0.05" value="0"><span class="slider-val" id="sh-zy-v">0.00</span></div>
    </div>
    <div class="detail-section">
      <button class="btn" id="reset-transform">Reset Transform</button>
    </div>
  `;

  // Build 4x4 matrix cells
  const mg = document.getElementById('matrix-grid');
  for (let i = 0; i < 16; i++) {
    const cell = document.createElement('div');
    cell.className = 'matrix-cell';
    cell.id = `mc-${i}`;
    cell.textContent = i % 5 === 0 ? '1.00' : '0.00';
    mg.appendChild(cell);
  }

  ['tx','ty','tz','rx','ry','rz','sx','sy','sz'].forEach(id => {
    document.getElementById(id).addEventListener('input', () => {
      if (!S.selectedObj || !S.stages[1]) return;
      applyTransformSliders();
    });
  });

  document.getElementById('reflect-plane').addEventListener('change', function() {
    if (!S.selectedObj || !S.stages[1]) return;
    ensureObjTransformState(S.selectedObj);
    S.selectedObj.reflectPlane = this.value || null;
    applyTransformSliders();
  });

  ['sh-xy','sh-xz','sh-yx','sh-yz','sh-zx','sh-zy'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      if (!S.selectedObj || !S.stages[1]) return;
      ensureObjTransformState(S.selectedObj);
      const key = id.slice(3); // 'sh-xy' -> 'xy'
      S.selectedObj.shear[key] = parseFloat(this.value);
      document.getElementById(id + '-v').textContent = parseFloat(this.value).toFixed(2);
      applyTransformSliders();
    });
  });

  document.getElementById('reset-transform').addEventListener('click', () => {
    if (!S.selectedObj) return;
    const idx = S.objectDefs.indexOf(S.selectedObj);
    S.selectedObj.worldPos.copy(defaultPos(idx));
    S.selectedObj.worldRot.copy(defaultRot(idx));
    S.selectedObj.worldScale.set(1, 1, 1);
    ensureObjTransformState(S.selectedObj);
    S.selectedObj.reflectPlane = null;
    S.selectedObj.shear = { xy: 0, xz: 0, yx: 0, yz: 0, zx: 0, zy: 0 };
    syncTransformSliders();
    applyTransformSliders();
  });
}

// HELPERS
function defaultPos(idx) {
  return [
    new THREE.Vector3(2,  terrainHeight(2, 1),   1),   // Tree
    new THREE.Vector3(-5, terrainHeight(-5, -3), -3),  // Rock
    new THREE.Vector3(4,  terrainHeight(4, -3),  -3),  // Cabin
  ][idx];
}

function defaultRot(idx) {
  return [
    new THREE.Euler(0,  0.3,  0),   // Tree
    new THREE.Euler(0,  0.8,  0.1), // Rock
    new THREE.Euler(0, -0.5,  0),   // Cabin
  ][idx];
}

function applyTransformSliders() {
  if (!S.selectedObj) return;
  const g = id => parseFloat(document.getElementById(id).value);
  const tx = g('tx'), ty = g('ty'), tz = g('tz');
  const rx = g('rx'), ry = g('ry'), rz = g('rz');
  const sx = g('sx'), sy = g('sy'), sz = g('sz');

  ['tx','ty','tz'].forEach(id =>
    document.getElementById(id + '-v').textContent = parseFloat(document.getElementById(id).value).toFixed(1));
  ['rx','ry','rz'].forEach(id =>
    document.getElementById(id + '-v').textContent = document.getElementById(id).value + '°');
  ['sx','sy','sz'].forEach(id =>
    document.getElementById(id + '-v').textContent = parseFloat(document.getElementById(id).value).toFixed(2));

  S.selectedObj.worldPos.set(tx, ty, tz);
  S.selectedObj.worldRot.set(
    THREE.MathUtils.degToRad(rx),
    THREE.MathUtils.degToRad(ry),
    THREE.MathUtils.degToRad(rz)
  );
  S.selectedObj.worldScale.set(sx, sy, sz);

  applyObjectMatrix(S.selectedObj);
  updateMatrixDisplay(S.selectedObj);
}

function syncTransformSliders() {
  if (!S.selectedObj) return;
  const p = S.selectedObj.worldPos;
  const r = S.selectedObj.worldRot;
  const sc = S.selectedObj.worldScale;

  document.getElementById('tx').value = p.x;  document.getElementById('tx-v').textContent = p.x.toFixed(1);
  document.getElementById('ty').value = p.y;  document.getElementById('ty-v').textContent = p.y.toFixed(1);
  document.getElementById('tz').value = p.z;  document.getElementById('tz-v').textContent = p.z.toFixed(1);
  ['rx','ry','rz'].forEach((id, i) => {
    const deg = THREE.MathUtils.radToDeg([r.x, r.y, r.z][i]).toFixed(0);
    document.getElementById(id).value = deg;
    document.getElementById(id + '-v').textContent = deg + '°';
  });
  document.getElementById('sx').value = sc.x; document.getElementById('sx-v').textContent = sc.x.toFixed(2);
  document.getElementById('sy').value = sc.y; document.getElementById('sy-v').textContent = sc.y.toFixed(2);
  document.getElementById('sz').value = sc.z; document.getElementById('sz-v').textContent = sc.z.toFixed(2);

  ensureObjTransformState(S.selectedObj);
  const planeEl = document.getElementById('reflect-plane');
  if (planeEl) planeEl.value = S.selectedObj.reflectPlane || '';
  const sh = S.selectedObj.shear;
  ['sh-xy','sh-xz','sh-yx','sh-yz','sh-zx','sh-zy'].forEach(id => {
    const key = id.slice(3);
    const v = sh[key];
    document.getElementById(id).value = v;
    document.getElementById(id + '-v').textContent = v.toFixed(2);
  });
}

// Build the composed T . R . S . Shear . Reflect matrix into the pre-allocated
// _T scratchpad. Reuses the same scratchpads on every call.
export function composeObjectMatrix(def) {
  ensureObjTransformState(def);

  // Translate by the REFLECTED world position so "reflect this object across
  // the YZ plane" actually moves it to the other side of the world, not just
  // flips its internal geometry. def.worldPos itself is left untouched so the
  // T slider keeps its canonical value and toggling reflection is reversible.
  let tx = def.worldPos.x, ty = def.worldPos.y, tz = def.worldPos.z;
  if (def.reflectPlane === 'yz')      tx = -tx;
  else if (def.reflectPlane === 'xz') ty = -ty;
  else if (def.reflectPlane === 'xy') tz = -tz;
  _T.makeTranslation(tx, ty, tz);

  _Euler.set(def.worldRot.x, def.worldRot.y, def.worldRot.z, 'XYZ');
  _R.makeRotationFromEuler(_Euler);
  _S.makeScale(def.worldScale.x, def.worldScale.y, def.worldScale.z);

  // Shear: x' = x + xy*y + xz*z, y' = y + yx*x + yz*z, z' = z + zx*x + zy*y
  _Sh.identity();
  const sh = def.shear;
  _Sh.elements[1]  = sh.xy;   // M[0,1]
  _Sh.elements[2]  = sh.xz;   // M[0,2]
  _Sh.elements[4]  = sh.yx;   // M[1,0]
  _Sh.elements[6]  = sh.yz;   // M[1,2]
  _Sh.elements[8]  = sh.zx;   // M[2,0]
  _Sh.elements[9]  = sh.zy;   // M[2,1]

  // Reflect: mirror exactly one axis based on the selected plane
  let sx = 1, sy = 1, sz = 1;
  if (def.reflectPlane === 'yz') sx = -1;
  else if (def.reflectPlane === 'xz') sy = -1;
  else if (def.reflectPlane === 'xy') sz = -1;
  _Refl.makeScale(sx, sy, sz);

  // M = T(reflected) . R . S . Sh . Refl  (rightmost applied to vertex first)
  _T.multiply(_R).multiply(_S).multiply(_Sh).multiply(_Refl);
  return _T;
}

// Apply the composed matrix to def.reprGroup and mark it as manually controlled.
// Called from buildRepr so reflection/shear survive any path that rebuilds
// the group (representation changes, stage toggles, slider drags).
export function applyObjectMatrix(def) {
  if (!def) return;
  composeObjectMatrix(def);
  if (def.reprGroup) {
    def.reprGroup.matrixAutoUpdate = false;
    def.reprGroup.matrix.copy(_T);
    def.reprGroup.updateMatrixWorld(true);
  }
}

export function updateMatrixDisplay(def) {
  if (!def?.reprGroup) return;
  def.reprGroup.updateMatrixWorld(true);
  const m = def.reprGroup.matrixWorld.elements; // Column-major
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      const cell = document.getElementById(`mc-${row * 4 + col}`);
      if (!cell) continue;
      const newVal = m[col * 4 + row].toFixed(2);
      if (cell.textContent !== newVal) {
        cell.textContent = newVal;
        cell.classList.add('flash');
        setTimeout(() => cell.classList.remove('flash'), 400);
      }
    }
  }
}

export function updateDetail1() {
  const sel = document.getElementById('s2-selected');
  if (!sel) return;
  if (!S.selectedObj) { sel.textContent = 'None'; return; }
  sel.textContent = S.selectedObj.name;
  syncTransformSliders();
  updateMatrixDisplay(S.selectedObj);
}
