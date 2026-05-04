// Stage 4 — Viewing Pipeline
// Handles viewing transform, clipping, hidden surface removal, projection toggles,
// camera controls, split-view, and the Stage 4 detail panel.

import { S } from './pipeline_3d_state.js';

export function buildDetail3() {
  document.getElementById('detail-3').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Sub-stages</div>
      <div class="detail-toggle-row"><span>1. Viewing Transform</span><button class="mini-toggle" id="s4-viewing"></button></div>
      <div class="detail-toggle-row"><span>2. Clipping</span><button class="mini-toggle" id="s4-clip"></button></div>
      <div class="detail-toggle-row"><span>3. Hidden Surface</span><button class="mini-toggle on" id="s4-hsr"></button></div>
      <div class="detail-toggle-row"><span>4. Projection</span><button class="mini-toggle" id="s4-proj"></button></div>
    </div>
    <div id="s4-clip-controls" class="detail-section" style="display:none">
      <div class="slider-row"><label>Near</label><input type="range" id="s4-near" min="0.01" max="5" step="0.01" value="0.1"><span class="slider-val" id="s4-near-v">0.10</span></div>
      <div class="slider-row"><label>Far</label><input type="range" id="s4-far" min="5" max="200" step="1" value="200"><span class="slider-val" id="s4-far-v">200</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Camera</div>
      <div class="slider-row"><label>FOV</label><input type="range" id="cam-fov" min="20" max="120" step="1" value="60"><span class="slider-val" id="cam-fov-v">60°</span></div>
      <div class="slider-row"><label>CamX</label><input type="range" id="cam-x" min="-10" max="10" step="0.1" value="5"><span class="slider-val" id="cam-x-v">5.0</span></div>
      <div class="slider-row"><label>CamY</label><input type="range" id="cam-y" min="0" max="15" step="0.1" value="4"><span class="slider-val" id="cam-y-v">4.0</span></div>
      <div class="slider-row"><label>CamZ</label><input type="range" id="cam-z" min="-10" max="10" step="0.1" value="7"><span class="slider-val" id="cam-z-v">7.0</span></div>
    </div>
    <div id="proj-label" class="detail-section" style="display:none">
      <div class="notice-box">Projection: Orthographic</div>
    </div>
  `;

  document.getElementById('s4-viewing').addEventListener('click', function() {
    S.s4ViewingOn = !S.s4ViewingOn;
    this.classList.toggle('on', S.s4ViewingOn);
    if (!S.viewAxesHelper && S.s4ViewingOn) {
      S.viewAxesHelper = new THREE.AxesHelper(2);
      S.scene.add(S.viewAxesHelper);
    } else if (S.viewAxesHelper) {
      S.viewAxesHelper.visible = S.s4ViewingOn;
    }
  });

  document.getElementById('s4-clip').addEventListener('click', function() {
    S.s4ClipOn = !S.s4ClipOn;
    this.classList.toggle('on', S.s4ClipOn);
    document.getElementById('s4-clip-controls').style.display = S.s4ClipOn ? '' : 'none';
    if (!S.s4ClipOn) {
      S.camera.near = 0.1;
      S.camera.far = 200;
      S.camera.updateProjectionMatrix();
    }
  });

  document.getElementById('s4-near').addEventListener('input', function() {
    S.s4NearVal = parseFloat(this.value);
    document.getElementById('s4-near-v').textContent = S.s4NearVal.toFixed(2);
    S.camera.near = S.s4NearVal;
    S.camera.updateProjectionMatrix();
    if (S.cameraHelper) S.cameraHelper.update();
  });

  document.getElementById('s4-far').addEventListener('input', function() {
    S.s4FarVal = parseFloat(this.value);
    document.getElementById('s4-far-v').textContent = S.s4FarVal;
    S.camera.far = S.s4FarVal;
    S.camera.updateProjectionMatrix();
    if (S.cameraHelper) S.cameraHelper.update();
  });

  document.getElementById('s4-hsr').addEventListener('click', function() {
    S.s4HSROn = !S.s4HSROn;
    this.classList.toggle('on', S.s4HSROn);
    S.objectDefs.forEach(def => {
      if (!def.reprGroup) return;
      def.reprGroup.traverse(obj => {
        if (obj.isMesh && obj.material) {
          obj.material.side = S.s4HSROn ? THREE.FrontSide : THREE.DoubleSide;
          obj.material.needsUpdate = true;
        }
      });
    });
  });

  document.getElementById('s4-proj').addEventListener('click', function() {
    S.s4ProjOn = !S.s4ProjOn;
    this.classList.toggle('on', S.s4ProjOn);
    document.getElementById('proj-label').style.display = S.s4ProjOn ? '' : 'none';
  });

  document.getElementById('cam-fov').addEventListener('input', function() {
    document.getElementById('cam-fov-v').textContent = this.value + '°';
    S.camera.fov = parseInt(this.value);
    S.camera.updateProjectionMatrix();
    if (S.cameraHelper) S.cameraHelper.update();
  });

  ['cam-x', 'cam-y', 'cam-z'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      document.getElementById(id + '-v').textContent = parseFloat(this.value).toFixed(1);
      S.camera.position.set(
        parseFloat(document.getElementById('cam-x').value),
        parseFloat(document.getElementById('cam-y').value),
        parseFloat(document.getElementById('cam-z').value)
      );
      S.camera.lookAt(S.orbit.target);
      if (S.cameraHelper) S.cameraHelper.update();
    });
  });
}

export function applySplitView(on) {
  S.splitActive = on;
  const godCanvas = document.getElementById('god-eye-canvas');
  godCanvas.classList.toggle('split-active', on);
  document.getElementById('label-god').style.display = on ? 'block' : 'none';
  document.getElementById('label-cam').style.display = on ? 'block' : 'none';
  S.cameraHelper.visible = on;
  S.resizeAll?.();
}

export function getOrthoCamera() {
  const wrap = document.getElementById('viewport-wrap');
  const W = wrap.clientWidth * (S.splitActive ? 0.5 : 1);
  const H = wrap.clientHeight;
  const aspect = W / Math.max(H, 1);
  if (!S.orthoCamera) {
    S.orthoCamera = new THREE.OrthographicCamera(-5 * aspect, 5 * aspect, 5, -5, S.camera.near, S.camera.far);
  } else {
    S.orthoCamera.left = -5 * aspect;
    S.orthoCamera.right = 5 * aspect;
    S.orthoCamera.near = S.camera.near;
    S.orthoCamera.far = S.camera.far;
    S.orthoCamera.updateProjectionMatrix();
  }
  S.orthoCamera.position.copy(S.camera.position);
  S.orthoCamera.rotation.copy(S.camera.rotation);
  return S.orthoCamera;
}
