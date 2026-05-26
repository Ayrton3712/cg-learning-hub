// Stage 4 — Viewing Pipeline
// Handles viewing transform, clipping, hidden surface removal, projection toggles,
// camera controls, split-view, and the Stage 4 detail panel.

import { S } from './pipeline_3d_state.js';

// ─── FRUSTUM CULLING & CAMERA PROJECTION HELPERS ─────────────────────────────

/**
 * Toggle frustum culling on all meshes in the scene.
 * When enabled (true): Objects outside camera view and clipping window (near/far planes) are culled.
 * When disabled (false): All objects are rendered regardless of clipping window.
 * The camera's near/far planes define the clipping window boundaries.
 * Excludes lights and helper objects from culling to prevent shadow issues.
 * 
 * @param {boolean} enabled - If true, frustum culling is active; if false, all objects render
 */
function setFrustumCulling(enabled) {
  S.scene.traverse(obj => {
    // Only cull actual renderable objects, exclude lights and helpers
    if ((obj.isMesh || obj.isPoints || obj.isLine) && !obj.isLight) {
      // Don't cull helper objects like camera helpers
      if (!obj.name.includes('Helper') && !obj.name.includes('helper')) {
        obj.frustumCulled = enabled;
      }
    }
  });
}

/**
 * Update camera projection matrix with correct aspect ratio and sync with canvas size.
 * Call this on window resize to prevent stretched/warped view.
 */
function syncCameraProjection() {
  const wrap = document.getElementById('viewport-wrap');
  if (!wrap) return;

  // In split view the main camera renders in the right half only.
  const width = S.splitActive ? Math.floor(wrap.clientWidth / 2) : wrap.clientWidth;
  const height = wrap.clientHeight;

  if (width > 0 && height > 0 && S.camera) {
    const aspect = width / height;
    if (Math.abs(S.camera.aspect - aspect) > 0.001) {
      S.camera.aspect = aspect;
      S.camera.updateProjectionMatrix();
    }
  }
}

/**
 * Monitor window resize and sync camera projection to prevent distortion.
 */
function setupCameraResizeHandler() {
  window.addEventListener('resize', () => {
    syncCameraProjection();
  });
}

/**
 * Builds and populates the Stage 4 detail panel with viewing controls.
 *
 * This function creates an HTML interface for controlling the viewing transform pipeline
 * stage, including toggles for viewing transform, clipping planes, hidden surface removal,
 * and projection type. It also provides sliders for camera field of view and position
 * adjustments. Event listeners are attached to synchronize the UI controls with the 3D
 * scene state managed in {@link S}.
 */
