// Stage 2 - Modeling Transformation
// Handles the per-object transform sliders, 4x4 matrix display, and the Stage 2 detail panel.

import { S } from './pipeline_3d_state.js';
import { terrainHeight } from './pipeline_3d_landscape.js';

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

  document.getElementById('reset-transform').addEventListener('click', () => {
    if (!S.selectedObj) return;
    const idx = S.objectDefs.indexOf(S.selectedObj);
    S.selectedObj.worldPos.copy(defaultPos(idx));
    S.selectedObj.worldRot.copy(defaultRot(idx));
    S.selectedObj.worldScale.set(1, 1, 1);
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

  if (S.selectedObj.reprGroup && S.stages[1]) {
    S.selectedObj.reprGroup.position.copy(S.selectedObj.worldPos);
    S.selectedObj.reprGroup.rotation.copy(S.selectedObj.worldRot);
    S.selectedObj.reprGroup.scale.copy(S.selectedObj.worldScale);
  }
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
