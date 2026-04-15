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
  rotate: 'None',
  flip: 'None',
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 100,
  warmth: 0,
  tint: 0,
  vignette: 0,
  grain: 0,
  glitch: 0,
  borderStyle: 'None',
  borderSize: 30,
  borderColor: '#e84ea5',
  stickerPack: 'None',
  stickerDensity: 12,
  stamp: '',
  exportPreset: 'Keep original print size',
};

let renderQueued = false;

const controls = {
  fitMode: byId('fitMode'), rotate: byId('rotate'), flip: byId('flip'),
  brightness: byId('brightness'), contrast: byId('contrast'), saturation: byId('saturation'), sharpness: byId('sharpness'),
  warmth: byId('warmth'), tint: byId('tint'), vignette: byId('vignette'), grain: byId('grain'), glitch: byId('glitch'),
  borderStyle: byId('borderStyle'), borderSize: byId('borderSize'), borderColor: byId('borderColor'),
  stickerPack: byId('stickerPack'), stickerDensity: byId('stickerDensity'), stamp: byId('stamp'), exportPreset: byId('exportPreset'),
};

function byId(id) { return document.getElementById(id); }

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
  state.fitMode = controls.fitMode.value;
  state.rotate = controls.rotate.value;
  state.flip = controls.flip.value;
  state.brightness = Number(controls.brightness.value);
  state.contrast = Number(controls.contrast.value);
  state.saturation = Number(controls.saturation.value);
  state.sharpness = Number(controls.sharpness.value);
  state.warmth = Number(controls.warmth.value);
  state.tint = Number(controls.tint.value);
  state.vignette = Number(controls.vignette.value);
  state.grain = Number(controls.grain.value);
  state.glitch = Number(controls.glitch.value);
  state.borderStyle = controls.borderStyle.value;
  state.borderSize = Number(controls.borderSize.value);
  state.borderColor = controls.borderColor.value;
  state.stickerPack = controls.stickerPack.value;
  state.stickerDensity = Number(controls.stickerDensity.value);
  state.stamp = controls.stamp.value;
  state.exportPreset = controls.exportPreset.value;
}

function syncUIFromState() {
  controls.fitMode.value = state.fitMode;
  controls.rotate.value = state.rotate;
  controls.flip.value = state.flip;
  controls.brightness.value = state.brightness;
  controls.contrast.value = state.contrast;
  controls.saturation.value = state.saturation;
  controls.sharpness.value = state.sharpness;
  controls.warmth.value = state.warmth;
  controls.tint.value = state.tint;
  controls.vignette.value = state.vignette;
  controls.grain.value = state.grain;
  controls.glitch.value = state.glitch;
  controls.borderStyle.value = state.borderStyle;
  controls.borderSize.value = state.borderSize;
  controls.borderColor.value = state.borderColor;
  controls.stickerPack.value = state.stickerPack;
  controls.stickerDensity.value = state.stickerDensity;
  controls.stamp.value = state.stamp;
  controls.exportPreset.value = state.exportPreset;
}

function resetState() {
  Object.assign(state, {
    fitMode: 'Contain', rotate: 'None', flip: 'None', brightness: 100, contrast: 100, saturation: 100, sharpness: 100,
    warmth: 0, tint: 0, vignette: 0, grain: 0, glitch: 0, borderStyle: 'None', borderSize: 30, borderColor: '#e84ea5',
    stickerPack: 'None', stickerDensity: 12, stamp: '', exportPreset: 'Keep original print size',
  });
  syncUIFromState();
  queueRender();
}

