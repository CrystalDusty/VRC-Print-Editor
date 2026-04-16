const previewCanvas = document.getElementById('previewCanvas');
const previewCtx = previewCanvas.getContext('2d', { alpha: false, desynchronized: true });
const workCanvas = document.createElement('canvas');
const workCtx = workCanvas.getContext('2d', { willReadFrequently: true });

const fileNameEl = document.getElementById('fileName');
const fileSizeEl = document.getElementById('fileSize');
const dropHintEl = document.getElementById('dropHint');

const state = {
  sourcePath: '',
  sourceImage: null,
  fitMode: 'Contain',
  zoom: 100,
  panX: 0,
  panY: 0,
  rotate: 'None',
  flip: 'None',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 100,
  warmth: 0,
  tint: 0,
  blur: 0,
  hue: 0,
  bloom: 0,
  posterize: 0,
  vignette: 0,
  grain: 0,
  scanlines: 0,
  glitch: 0,
  borderStyle: 'None',
  borderSize: 30,
  borderColor: '#e84ea5',
  stickerPack: 'None',
  stickerDensity: 12,
  stickerSize: 22,
  stickerSeed: 1,
  stamp: '',
  exportPreset: 'Keep original print size',
  exportFill: 'Black',
};

let renderQueued = false;

const controls = {
  fitMode: byId('fitMode'), zoom: byId('zoom'), panX: byId('panX'), panY: byId('panY'), rotate: byId('rotate'), flip: byId('flip'),
  brightness: byId('brightness'), contrast: byId('contrast'), saturation: byId('saturation'), sharpness: byId('sharpness'),
  warmth: byId('warmth'), tint: byId('tint'), blur: byId('blur'), hue: byId('hue'), bloom: byId('bloom'), posterize: byId('posterize'),
  vignette: byId('vignette'), grain: byId('grain'), scanlines: byId('scanlines'), glitch: byId('glitch'),
  borderStyle: byId('borderStyle'), borderSize: byId('borderSize'), borderColor: byId('borderColor'),
  stickerPack: byId('stickerPack'), stickerDensity: byId('stickerDensity'), stickerSize: byId('stickerSize'), stamp: byId('stamp'),
  exportPreset: byId('exportPreset'), exportFill: byId('exportFill'),
};

function byId(id) { return document.getElementById(id); }
function randInt(min, max, rnd = Math.random) { return Math.floor(rnd() * (max - min + 1)) + min; }
function choice(arr, rnd = Math.random) { return arr[Math.floor(rnd() * arr.length)]; }
function clamp(v) { return Math.max(0, Math.min(255, v)); }

function mulberry32(seed) {
  let t = seed >>> 0;
  return function random() {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function queueRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderPreview();
  });
}

function setCanvasSizeToDisplay(canvas, ratio = window.devicePixelRatio || 1) {
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.floor(rect.width * ratio));
  canvas.height = Math.max(1, Math.floor(rect.height * ratio));
}

function syncStateFromUI() {
  for (const [key, el] of Object.entries(controls)) {
    if (!el) continue;
    state[key] = el.type === 'range' ? Number(el.value) : el.value;
  }
}

function syncUIFromState() {
  for (const [key, el] of Object.entries(controls)) {
    if (!el) continue;
    el.value = state[key];
  }
}

function resetState() {
  Object.assign(state, {
    fitMode: 'Contain', zoom: 100, panX: 0, panY: 0, rotate: 'None', flip: 'None',
    brightness: 100, contrast: 100, saturation: 100, sharpness: 100, warmth: 0, tint: 0, blur: 0, hue: 0,
    bloom: 0, posterize: 0, vignette: 0, grain: 0, scanlines: 0, glitch: 0,
    borderStyle: 'None', borderSize: 30, borderColor: '#e84ea5',
    stickerPack: 'None', stickerDensity: 12, stickerSize: 22, stickerSeed: Date.now() & 0xffff,
    stamp: '', exportPreset: 'Keep original print size', exportFill: 'Black',
  });
  syncUIFromState();
  queueRender();
}

