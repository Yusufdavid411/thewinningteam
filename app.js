const canvas = document.getElementById('flyerCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const flyer = new Image();
flyer.src = 'flyer.jpg';

const photoInput = document.getElementById('photoInput');
const downloadButton = document.getElementById('downloadButton');
const editorControls = document.getElementById('editorControls');
const emptyOverlay = document.getElementById('emptyOverlay');
const statusBadge = document.getElementById('statusBadge');
const zoomFill = document.getElementById('zoomFill');
const zoomIn = document.getElementById('zoomIn');
const zoomOut = document.getElementById('zoomOut');
const resetPosition = document.getElementById('resetPosition');
const flyerFrame = document.getElementById('flyerFrame');
const toast = document.getElementById('toast');

const CIRCLE = { x: 511, y: 862, r: 286 };
let photo = new Image();
let hasPhoto = false;
let photoUrl = null;
let state = {
  scale: 1,
  minScale: 1,
  x: CIRCLE.x,
  y: CIRCLE.y
};
let drag = null;

flyer.onload = () => render();

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('show'), 2400);
}

function fitPhoto() {
  const coverScale = Math.max((CIRCLE.r * 2) / photo.naturalWidth, (CIRCLE.r * 2) / photo.naturalHeight);
  state.minScale = coverScale;
  state.scale = coverScale * 1.03;
  state.x = CIRCLE.x;
  state.y = CIRCLE.y;
  updateZoomUI();
}

function clampPosition() {
  if (!hasPhoto) return;
  const w = photo.naturalWidth * state.scale;
  const h = photo.naturalHeight * state.scale;
  const left = CIRCLE.x - CIRCLE.r;
  const right = CIRCLE.x + CIRCLE.r;
  const top = CIRCLE.y - CIRCLE.r;
  const bottom = CIRCLE.y + CIRCLE.r;

  const minX = right - w / 2;
  const maxX = left + w / 2;
  const minY = bottom - h / 2;
  const maxY = top + h / 2;

  if (minX <= maxX) state.x = Math.min(Math.max(state.x, minX), maxX);
  if (minY <= maxY) state.y = Math.min(Math.max(state.y, minY), maxY);
}

function updateZoomUI() {
  const max = state.minScale * 2.7;
  const ratio = Math.min(1, Math.max(0, (state.scale - state.minScale) / (max - state.minScale)));
  zoomFill.style.width = `${Math.round(6 + ratio * 94)}%`;
}

function setScale(next) {
  if (!hasPhoto) return;
  const max = state.minScale * 2.7;
  state.scale = Math.min(max, Math.max(state.minScale, next));
  clampPosition();
  updateZoomUI();
  render();
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (flyer.complete) ctx.drawImage(flyer, 0, 0, canvas.width, canvas.height);

  if (!hasPhoto || !photo.complete) return;

  ctx.save();
  ctx.beginPath();
  ctx.arc(CIRCLE.x, CIRCLE.y, CIRCLE.r, 0, Math.PI * 2);
  ctx.clip();

  const w = photo.naturalWidth * state.scale;
  const h = photo.naturalHeight * state.scale;
  ctx.drawImage(photo, state.x - w / 2, state.y - h / 2, w, h);
  ctx.restore();

  // A subtle inner edge keeps the photo visually seated inside the neon ring.
  ctx.save();
  ctx.beginPath();
  ctx.arc(CIRCLE.x, CIRCLE.y, CIRCLE.r - 1, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,.16)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();
}

photoInput.addEventListener('change', (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select an image file.');
    return;
  }

  if (photoUrl) URL.revokeObjectURL(photoUrl);
  photoUrl = URL.createObjectURL(file);

  photo = new Image();
  photo.onload = () => {
    hasPhoto = true;
    fitPhoto();
    editorControls.classList.remove('disabled');
    downloadButton.disabled = false;
    emptyOverlay.classList.add('hidden');
    statusBadge.textContent = 'Photo ready';
    statusBadge.style.color = '#6ff6ff';
    render();
    showToast('Photo added. Drag it to position your face.');
  };
  photo.src = photoUrl;
});

function pointerToCanvas(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height
  };
}

canvas.addEventListener('pointerdown', (event) => {
  if (!hasPhoto) return;
  const p = pointerToCanvas(event);
  drag = { pointerId: event.pointerId, x: p.x, y: p.y, photoX: state.x, photoY: state.y };
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
});

canvas.addEventListener('pointermove', (event) => {
  if (!drag || drag.pointerId !== event.pointerId) return;
  const p = pointerToCanvas(event);
  state.x = drag.photoX + (p.x - drag.x);
  state.y = drag.photoY + (p.y - drag.y);
  clampPosition();
  render();
});

function endDrag(event) {
  if (!drag) return;
  drag = null;
  canvas.classList.remove('dragging');
  try { canvas.releasePointerCapture(event.pointerId); } catch {}
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);
canvas.addEventListener('wheel', (event) => {
  if (!hasPhoto) return;
  event.preventDefault();
  setScale(state.scale * (event.deltaY < 0 ? 1.06 : 0.94));
}, { passive: false });

zoomIn.addEventListener('click', () => setScale(state.scale * 1.12));
zoomOut.addEventListener('click', () => setScale(state.scale * 0.89));
resetPosition.addEventListener('click', () => {
  if (!hasPhoto) return;
  fitPhoto();
  render();
});

downloadButton.addEventListener('click', () => {
  if (!hasPhoto) return;
  render();
  canvas.toBlob((blob) => {
    if (!blob) {
      showToast('Could not generate the flyer. Please try again.');
      return;
    }
    const link = document.createElement('a');
    link.download = 'the-winning-team-flyer.jpg';
    link.href = URL.createObjectURL(blob);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1500);
    showToast('Your flyer is ready to download!');
  }, 'image/jpeg', 0.96);
});

// Keep the preview crisp if the device rotates/resizes.
window.addEventListener('resize', render);