function randomizeState() {
  state.brightness = rand(88, 130);
  state.contrast = rand(90, 160);
  state.saturation = rand(80, 180);
  state.sharpness = rand(70, 150);
  state.warmth = rand(-30, 30);
  state.tint = rand(-25, 25);
  state.vignette = rand(0, 55);
  state.grain = rand(0, 50);
  state.glitch = rand(0, 14);
  state.borderStyle = choice(['None', 'Clean', 'Neon Pulse', 'Filmstrip', 'Arcade']);
  state.borderSize = rand(8, 60);
  state.stickerPack = choice(['None', 'Stars', 'Hearts', 'Chaos']);
  state.stickerDensity = rand(8, 60);
  syncUIFromState();
  queueRender();
}

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

async function loadImageFromPath(path) {
  const base64 = await window.bridge.readBuffer(path);
  const src = `data:image/*;base64,${base64}`;
  const img = new Image();
  img.src = src;
  await img.decode();
  state.sourceImage = img;
  state.sourcePath = path;
  fileNameEl.textContent = path.split(/[\\/]/).pop();
  fileSizeEl.textContent = `${img.width} × ${img.height}`;
  dropHintEl.textContent = 'Print loaded. Drag another image to replace.';
  queueRender();
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

  workCtx.save();
  workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height);
  workCtx.fillStyle = '#0a0e16';
  workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height);
  workCtx.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;

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

  const x = Math.floor((workCanvas.width - drawW) / 2);
  const y = Math.floor((workCanvas.height - drawH) / 2);

  workCtx.translate(workCanvas.width / 2, workCanvas.height / 2);
  if (state.rotate !== 'None') workCtx.rotate((Number(state.rotate) * Math.PI) / 180);
  const sx = state.flip === 'Horizontal' ? -1 : 1;
  const sy = state.flip === 'Vertical' ? -1 : 1;
  workCtx.scale(sx, sy);
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
  applyGlitch();
  drawVignette();
  drawGrain();
  drawBorder();
  drawStickers();
  drawStamp();
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