function randomizeState() {
  const rnd = mulberry32(Date.now() & 0xffffffff);
  Object.assign(state, {
    zoom: randInt(90, 130, rnd), panX: randInt(-40, 40, rnd), panY: randInt(-40, 40, rnd),
    brightness: randInt(88, 130, rnd), contrast: randInt(90, 160, rnd), saturation: randInt(80, 180, rnd),
    sharpness: randInt(70, 150, rnd), warmth: randInt(-30, 30, rnd), tint: randInt(-25, 25, rnd),
    blur: randInt(0, 4, rnd), hue: randInt(-40, 40, rnd), bloom: randInt(0, 45, rnd), posterize: randInt(0, 5, rnd),
    vignette: randInt(0, 55, rnd), grain: randInt(0, 50, rnd), scanlines: randInt(0, 50, rnd), glitch: randInt(0, 14, rnd),
    borderStyle: choice(['None', 'Clean', 'Neon Pulse', 'Filmstrip', 'Arcade', 'Double'], rnd),
    borderSize: randInt(8, 60, rnd), stickerPack: choice(['None', 'Stars', 'Hearts', 'Chaos', 'Sparkles'], rnd),
    stickerDensity: randInt(8, 60, rnd), stickerSize: randInt(10, 40, rnd), stickerSeed: randInt(1, 1_000_000, rnd),
  });
  syncUIFromState();
  queueRender();
}

async function loadImageFromPath(path) {
  const base64 = await window.bridge.readBuffer(path);
  const src = `data:image/*;base64,${base64}`;
  const img = new Image();
  img.src = src;
  await img.decode();
  state.sourceImage = img;
  state.sourcePath = path;
  state.stickerSeed = hashCode(path + img.width + img.height);
  fileNameEl.textContent = path.split(/[\\/]/).pop();
  fileSizeEl.textContent = `${img.width} × ${img.height}`;
  dropHintEl.textContent = 'Print loaded. Stickers are layout-locked unless you regenerate.';
  queueRender();
}

function hashCode(text) {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) - h + text.charCodeAt(i)) | 0;
  return Math.abs(h) + 1;
}

