// Stage 5 - Scan Conversion
// Handles pixelation, Anti-Aliasing, pixel grid, zoom inset, and the Stage 5 detail panel

import { S } from './pipeline_3d_state.js';

const MIN_VISIBLE_GRID_STEP = 8;

export function getStage5RenderPixelSize() {
  return S.s5AAOn ? Math.max(1, S.pixelSize / 2) : S.pixelSize;
}

export function buildDetail4() {
  document.getElementById('detail-4').innerHTML = `
    <div class="detail-section">
      <div class="detail-label">Rasterization</div>
      <div class="slider-row"><label>Pix</label><input type="range" id="pix-size" min="2" max="32" step="1" value="4"><span class="slider-val" id="pix-size-v">4px</span></div>
      <div id="eff-res" class="detail-label"></div>
    </div>
    <div class="detail-section">
      <div class="detail-label">Options</div>
      <div class="detail-toggle-row"><span>Anti-aliasing</span><button class="mini-toggle" id="s5-aa"></button></div>
      <div class="detail-toggle-row"><span>Pixel Grid</span><button class="mini-toggle" id="s5-grid"></button></div>
    </div>
  `;

  document.getElementById('pix-size').addEventListener('input', function() {
    S.pixelSize = parseInt(this.value);
    document.getElementById('pix-size-v').textContent = S.pixelSize + 'px';
    updateEffRes();
  });

  document.getElementById('s5-aa').addEventListener('click', function() {
    S.s5AAOn = !S.s5AAOn;
    this.classList.toggle('on', S.s5AAOn);
    updateEffRes();
  });

  document.getElementById('s5-grid').addEventListener('click', function() {
    S.s5GridOn = !S.s5GridOn;
    this.classList.toggle('on', S.s5GridOn);
  });

}

export function applyPixelation(on) {
  document.getElementById('pixel-grid-overlay').style.display = on && S.s5GridOn ? 'block' : 'none';
  if (!on) {
    document.getElementById('main-canvas').style.imageRendering = '';
    S.resizeAll?.();
  }
  updateEffRes();
}

export function updateEffRes() {
  const wrap = document.getElementById('viewport-wrap');
  const w = wrap.clientWidth * (S.splitActive ? 0.5 : 1);
  const h = wrap.clientHeight;
  const renderPixelSize = getStage5RenderPixelSize();
  const ew = Math.floor(w / renderPixelSize);
  const eh = Math.floor(h / renderPixelSize);
  const el = document.getElementById('eff-res');
  if (el) el.textContent = `Effective: ${ew}×${eh}`;
}

function strokePixelGrid(ctx, w, h, cellW, cellH) {
  const step = Math.max(1, Math.ceil(MIN_VISIBLE_GRID_STEP / Math.min(cellW, cellH)));
  const drawLines = () => {
    for (let x = 0; x <= w + 0.01; x += cellW * step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
    }
    for (let y = 0; y <= h + 0.01; y += cellH * step) {
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
    }
  };

  ctx.save();
  ctx.beginPath();
  drawLines();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.beginPath();
  drawLines();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 0.5;
  ctx.stroke();
  ctx.restore();
}

export function drawPixelGridOverlay() {
  const overlay = document.getElementById('pixel-grid-overlay');
  const mainCanvas = document.getElementById('main-canvas');

  if (!S.stages[4] || !S.s5GridOn) {
    overlay.style.display = 'none';
    return;
  }

  const cssW = mainCanvas.clientWidth;
  const cssH = mainCanvas.clientHeight;
  if (!cssW || !cssH) return;

  const dpr = window.devicePixelRatio || 1;
  const backingW = Math.max(1, Math.floor(cssW * dpr));
  const backingH = Math.max(1, Math.floor(cssH * dpr));
  const renderPixelSize = getStage5RenderPixelSize();
  const effW = Math.max(1, Math.floor(cssW / renderPixelSize));
  const effH = Math.max(1, Math.floor(cssH / renderPixelSize));

  overlay.style.display = 'block';
  overlay.style.left = S.splitActive ? cssW + 'px' : '0';
  overlay.style.width = cssW + 'px';
  overlay.style.height = cssH + 'px';

  if (overlay.width !== backingW) overlay.width = backingW;
  if (overlay.height !== backingH) overlay.height = backingH;

  const ctx = overlay.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  strokePixelGrid(ctx, cssW, cssH, cssW / effW, cssH / effH);
}

