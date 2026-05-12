// Stage 5 — Scan Conversion
// Handles pixelation, AA, raster sweep, pixel grid, zoom inset,
// and the Stage 5 detail panel.

import { S } from './pipeline_3d_state.js';

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
      <div class="detail-toggle-row"><span>Raster Sweep</span><button class="mini-toggle" id="s5-scan"></button></div>
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

  document.getElementById('s5-scan').addEventListener('click', function() {
    S.s5ScanlineOn = !S.s5ScanlineOn;
    this.classList.toggle('on', S.s5ScanlineOn);
    if (S.s5ScanlineOn) S.scanlineY = 0;
  });

  document.getElementById('s5-grid').addEventListener('click', function() {
    S.s5GridOn = !S.s5GridOn;
    this.classList.toggle('on', S.s5GridOn);
  });

  // Zoom inset drag
  const zoomInset = document.getElementById('zoom-inset');
  let zoomDragging = false, zoomDragOX = 0, zoomDragOY = 0;

  zoomInset.addEventListener('mousedown', e => {
    zoomDragging = true;
    zoomDragOX = e.clientX - zoomInset.offsetLeft;
    zoomDragOY = e.clientY - zoomInset.offsetTop;
    e.stopPropagation();
  });
  document.addEventListener('mousemove', e => {
    if (!zoomDragging) return;
    const wrap = document.getElementById('viewport-wrap');
    const rect = wrap.getBoundingClientRect();
    let nx = e.clientX - rect.left - zoomDragOX;
    let ny = e.clientY - rect.top - zoomDragOY;
    nx = Math.max(0, Math.min(wrap.clientWidth - zoomInset.offsetWidth, nx));
    ny = Math.max(0, Math.min(wrap.clientHeight - zoomInset.offsetHeight, ny));
    zoomInset.style.left = nx + 'px';
    zoomInset.style.top = ny + 'px';
    zoomInset.style.bottom = 'auto';
  });
  document.addEventListener('mouseup', () => { zoomDragging = false; });
}

export function applyPixelation(on) {
  document.getElementById('zoom-inset').style.display = on ? 'block' : 'none';
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

function drawRasterSweep(ctx, w, h) {
  const y = Math.floor(S.scanlineY % h);
  const rowHeight = Math.max(2, Math.min(12, S.pixelSize));
  const scanlineColor = getComputedStyle(document.documentElement)
    .getPropertyValue('--accent-scanline')
    .trim() || 'rgba(0,112,192,0.75)';

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(0, Math.min(h, y + rowHeight), w, Math.max(0, h - y - rowHeight));

  ctx.fillStyle = scanlineColor;
  ctx.globalAlpha = 0.18;
  ctx.fillRect(0, y, w, rowHeight);

  ctx.globalAlpha = 1;
  ctx.strokeStyle = scanlineColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, y + 0.5);
  ctx.lineTo(w, y + 0.5);
  ctx.stroke();
  ctx.restore();
}

export function drawZoomInset() {
  if (!S.stages[4]) return;
  const mainCanvas = document.getElementById('main-canvas');
  const zoomCanvas = document.getElementById('zoom-canvas');
  const zoomCtx = zoomCanvas.getContext('2d');
  const w = zoomCanvas.width;
  const h = zoomCanvas.height;
  const srcW = mainCanvas.width;
  const srcH = mainCanvas.height;
  const cropW = Math.floor(srcW / 6);
  const cropH = Math.floor(srcH / 6);
  const cropX = Math.floor((srcW - cropW) / 2);
  const cropY = Math.floor((srcH - cropH) / 2);

  zoomCtx.clearRect(0, 0, w, h);
  zoomCtx.imageSmoothingEnabled = S.s5AAOn;
  zoomCtx.imageSmoothingQuality = S.s5AAOn ? 'high' : 'low';
  zoomCtx.drawImage(mainCanvas, cropX, cropY, cropW, cropH, 0, 0, w, h);

  if (S.s5ScanlineOn) drawRasterSweep(zoomCtx, w, h);

  if (S.s5GridOn) {
    const cellW = w / (cropW / S.pixelSize);
    const cellH = h / (cropH / S.pixelSize);
    zoomCtx.strokeStyle = 'rgba(40,60,140,0.45)';
    zoomCtx.lineWidth = 0.5;
    for (let x = 0; x < w; x += cellW) {
      zoomCtx.beginPath(); zoomCtx.moveTo(x, 0); zoomCtx.lineTo(x, h); zoomCtx.stroke();
    }
    for (let y = 0; y < h; y += cellH) {
      zoomCtx.beginPath(); zoomCtx.moveTo(0, y); zoomCtx.lineTo(w, y); zoomCtx.stroke();
    }
  }
}