function drawSourceToWorkCanvas() {
  const img = state.sourceImage;
  if (!img) {
    workCanvas.width = 1920;
    workCanvas.height = 1080;
    workCtx.fillStyle = '#0a0e16';
    workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height);
    workCtx.fillStyle = '#8d96af';
    workCtx.font = '600 28px Segoe UI';
    workCtx.fillText('Drop or load a VRChat print to edit', 520, 540);
    return;
  }

  workCanvas.width = img.width;
  workCanvas.height = img.height;

  drawFillBackground();

  workCtx.save();
  workCtx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%) blur(${state.blur}px) hue-rotate(${state.hue}deg)`;

  let drawW = img.width;
  let drawH = img.height;
  if (state.fitMode === 'Contain') {
    const r = Math.min(workCanvas.width / img.width, workCanvas.height / img.height);
    drawW = Math.floor(img.width * r);
    drawH = Math.floor(img.height * r);
  } else if (state.fitMode === 'Cover') {
    const r = Math.max(workCanvas.width / img.width, workCanvas.height / img.height);
    drawW = Math.floor(img.width * r);
    drawH = Math.floor(img.height * r);
  } else {
    drawW = workCanvas.width;
    drawH = workCanvas.height;
  }

  const zoom = state.zoom / 100;
  drawW = Math.floor(drawW * zoom);
  drawH = Math.floor(drawH * zoom);

  const x = Math.floor((workCanvas.width - drawW) / 2 + state.panX / 100 * workCanvas.width * 0.35);
  const y = Math.floor((workCanvas.height - drawH) / 2 + state.panY / 100 * workCanvas.height * 0.35);

  workCtx.translate(workCanvas.width / 2, workCanvas.height / 2);
  if (state.rotate !== 'None') workCtx.rotate((Number(state.rotate) * Math.PI) / 180);
  workCtx.scale(state.flip === 'Horizontal' ? -1 : 1, state.flip === 'Vertical' ? -1 : 1);
  workCtx.drawImage(img, x - workCanvas.width / 2, y - workCanvas.height / 2, drawW, drawH);
  workCtx.restore();

  if (state.sharpness > 100) {
    workCtx.save();
    workCtx.globalAlpha = (state.sharpness - 100) / 120;
    workCtx.filter = 'contrast(130%)';
    workCtx.drawImage(workCanvas, 0, 0);
    workCtx.restore();
  }

  applyWarmthTint();
  applyPosterize();
  applyGlitch();
  drawBloom();
  drawVignette();
  drawGrain();
  drawScanlines();

  drawBorder();
  drawStickers();
  drawStamp();
}

function drawFillBackground() {
  if (!state.sourceImage || state.exportFill === 'Black') {
    workCtx.fillStyle = '#0a0e16';
    workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height);
    return;
  }
  if (state.exportFill === 'Blurred') {
    workCtx.filter = 'blur(30px)';
    workCtx.drawImage(state.sourceImage, 0, 0, workCanvas.width, workCanvas.height);
    workCtx.filter = 'none';
    return;
  }
  if (state.exportFill === 'Average Color') {
    const temp = document.createElement('canvas');
    temp.width = 8;
    temp.height = 8;
    const tctx = temp.getContext('2d');
    tctx.drawImage(state.sourceImage, 0, 0, 8, 8);
    const px = tctx.getImageData(0, 0, 8, 8).data;
    let r = 0; let g = 0; let b = 0;
    for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
    const n = px.length / 4;
    workCtx.fillStyle = `rgb(${Math.floor(r / n)}, ${Math.floor(g / n)}, ${Math.floor(b / n)})`;
    workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height);
  }
}

function applyWarmthTint() {
  if (state.warmth === 0 && state.tint === 0) return;
  const img = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = clamp(d[i] + state.warmth + state.tint * 0.4);
    d[i + 1] = clamp(d[i + 1] - state.tint * 0.5);
    d[i + 2] = clamp(d[i + 2] - state.warmth + state.tint * 0.4);
  }
  workCtx.putImageData(img, 0, 0);
}

function applyPosterize() {
  if (state.posterize <= 0) return;
  const levels = Math.max(2, 2 + state.posterize * 2);
  const step = 255 / (levels - 1);
  const img = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    d[i] = Math.round(d[i] / step) * step;
    d[i + 1] = Math.round(d[i + 1] / step) * step;
    d[i + 2] = Math.round(d[i + 2] / step) * step;
  }
  workCtx.putImageData(img, 0, 0);
}

function applyGlitch() {
  if (state.glitch <= 0) return;
  const layer = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const out = workCtx.createImageData(layer);
  const src = layer.data;
  const dst = out.data;
  const w = workCanvas.width;
  const h = workCanvas.height;
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = (y * w + x) * 4;
      const xr = Math.min(w - 1, Math.max(0, x + state.glitch));
      const xb = Math.min(w - 1, Math.max(0, x - state.glitch));
      const ir = (y * w + xr) * 4;
      const ib = (y * w + xb) * 4;
      dst[i] = src[ir];
      dst[i + 1] = src[i + 1];
      dst[i + 2] = src[ib + 2];
      dst[i + 3] = src[i + 3];
    }
  }
  workCtx.putImageData(out, 0, 0);
}

function drawBloom() {
  if (state.bloom <= 0) return;
  const temp = document.createElement('canvas');
  temp.width = workCanvas.width;
  temp.height = workCanvas.height;
  const tctx = temp.getContext('2d');
  tctx.filter = `blur(${Math.max(1, state.bloom / 6)}px) brightness(120%)`;
  tctx.drawImage(workCanvas, 0, 0);
  workCtx.save();
  workCtx.globalAlpha = state.bloom / 180;
  workCtx.globalCompositeOperation = 'screen';
  workCtx.drawImage(temp, 0, 0);
  workCtx.restore();
}

function drawVignette() {
  if (state.vignette <= 0) return;
  const g = workCtx.createRadialGradient(
    workCanvas.width / 2, workCanvas.height / 2, Math.min(workCanvas.width, workCanvas.height) * 0.2,
    workCanvas.width / 2, workCanvas.height / 2, Math.max(workCanvas.width, workCanvas.height) * 0.7,
  );
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${state.vignette / 120})`);
  workCtx.fillStyle = g;
  workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height);
}