function applyGlitch() {
  const shift = state.glitch;
  if (shift <= 0) return;
  const layer = workCtx.getImageData(0, 0, workCanvas.width, workCanvas.height);
  const out = workCtx.createImageData(layer);
  const src = layer.data;
  const dst = out.data;
  const w = workCanvas.width;
  const h = workCanvas.height;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const xr = Math.min(w - 1, Math.max(0, x + shift));
      const xb = Math.min(w - 1, Math.max(0, x - shift));
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

function drawVignette() {
  if (state.vignette <= 0) return;
  const g = workCtx.createRadialGradient(
    workCanvas.width / 2, workCanvas.height / 2, Math.min(workCanvas.width, workCanvas.height) * 0.2,
    workCanvas.width / 2, workCanvas.height / 2, Math.max(workCanvas.width, workCanvas.height) * 0.7,
  );
  const a = state.vignette / 120;
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  workCtx.save();
  workCtx.fillStyle = g;
  workCtx.fillRect(0, 0, workCanvas.width, workCanvas.height);
  workCtx.restore();
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
    for (let i = 0; i < s; i++) {
      const alpha = Math.max(0.07, 1 - i / s);
      workCtx.strokeStyle = `rgba(232, 78, 165, ${alpha})`;
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
    for (let i = 0; i < s; i++) {
      workCtx.strokeStyle = rainbow[i % rainbow.length];
      workCtx.lineWidth = 1;
      workCtx.strokeRect(i, i, w - i * 2, h - i * 2);
    }
  }
}

function drawStickers() {
  if (state.stickerPack === 'None' || state.stickerDensity <= 0) return;
  const count = Math.floor(state.stickerDensity / 2) + 4;
  const colors = ['#ff61b2', '#63cbff', '#54efb1', '#ffd75e', '#ffffff'];
  for (let i = 0; i < count; i++) {
    const x = rand(20, workCanvas.width - 20);
    const y = rand(20, workCanvas.height - 20);
    const s = rand(8, 22);
    workCtx.strokeStyle = choice(colors);
    workCtx.fillStyle = choice(colors);
    if (state.stickerPack === 'Stars') {
      workCtx.beginPath();
      workCtx.moveTo(x - s, y); workCtx.lineTo(x + s, y);
      workCtx.moveTo(x, y - s); workCtx.lineTo(x, y + s);
      workCtx.stroke();
    } else if (state.stickerPack === 'Hearts') {
      workCtx.beginPath();
      workCtx.arc(x - s / 2, y - s / 2, s / 2, 0, Math.PI * 2);
      workCtx.arc(x + s / 2, y - s / 2, s / 2, 0, Math.PI * 2);
      workCtx.lineTo(x, y + s);
      workCtx.closePath();
      workCtx.fill();
    } else {
      if (Math.random() > 0.5) workCtx.strokeRect(x - s, y - s, s * 2, s * 2);
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
  const metrics = workCtx.measureText(text);
  const tw = metrics.width;
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

function clamp(v) { return Math.max(0, Math.min(255, v)); }

function renderPreview() {
  drawSourceToWorkCanvas();

  setCanvasSizeToDisplay(previewCanvas);
  previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
  previewCtx.fillStyle = '#080b14';
  previewCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

  const scale = Math.min(previewCanvas.width / workCanvas.width, previewCanvas.height / workCanvas.height);
  const w = workCanvas.width * scale;
  const h = workCanvas.height * scale;
  const x = (previewCanvas.width - w) / 2;
  const y = (previewCanvas.height - h) / 2;
  previewCtx.imageSmoothingQuality = 'high';
  previewCtx.drawImage(workCanvas, x, y, w, h);
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
  const out = exportCanvasForPreset();
  const dataUrl = out.toDataURL('image/png');
  const base64 = dataUrl.split(',')[1];
  await window.bridge.writeBuffer(path, base64);
}

async function saveProject() {
  if (!state.sourceImage) return;
  const path = await window.bridge.saveProjectDialog();
  if (!path) return;
  const payload = { ...state, sourceImage: null };
  await window.bridge.writeText(path, JSON.stringify(payload, null, 2));
}

async function loadProject() {
  const path = await window.bridge.openProjectDialog();
  if (!path) return;
  const raw = await window.bridge.readText(path);
  const data = JSON.parse(raw);
  Object.assign(state, data);
  syncUIFromState();
  if (state.sourcePath) {
    await loadImageFromPath(state.sourcePath);
  }
  queueRender();
}

async function openImage() {
  const path = await window.bridge.openImageDialog();
  if (!path) return;
  await loadImageFromPath(path);
}

function setupTabSwitching() {
  const tabs = Array.from(document.querySelectorAll('.tab'));
  const contents = Array.from(document.querySelectorAll('.tab-content'));
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      contents.forEach((c) => c.classList.remove('active'));
      tab.classList.add('active');
      byId(`tab-${tab.dataset.tab}`).classList.add('active');
    });
  });
}

function setupDragDrop() {
  ['dragenter', 'dragover'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      e.preventDefault();
      document.body.classList.add('drag-over');
    });
  });
  ['dragleave', 'drop'].forEach((evt) => {
    window.addEventListener(evt, (e) => {
      e.preventDefault();
      document.body.classList.remove('drag-over');
    });
  });
  window.addEventListener('drop', async (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (!file || !file.path) return;
    await loadImageFromPath(file.path);
  });
}

function setupListeners() {
  Object.values(controls).forEach((el) => el.addEventListener('input', () => {
    syncStateFromUI();
    queueRender();
  }));

  byId('loadBtn').addEventListener('click', openImage);
  byId('randomBtn').addEventListener('click', randomizeState);
  byId('resetBtn').addEventListener('click', resetState);
  byId('savePngBtn').addEventListener('click', savePng);
  byId('saveProjectBtn').addEventListener('click', saveProject);
  byId('loadProjectBtn').addEventListener('click', loadProject);

  window.addEventListener('resize', queueRender);
}

setupListeners();
setupDragDrop();
setupTabSwitching();
queueRender();