export function buildDetail3() {
  document.getElementById('detail-3').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Sub-stages</div>
      <div class="detail-toggle-row"><span>1. Viewing Transform</span><button class="mini-toggle" id="s4-viewing"></button></div>
      <div class="detail-toggle-row"><span>2. Clipping</span><button class="mini-toggle" id="s4-clip"></button></div>
      <div class="detail-toggle-row"><span>3. Hidden Surface</span><button class="mini-toggle on" id="s4-hsr"></button></div>
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
  `;
  
  attachDetail3Listeners();
  setupCameraResizeHandler();
}

/**
 * Updates the Stage 4 detail panel UI state and reattaches event listeners.
 *
 * This function is called whenever the detail panel is opened to ensure all buttons
 * reflect the current state and event listeners are properly wired.
 */
export function updateDetail3() {
  // Sync button visual states
  const s4ViewingBtn = document.getElementById('s4-viewing');
  const s4ClipBtn = document.getElementById('s4-clip');
  const s4HSRBtn = document.getElementById('s4-hsr');

  if (s4ViewingBtn) s4ViewingBtn.classList.toggle('on', S.s4ViewingOn);
  if (s4ClipBtn) s4ClipBtn.classList.toggle('on', S.s4ClipOn);
  if (s4HSRBtn) s4HSRBtn.classList.toggle('on', S.s4HSROn);

  // Show/hide dependent controls
  const clipControls = document.getElementById('s4-clip-controls');
  if (clipControls) clipControls.style.display = S.s4ClipOn ? '' : 'none';

  // Reattach listeners
  attachDetail3Listeners();
}

function attachDetail3Listeners() {
  // ========== 1. VIEWING TRANSFORM TOGGLE ==========
  // On: Split-view (camera view + god's eye)
  // Off: Single view (camera only)
  const s4ViewingBtn = document.getElementById('s4-viewing');
  if (s4ViewingBtn) {
    s4ViewingBtn.onclick = function() {
      S.s4ViewingOn = !S.s4ViewingOn;
      this.classList.toggle('on', S.s4ViewingOn);
      applySplitView(!S.s4ViewingOn);
    };
  }

  // ========== 2. CLIPPING ==========
  // Shows clipping window visualization in god's eye view (always when Clipping is ON)
  // Only applies actual clipping (removes objects) when Hidden Surface Removal is also ON
  const s4ClipBtn = document.getElementById('s4-clip');
  if (s4ClipBtn) {
    s4ClipBtn.onclick = function() {
      S.s4ClipOn = !S.s4ClipOn;
      this.classList.toggle('on', S.s4ClipOn);
      const clipControls = document.getElementById('s4-clip-controls');
      if (clipControls) clipControls.style.display = S.s4ClipOn ? '' : 'none';
      
      // Show/hide clipping window visualization in god's eye
      if (S.s4ClipOn && S.cameraHelper) {
        // Always show clipping window when Clipping is ON (regardless of HSR)
        S.cameraHelper.visible = true;
      } else if (!S.s4ClipOn && S.cameraHelper) {
        // Hide clipping window only when Clipping is OFF
        S.cameraHelper.visible = false;
      }
      
      // Reset camera planes only if clipping is turned OFF and HSR is ON
      if (!S.s4ClipOn && S.s4HSROn) {
        S.camera.near = 0.1;
        S.camera.far = 200;
        S.camera.updateProjectionMatrix();
      }
    };
  }

  // Clipping: Near plane control
  // Updates clipping window visualization; only applies clipping if both Clipping and HSR are ON
  const s4NearInput = document.getElementById('s4-near');
  if (s4NearInput) {
    s4NearInput.oninput = function() {
      S.s4NearVal = parseFloat(this.value);
      const nearVal = document.getElementById('s4-near-v');
      if (nearVal) nearVal.textContent = S.s4NearVal.toFixed(2);
      // Always update camera planes when Clipping is ON (for visualization)
      // But only apply culling if HSR is also ON
      if (S.s4ClipOn && S.s4HSROn) {
        S.camera.near = S.s4NearVal;
        S.camera.updateProjectionMatrix();
        if (S.cameraHelper) S.cameraHelper.update();
      }
    };
  }

  // Clipping: Far plane control
  // Updates clipping window visualization; only applies clipping if both Clipping and HSR are ON
  const s4FarInput = document.getElementById('s4-far');
  if (s4FarInput) {
    s4FarInput.oninput = function() {
      S.s4FarVal = parseFloat(this.value);
      const farVal = document.getElementById('s4-far-v');
      if (farVal) farVal.textContent = S.s4FarVal;
      // Always update camera planes when Clipping is ON (for visualization)
      // But only apply culling if HSR is also ON
      if (S.s4ClipOn && S.s4HSROn) {
        S.camera.far = S.s4FarVal;
        S.camera.updateProjectionMatrix();
        if (S.cameraHelper) S.cameraHelper.update();
      }
    };
  }

  // ========== 3. HIDDEN SURFACE REMOVAL ==========
  // On: Frustum culling active - objects outside clipping window (near/far planes) are cut/not rendered
  // Off: All objects rendered - clipping is disabled, objects inside and outside clipping window both remain visible
  const s4HSRBtn = document.getElementById('s4-hsr');
  if (s4HSRBtn) {
    s4HSRBtn.onclick = function() {
      S.s4HSROn = !S.s4HSROn;
      this.classList.toggle('on', S.s4HSROn);
      // When ON: Enable frustum culling to respect camera's near/far clipping planes
      // When OFF: Disable culling AND reset to default clipping planes so all objects remain visible
      setFrustumCulling(S.s4HSROn);
      if (!S.s4HSROn) {
        // Reset clipping to default when HSR is OFF
        S.camera.near = 0.1;
        S.camera.far = 200;
        S.camera.updateProjectionMatrix();
      }
      // Always sync cameraHelper visibility based on Clipping state, regardless of HSR
      if (S.cameraHelper) {
        S.cameraHelper.visible = S.s4ClipOn;
      }
      // Also toggle material rendering side for proper hidden surface removal
      S.objectDefs.forEach(def => {
        if (!def.reprGroup) return;
        def.reprGroup.traverse(obj => {
          if (obj.isMesh && obj.material) {
            obj.material.side = S.s4HSROn ? THREE.FrontSide : THREE.DoubleSide;
            obj.material.needsUpdate = true;
          }
        });
      });
    };
  }

  const camFovInput = document.getElementById('cam-fov');
  if (camFovInput) {
    camFovInput.oninput = function() {
      const fovVal = document.getElementById('cam-fov-v');
      if (fovVal) fovVal.textContent = this.value + '°';
      S.camera.fov = parseInt(this.value);
      S.camera.updateProjectionMatrix();
      if (S.cameraHelper) S.cameraHelper.update();
    };
  }

  ['cam-x', 'cam-y', 'cam-z'].forEach(id => {
    const input = document.getElementById(id);
    if (input) {
      input.oninput = function() {
        const valEl = document.getElementById(id + '-v');
        if (valEl) valEl.textContent = parseFloat(this.value).toFixed(1);
        S.camera.position.set(
          parseFloat(document.getElementById('cam-x').value),
          parseFloat(document.getElementById('cam-y').value),
          parseFloat(document.getElementById('cam-z').value)
        );
        S.camera.lookAt(S.orbit.target);
        if (S.cameraHelper) S.cameraHelper.update();
      };
    }
  });
}

/**
 * Activates or deactivates split-view mode to display both god-eye and camera perspectives.
 *
 * When enabled, the viewport is split to show two simultaneous views: the orthogonal
 * god-eye camera and the perspective camera. The render loop shows {@link S.cameraHelper}
 * only during the god-eye pass to aid in understanding camera positioning. When disabled,
 * only the main perspective view is shown.
 *
 * @param {boolean} on - If `true`, split-view mode is activated; if `false`, it is
 *                       deactivated.
 */
export function applySplitView(on) {
  S.splitActive = on;
  const godCanvas = document.getElementById('god-eye-canvas');
  godCanvas.classList.toggle('split-active', on);
  document.getElementById('label-god').style.display = on ? 'block' : 'none';
  document.getElementById('label-cam').style.display = on ? 'block' : 'none';
  S.cameraHelper.visible = false;
  S.resizeAll?.();
}


/**
 * Gets or creates an orthographic camera synchronized with the current viewport.
 *
 * This function returns an orthographic camera suitable for the god-eye perspective in
 * split-view mode. If the camera does not yet exist, it is created. The camera is
 * configured to match the current viewport dimensions and near/far clipping planes. In
 * split-view mode, the viewport is halved. The orthographic half-size is fixed at 5
 * world units to frame the default demo scene; if scene scale changes, this value should
 * be made configurable. The camera position and rotation are kept in sync with the
 * perspective {@link S.camera}.
 *
 * @returns {THREE.OrthographicCamera} The orthographic camera configured for the current
 *                                     viewport and scene state.
 */
export function getOrthoCamera() {
  const wrap = document.getElementById('viewport-wrap');
  const W = wrap.clientWidth * (S.splitActive ? 0.5 : 1);
  const H = wrap.clientHeight;
  const aspect = W / Math.max(H, 1);
  const ORTHO_HALF_SIZE = 5;
  if (!S.orthoCamera) {
    S.orthoCamera = new THREE.OrthographicCamera(-ORTHO_HALF_SIZE * aspect, ORTHO_HALF_SIZE * aspect, ORTHO_HALF_SIZE, -ORTHO_HALF_SIZE, S.camera.near, S.camera.far);
  } else {
    S.orthoCamera.left = -ORTHO_HALF_SIZE * aspect;
    S.orthoCamera.right = ORTHO_HALF_SIZE * aspect;
    S.orthoCamera.top = ORTHO_HALF_SIZE;
    S.orthoCamera.bottom = -ORTHO_HALF_SIZE;
    S.orthoCamera.near = S.camera.near;
    S.orthoCamera.far = S.camera.far;
    S.orthoCamera.updateProjectionMatrix();
  }
  S.orthoCamera.position.copy(S.camera.position);
  S.orthoCamera.rotation.copy(S.camera.rotation);
  return S.orthoCamera;
}

// Export helper functions for external use (e.g., initialization)
export { setFrustumCulling, syncCameraProjection, setupCameraResizeHandler };