function drawGrain() {
  if (state.grain <= 0) return;
  const noise = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const d = noise.data;
  const amount = state.grain * 0.45;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  workCtx.putImageData(noise, 0, 0);
}

function drawScanlines() {
  if (state.scanlines <= 0) return;
  workCtx.fillStyle = `rgba(0,0,0,${state.scanlines / 280})`;
  for (let y = 0; y < workCanvas.height; y += 4) workCtx.fillRect(0, y, workCanvas.width, 1);
}

function drawBorder() {
  if (state.borderStyle === 'None' || state.borderSize <= 0) return;
  const s = state.borderSize;
  const w = workCanvas.width;
  const h = workCanvas.height;

  if (state.borderStyle === 'Clean') {
    workCtx.strokeStyle = state.borderColor;
    workCtx.lineWidth = s;
    workCtx.strokeRect(0, 0, w, h);
    return;
  }
  if (state.borderStyle === 'Neon Pulse') {
    for (let i = 0; i < s; i += 1) {
      workCtx.strokeStyle = `rgba(232, 78, 165, ${Math.max(0.07, 1 - i / s)})`;
      workCtx.lineWidth = 1;
      workCtx.strokeRect(i, i, w - i * 2, h - i * 2);
    }
    return;
  }
  if (state.borderStyle === 'Filmstrip') {
    workCtx.strokeStyle = '#111';
    workCtx.lineWidth = s;
    workCtx.strokeRect(0, 0, w, h);
    const hole = Math.max(8, Math.floor(s / 2));
    const gap = hole * 2;
    workCtx.fillStyle = '#e8ebf6';
    for (let x = s; x < w - s; x += gap) {
      workCtx.fillRect(x, 8, hole, hole);
      workCtx.fillRect(x, h - hole - 8, hole, hole);
    }
    return;
  }
  if (state.borderStyle === 'Arcade') {
    const rainbow = ['#ff4f8b', '#ffcf4a', '#62f6a2', '#5dc5ff', '#ba7dff'];
    for (let i = 0; i < s; i += 1) {
      workCtx.strokeStyle = rainbow[i % rainbow.length];
      workCtx.lineWidth = 1;
      workCtx.strokeRect(i, i, w - i * 2, h - i * 2);
    }
    return;
  }
  if (state.borderStyle === 'Double') {
    workCtx.strokeStyle = state.borderColor;
    workCtx.lineWidth = Math.max(2, Math.floor(s / 4));
    workCtx.strokeRect(2, 2, w - 4, h - 4);
    workCtx.strokeRect(s, s, w - s * 2, h - s * 2);
  }
}

function drawStickers() {
  if (state.stickerPack === 'None' || state.stickerDensity <= 0) return;
  const rnd = mulberry32(state.stickerSeed);
  const count = Math.floor(state.stickerDensity / 2) + 4;
  const colors = ['#ff61b2', '#63cbff', '#54efb1', '#ffd75e', '#ffffff'];

  for (let i = 0; i < count; i += 1) {
    const x = randInt(20, workCanvas.width - 20, rnd);
    const y = randInt(20, workCanvas.height - 20, rnd);
    const s = randInt(Math.max(4, state.stickerSize / 3), state.stickerSize, rnd);
    workCtx.strokeStyle = choice(colors, rnd);
    workCtx.fillStyle = choice(colors, rnd);

    if (state.stickerPack === 'Stars' || state.stickerPack === 'Sparkles') {
      workCtx.beginPath();
      workCtx.moveTo(x - s, y); workCtx.lineTo(x + s, y);
      workCtx.moveTo(x, y - s); workCtx.lineTo(x, y + s);
      if (state.stickerPack === 'Sparkles') {
        workCtx.moveTo(x - s * 0.7, y - s * 0.7); workCtx.lineTo(x + s * 0.7, y + s * 0.7);
        workCtx.moveTo(x + s * 0.7, y - s * 0.7); workCtx.lineTo(x - s * 0.7, y + s * 0.7);
      }
      workCtx.stroke();
    } else if (state.stickerPack === 'Hearts') {
      workCtx.beginPath();
      workCtx.arc(x - s / 2, y - s / 2, s / 2, 0, Math.PI * 2);
      workCtx.arc(x + s / 2, y - s / 2, s / 2, 0, Math.PI * 2);
      workCtx.lineTo(x, y + s);
      workCtx.closePath();
      workCtx.fill();
    } else {
      if (rnd() > 0.5) workCtx.strokeRect(x - s, y - s, s * 2, s * 2);
      else {
        workCtx.beginPath();
        workCtx.arc(x, y, s, 0, Math.PI * 2);
        workCtx.stroke();
      }
    }
  }
}

