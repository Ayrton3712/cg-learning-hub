// Stage 3 — Lighting
// Handles ambient/diffuse/specular/shadow toggles, sun azimuth/elevation/intensity sliders,
// and the Stage 3 detail panel.

import { S } from './pipeline_3d_state.js';
import { updateSunPosition } from './pipeline_3d_landscape.js';

export function buildDetail2() {
  document.getElementById('detail-2').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Lighting Components</div>
      <div class="detail-toggle-row"><span>Ambient</span><button class="mini-toggle on" id="s3-ambient"></button></div>
      <div class="detail-toggle-row"><span>Diffuse</span><button class="mini-toggle on" id="s3-diffuse"></button></div>
      <div class="detail-toggle-row"><span>Specular</span><button class="mini-toggle" id="s3-specular"></button></div>
      <div class="detail-toggle-row"><span>Shadows</span><button class="mini-toggle on" id="s3-shadow"></button></div>
    </div>
    <div id="specular-controls" class="detail-section" style="display:none">
      <div class="slider-row"><label>Rough</label><input type="range" id="roughness" min="0" max="1" step="0.05" value="0.6"><span class="slider-val" id="rough-v">0.60</span></div>
      <div class="slider-row"><label>Metal</label><input type="range" id="metalness" min="0" max="1" step="0.05" value="0.1"><span class="slider-val" id="metal-v">0.10</span></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Sun</div>
      <div class="slider-row"><label>Az</label><input type="range" id="sun-az" min="0" max="360" step="1" value="${S.sunAzimuth}"><span class="slider-val" id="sun-az-v">${S.sunAzimuth}°</span></div>
      <div class="slider-row"><label>El</label><input type="range" id="sun-el" min="5" max="90" step="1" value="${S.sunElevation}"><span class="slider-val" id="sun-el-v">${S.sunElevation}°</span></div>
      <div class="slider-row"><label>Int</label><input type="range" id="lint" min="0" max="3" step="0.05" value="1"><span class="slider-val" id="lint-v">1.00</span></div>
    </div>
  `;

  document.getElementById('s3-ambient').addEventListener('click', function() {
    S.s3AmbientOn = !S.s3AmbientOn;
    this.classList.toggle('on', S.s3AmbientOn);
    if (S.ambientLight) S.ambientLight.visible = S.s3AmbientOn && S.stages[2];
  });

  document.getElementById('s3-diffuse').addEventListener('click', function() {
    S.s3DiffuseOn = !S.s3DiffuseOn;
    this.classList.toggle('on', S.s3DiffuseOn);
    if (S.dirLight) S.dirLight.intensity = S.s3DiffuseOn ? parseFloat(document.getElementById('lint').value) : 0;
  });

  document.getElementById('s3-specular').addEventListener('click', function() {
    S.s3SpecularOn = !S.s3SpecularOn;
    this.classList.toggle('on', S.s3SpecularOn);
    document.getElementById('specular-controls').style.display = S.s3SpecularOn ? '' : 'none';
  });

  document.getElementById('s3-shadow').addEventListener('click', function() {
    S.s3ShadowOn = !S.s3ShadowOn;
    this.classList.toggle('on', S.s3ShadowOn);
    S.renderer.shadowMap.enabled = S.s3ShadowOn && S.stages[2];
  });

  ['roughness', 'metalness'].forEach(id => {
    document.getElementById(id).addEventListener('input', function() {
      const suf = id === 'roughness' ? 'rough' : 'metal';
      document.getElementById(suf + '-v').textContent = parseFloat(this.value).toFixed(2);
      if (!S.selectedObj?.reprGroup) return;
      S.selectedObj.reprGroup.traverse(obj => {
        if (obj.isMesh && obj.material?.isMeshStandardMaterial) {
          obj.material[id] = parseFloat(this.value);
          obj.material.needsUpdate = true;
        }
      });
    });
  });

  document.getElementById('sun-az').addEventListener('input', function() {
    S.sunAzimuth = parseInt(this.value);
    document.getElementById('sun-az-v').textContent = this.value + '°';
    updateSunPosition();
  });

  document.getElementById('sun-el').addEventListener('input', function() {
    S.sunElevation = parseInt(this.value);
    document.getElementById('sun-el-v').textContent = this.value + '°';
    updateSunPosition();
  });

  document.getElementById('lint').addEventListener('input', function() {
    document.getElementById('lint-v').textContent = parseFloat(this.value).toFixed(2);
    if (S.dirLight && S.s3DiffuseOn) S.dirLight.intensity = parseFloat(this.value);
  });
}
