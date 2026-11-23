/**
 * Visual PDF Cropping Module
 */

let cropState = {
  fileId: null,
  currentPage: 0,
  totalPages: 1,
  pageWidth: 595,
  pageHeight: 842,
  renderedWidth: 500,
  renderedHeight: 707,
  scale: 1,
  // Crop box in rendered pixels relative to image
  box: { x: 40, y: 40, w: 420, h: 620 },
  isDragging: false,
  isResizing: false,
  activeHandle: null,
  startX: 0,
  startY: 0,
  startBox: {}
};

async function initCropperWithFile(fileId) {
  cropState.fileId = fileId;
  cropState.currentPage = 0;
  loadCropperPage(0);
}

async function loadCropperPage(pageIndex) {
  cropState.currentPage = pageIndex;
  showToast(`Chargement de la page ${pageIndex + 1}...`, 'info');

  try {
    const res = await fetch('/api/editor/page-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: cropState.fileId, page_index: pageIndex })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const info = data.data;
    cropState.totalPages = info.page_count;
    cropState.pageWidth = info.width;
    cropState.pageHeight = info.height;

    const jumpInput = document.getElementById('crop-page-jump');
    if (jumpInput) jumpInput.value = pageIndex + 1;
    const totalSpan = document.getElementById('crop-page-total');
    if (totalSpan) totalSpan.textContent = info.page_count;

    const img = document.getElementById('crop-bg-img');
    img.src = info.bg_image;
    img.onload = () => {
      cropState.renderedWidth = img.clientWidth || img.naturalWidth;
      cropState.renderedHeight = img.clientHeight || img.naturalHeight;
      cropState.scale = cropState.renderedWidth / cropState.pageWidth;

      resetCropBox();
      setupCropperEvents();
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function firstCropPage() {
  if (cropState.currentPage !== 0) {
    loadCropperPage(0);
  }
}

function lastCropPage() {
  if (cropState.currentPage < cropState.totalPages - 1) {
    loadCropperPage(cropState.totalPages - 1);
  }
}

function jumpToCropPage(val) {
  const target = parseInt(val, 10) - 1;
  if (!isNaN(target) && target >= 0 && target < cropState.totalPages && target !== cropState.currentPage) {
    loadCropperPage(target);
  }
}

function prevCropPage() {
  if (cropState.currentPage > 0) {
    loadCropperPage(cropState.currentPage - 1);
  }
}

function nextCropPage() {
  if (cropState.currentPage < cropState.totalPages - 1) {
    loadCropperPage(cropState.currentPage + 1);
  }
}

function resetCropBox() {
  const pad = 20;
  cropState.box = {
    x: pad,
    y: pad,
    w: Math.max(50, cropState.renderedWidth - (pad * 2)),
    h: Math.max(50, cropState.renderedHeight - (pad * 2))
  };
  updateCropBoxDOM();
}

function updateCropBoxDOM() {
  const el = document.getElementById('crop-box');
  if (!el) return;
  el.style.left = `${cropState.box.x}px`;
  el.style.top = `${cropState.box.y}px`;
  el.style.width = `${cropState.box.w}px`;
  el.style.height = `${cropState.box.h}px`;
}

function setupCropperEvents() {
  const boxEl = document.getElementById('crop-box');
  const container = document.getElementById('cropper-container');

  boxEl.onmousedown = (e) => {
    if (e.target.classList.contains('crop-handle')) {
      cropState.isResizing = true;
      cropState.activeHandle = e.target.getAttribute('data-handle');
    } else {
      cropState.isDragging = true;
    }
    cropState.startX = e.clientX;
    cropState.startY = e.clientY;
    cropState.startBox = { ...cropState.box };
    e.stopPropagation();
    e.preventDefault();
  };

  window.onmousemove = (e) => {
    if (!cropState.isDragging && !cropState.isResizing) return;

    const dx = e.clientX - cropState.startX;
    const dy = e.clientY - cropState.startY;

    if (cropState.isDragging) {
      let newX = cropState.startBox.x + dx;
      let newY = cropState.startBox.y + dy;
      newX = Math.max(0, Math.min(newX, cropState.renderedWidth - cropState.box.w));
      newY = Math.max(0, Math.min(newY, cropState.renderedHeight - cropState.box.h));
      cropState.box.x = newX;
      cropState.box.y = newY;
    } else if (cropState.isResizing) {
      const h = cropState.activeHandle;
      let { x, y, w, h: bh } = cropState.startBox;

      if (h.includes('r')) w = Math.min(cropState.renderedWidth - x, Math.max(30, w + dx));
      if (h.includes('l')) {
        const potentialW = w - dx;
        if (potentialW >= 30) {
          x = Math.max(0, x + dx);
          w = potentialW;
        }
      }
      if (h.includes('b')) bh = Math.min(cropState.renderedHeight - y, Math.max(30, bh + dy));
      if (h.includes('t')) {
        const potentialH = bh - dy;
        if (potentialH >= 30) {
          y = Math.max(0, y + dy);
          bh = potentialH;
        }
      }

      cropState.box = { x, y, w, h: bh };
    }

    updateCropBoxDOM();
  };

  window.onmouseup = () => {
    cropState.isDragging = false;
    cropState.isResizing = false;
    cropState.activeHandle = null;
  };
}

async function autoDetectMarginsCrop() {
  showToast('Détection automatique des marges blanches...', 'info');
  try {
    const res = await fetch('/api/crop/auto-detect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: cropState.fileId,
        page_index: cropState.currentPage
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const [x0, y0, x1, y1] = data.bbox;
    // Map from PDF points to rendered DOM pixels
    cropState.box = {
      x: x0 * cropState.scale,
      y: y0 * cropState.scale,
      w: (x1 - x0) * cropState.scale,
      h: (y1 - y0) * cropState.scale
    };
    updateCropBoxDOM();
    showToast('Marges blanches détectées et ajustées !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function executeCropPdf() {
  const applyMode = document.getElementById('crop-apply-mode').value;
  const applyToAll = applyMode === 'all';

  // Convert rendered box to PDF points
  const pdfX0 = cropState.box.x / cropState.scale;
  const pdfY0 = cropState.box.y / cropState.scale;
  const pdfX1 = (cropState.box.x + cropState.box.w) / cropState.scale;
  const pdfY1 = (cropState.box.y + cropState.box.h) / cropState.scale;

  const cropBoxes = {};
  if (applyToAll) {
    cropBoxes["0"] = [pdfX0, pdfY0, pdfX1, pdfY1];
  } else {
    cropBoxes[String(cropState.currentPage)] = [pdfX0, pdfY0, pdfX1, pdfY1];
  }

  showToast('Rognage en cours...', 'info');
  try {
    const res = await fetch('/api/crop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: cropState.fileId,
        crop_boxes: cropBoxes,
        apply_to_all: applyToAll
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderResultBanner('crop-panel', data.download_url, data.filename, '', data.download_name);
    showToast('Document rogné avec succès !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