function drawStamp() {
  if (!state.stamp.trim()) return;
  const text = state.stamp.trim();
  workCtx.font = `600 ${Math.max(16, Math.floor(workCanvas.width / 56))}px Segoe UI`;
  const tw = workCtx.measureText(text).width;
  const th = Math.max(22, Math.floor(workCanvas.width / 48));
  const x = workCanvas.width - tw - 28;
  const y = workCanvas.height - th - 22;
  workCtx.fillStyle = 'rgba(7, 12, 18, 0.75)';
  workCtx.fillRect(x - 10, y - th + 4, tw + 20, th + 10);
  workCtx.strokeStyle = '#e84ea5';
  workCtx.lineWidth = 2;
  workCtx.strokeRect(x - 10, y - th + 4, tw + 20, th + 10);
  workCtx.fillStyle = '#f5f7ff';
  workCtx.fillText(text, x, y);
}

function renderPreview() {
  drawSourceToWorkCanvas();
  setCanvasSizeToDisplay(previewCanvas);
  previewCtx.fillStyle = '#080b14';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
  const scale = Math.min(previewCanvas.width / workCanvas.width, previewCanvas.height / workCanvas.height);
  const w = workCanvas.width * scale;
  const h = workCanvas.height * scale;
  previewCtx.imageSmoothingQuality = 'high';
  previewCtx.drawImage(workCanvas, (previewCanvas.width - w) / 2, (previewCanvas.height - h) / 2, w, h);
}

function exportCanvasForPreset() {
  const out = document.createElement('canvas');
  const ctx = out.getContext('2d');
  let targetW = workCanvas.width;
  let targetH = workCanvas.height;
  if (state.exportPreset === 'VRChat Landscape 4096x2048') [targetW, targetH] = [4096, 2048];
  else if (state.exportPreset === 'VRChat Square 2048x2048') [targetW, targetH] = [2048, 2048];
  else if (state.exportPreset === 'VRChat Portrait 1536x2048') [targetW, targetH] = [1536, 2048];
  else if (state.exportPreset === 'Upscale x2') [targetW, targetH] = [workCanvas.width * 2, workCanvas.height * 2];
  out.width = targetW;
  out.height = targetH;
  ctx.drawImage(workCanvas, 0, 0, targetW, targetH);
  return out;
}

async function savePng() {
  if (!state.sourceImage) return;
  const path = await window.bridge.savePngDialog();
  if (!path) return;
  await window.bridge.writeBuffer(path, exportCanvasForPreset().toDataURL('image/png').split(',')[1]);
}

async function saveProject() {
  if (!state.sourceImage) return;
  const path = await window.bridge.saveProjectDialog();
  if (!path) return;
  await window.bridge.writeText(path, JSON.stringify({ ...state, sourceImage: null }, null, 2));
}

async function loadProject() {
  const path = await window.bridge.openProjectDialog();
  if (!path) return;
  Object.assign(state, JSON.parse(await window.bridge.readText(path)));
  syncUIFromState();
  if (state.sourcePath) await loadImageFromPath(state.sourcePath);
  queueRender();
}

async function openImage() {
  const path = await window.bridge.openImageDialog();
  if (path) await loadImageFromPath(path);
}

function activateTab(tabName) {
  document.querySelectorAll('.tab').forEach((el) => el.classList.toggle('active', el.dataset.tab === tabName));
  document.querySelectorAll('.nav-item').forEach((el) => el.classList.toggle('active', el.dataset.tab === tabName));
  document.querySelectorAll('.tab-content').forEach((el) => el.classList.toggle('active', el.id === `tab-${tabName}`));
}

function setupTabSwitching() {
  document.querySelectorAll('.tab').forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
  document.querySelectorAll('.nav-item').forEach((tab) => tab.addEventListener('click', () => activateTab(tab.dataset.tab)));
}

function setupDragDrop() {
  ['dragenter', 'dragover'].forEach((evt) => window.addEventListener(evt, (e) => { e.preventDefault(); document.body.classList.add('drag-over'); }));
  ['dragleave', 'drop'].forEach((evt) => window.addEventListener(evt, (e) => { e.preventDefault(); document.body.classList.remove('drag-over'); }));
  window.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file?.path) await loadImageFromPath(file.path);
  });
}

// ===== Neon Snake Easter Egg =====
const snake = {
  overlay: byId('snakeOverlay'),
  canvas: byId('snakeCanvas'),
  ctx: byId('snakeCanvas').getContext('2d'),
  scoreEl: byId('snakeScore'),
  closeBtn: byId('snakeClose'),
  mode: 'classic',
  running: false,
  lastTick: 0,
  cell: 20,
  cols: 30,
  rows: 21,
  speedMs: 105,
  snakeBody: [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }],
  dir: { x: 1, y: 0 },
  queuedDir: { x: 1, y: 0 },
  food: { x: 15, y: 10 },
  score: 0,
  sequence: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'],
  seqIndex: 0,
};

function setSnakeMode(mode) {
  snake.mode = mode;
  snake.speedMs = mode === 'turbo' ? 70 : 105;
  document.querySelectorAll('.snake-mode').forEach((btn) => btn.classList.toggle('active', btn.dataset.mode === mode));
  resetSnake();
}

function resetSnake() {
  snake.snakeBody = [{ x: 8, y: 10 }, { x: 7, y: 10 }, { x: 6, y: 10 }];
  snake.dir = { x: 1, y: 0 };
  snake.queuedDir = { x: 1, y: 0 };
  snake.score = 0;
  snake.scoreEl.textContent = '0';
  spawnFood();
}

function spawnFood() {
  const rnd = mulberry32((Date.now() + snake.score * 31) & 0xffffffff);
  snake.food = { x: randInt(1, snake.cols - 2, rnd), y: randInt(1, snake.rows - 2, rnd) };
}

function openSnake() {
  snake.overlay.classList.remove('hidden');
  snake.running = true;
  resetSnake();
  requestAnimationFrame(snakeLoop);
}

function closeSnake() {
  snake.running = false;
  snake.overlay.classList.add('hidden');
}

function snakeLoop(ts) {
  if (!snake.running) return;
  if (!snake.lastTick) snake.lastTick = ts;
  if (ts - snake.lastTick >= snake.speedMs) {
    snake.lastTick = ts;
    stepSnake();
  }
  drawSnake();
  requestAnimationFrame(snakeLoop);
}

function stepSnake() {
  snake.dir = snake.queuedDir;
  const head = { x: snake.snakeBody[0].x + snake.dir.x, y: snake.snakeBody[0].y + snake.dir.y };

  if (snake.mode === 'wrap') {
    if (head.x < 0) head.x = snake.cols - 1;
    if (head.x >= snake.cols) head.x = 0;
    if (head.y < 0) head.y = snake.rows - 1;
    if (head.y >= snake.rows) head.y = 0;
  } else if (head.x < 0 || head.x >= snake.cols || head.y < 0 || head.y >= snake.rows) {
    resetSnake();
    return;
  }

  if (snake.snakeBody.some((p) => p.x === head.x && p.y === head.y)) {
    resetSnake();
    return;
  }

  snake.snakeBody.unshift(head);
  if (head.x === snake.food.x && head.y === snake.food.y) {
    snake.score += 1;
    snake.scoreEl.textContent = String(snake.score);
    if (snake.mode === 'turbo') snake.speedMs = Math.max(45, snake.speedMs - 1);
    spawnFood();
  } else {
    snake.snakeBody.pop();
  }
}

function drawSnake() {
  const { ctx, canvas, cell } = snake;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gridW = snake.cols * cell;
  const gridH = snake.rows * cell;
  const ox = (canvas.width - gridW) / 2;
  const oy = (canvas.height - gridH) / 2;

  ctx.fillStyle = '#060a12';
  ctx.fillRect(ox, oy, gridW, gridH);
  ctx.strokeStyle = 'rgba(66, 86, 130, 0.2)';
  for (let x = 0; x <= snake.cols; x += 1) ctx.strokeRect(ox + x * cell, oy, 1, gridH);
  for (let y = 0; y <= snake.rows; y += 1) ctx.strokeRect(ox, oy + y * cell, gridW, 1);

  const foodX = ox + snake.food.x * cell;
  const foodY = oy + snake.food.y * cell;
  const grad = ctx.createRadialGradient(foodX + cell / 2, foodY + cell / 2, 2, foodX + cell / 2, foodY + cell / 2, cell);
  grad.addColorStop(0, '#fff5ff');
  grad.addColorStop(1, '#ff5db8');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(foodX + cell / 2, foodY + cell / 2, cell / 2.6, 0, Math.PI * 2);
  ctx.fill();

  snake.snakeBody.forEach((seg, i) => {
    const x = ox + seg.x * cell;
    const y = oy + seg.y * cell;
    ctx.shadowBlur = 18;
    ctx.shadowColor = i === 0 ? '#76d2ff' : '#e84ea5';
    ctx.fillStyle = i === 0 ? '#89e3ff' : '#ff78c5';
    roundRect(ctx, x + 2, y + 2, cell - 4, cell - 4, 7);
    ctx.fill();
  });
  ctx.shadowBlur = 0;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function setupSnakeEasterEgg() {
  snake.closeBtn.addEventListener('click', closeSnake);
  document.querySelectorAll('.snake-mode').forEach((btn) => btn.addEventListener('click', () => setSnakeMode(btn.dataset.mode)));

  window.addEventListener('keydown', (e) => {
    if (snake.running) {
      if (e.key === 'Escape') closeSnake();
      const k = e.key;
      if (k === 'ArrowUp' && snake.dir.y !== 1) snake.queuedDir = { x: 0, y: -1 };
      if (k === 'ArrowDown' && snake.dir.y !== -1) snake.queuedDir = { x: 0, y: 1 };
      if (k === 'ArrowLeft' && snake.dir.x !== 1) snake.queuedDir = { x: -1, y: 0 };
      if (k === 'ArrowRight' && snake.dir.x !== -1) snake.queuedDir = { x: 1, y: 0 };
      return;
    }

    const targetTag = e.target?.tagName || '';
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(targetTag)) return;
    const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (key === snake.sequence[snake.seqIndex]) {
      snake.seqIndex += 1;
      if (snake.seqIndex === snake.sequence.length) {
        snake.seqIndex = 0;
        openSnake();
      }
    } else {
      snake.seqIndex = key === snake.sequence[0] ? 1 : 0;
    }
  });
}

function setupListeners() {
  Object.entries(controls).forEach(([key, el]) => {
    el?.addEventListener('input', () => {
      syncStateFromUI();
      if (['stickerDensity', 'stickerPack', 'stickerSize'].includes(key)) state.stickerSeed = state.stickerSeed || 1;
      queueRender();
    });
  });

  byId('loadBtn').addEventListener('click', openImage);
  byId('randomBtn').addEventListener('click', randomizeState);
  byId('resetBtn').addEventListener('click', resetState);
  byId('savePngBtn').addEventListener('click', savePng);
  byId('saveProjectBtn').addEventListener('click', saveProject);
  byId('loadProjectBtn').addEventListener('click', loadProject);
  byId('regenStickersBtn').addEventListener('click', () => { state.stickerSeed = Date.now() & 0xffffffff; queueRender(); });
  window.addEventListener('resize', queueRender);
}

setupListeners();
setupDragDrop();
setupTabSwitching();
setupSnakeEasterEgg();
activateTab('basic');
queueRender();
