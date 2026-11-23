/**
 * Sejda-like Visual PDF Text Editor Module
 * Allows editing existing text, adding text, whiteout/redacting, highlighting, and signing.
 */

let editorState = {
  fileId: null,
  currentPage: 0,
  totalPages: 1,
  activeTool: 'edit', // 'edit', 'add-text', 'redact', 'highlight'
  scale: 1,
  pageWidth: 595,
  pageHeight: 842,
  activeFont: 'helv',
  activeFontSize: 14,
  activeColor: '#000000',
  // Drag selection for redaction/highlight
  isDrawingBox: false,
  dragStartX: 0,
  dragStartY: 0,
  tempBoxEl: null
};

// State holding all user changes grouped by page: { "0": { replacements:[], additions:[], redactions:[], highlights:[], signatures:[] } }
let editsByPage = {};

function initEditorWithFile(fileId) {
  editorState.fileId = fileId;
  editorState.currentPage = 0;
  editsByPage = {};
  loadEditorPage(0);
}

function getPageEdits(pIdx) {
  const key = String(pIdx);
  if (!editsByPage[key]) {
    editsByPage[key] = {
      replacements: [],
      additions: [],
      redactions: [],
      highlights: [],
      signatures: []
    };
  }
  return editsByPage[key];
}

async function loadEditorPage(pageIndex) {
  editorState.currentPage = pageIndex;
  showToast(`Chargement de la page ${pageIndex + 1}...`, 'info');

  try {
    const res = await fetch('/api/editor/page-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_id: editorState.fileId, page_index: pageIndex })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    const info = data.data;
    editorState.totalPages = info.page_count;
    editorState.pageWidth = info.width;
    editorState.pageHeight = info.height;

    // Update page jump controls
    const jumpInput = document.getElementById('editor-page-jump');
    if (jumpInput) jumpInput.value = pageIndex + 1;
    const totalSpan = document.getElementById('editor-page-total');
    if (totalSpan) totalSpan.textContent = info.page_count;

    const bgImg = document.getElementById('editor-bg-img');
    bgImg.src = info.bg_image;
    bgImg.onload = () => {
      // Calculate scale relative to natural PDF points
      const renderedWidth = bgImg.clientWidth || bgImg.naturalWidth;
      editorState.scale = renderedWidth / editorState.pageWidth;
      renderEditorOverlay(info.text_blocks);
    };
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function firstEditorPage() {
  if (editorState.currentPage !== 0) {
    loadEditorPage(0);
  }
}

function lastEditorPage() {
  if (editorState.currentPage < editorState.totalPages - 1) {
    loadEditorPage(editorState.totalPages - 1);
  }
}

function jumpToEditorPage(val) {
  const target = parseInt(val, 10) - 1;
  if (!isNaN(target) && target >= 0 && target < editorState.totalPages && target !== editorState.currentPage) {
    loadEditorPage(target);
  }
}

function prevEditorPage() {
  if (editorState.currentPage > 0) {
    loadEditorPage(editorState.currentPage - 1);
  }
}

function nextEditorPage() {
  if (editorState.currentPage < editorState.totalPages - 1) {
    loadEditorPage(editorState.currentPage + 1);
  }
}

function setEditorTool(tool) {
  editorState.activeTool = tool;
  document.querySelectorAll('.editor-toolbar .tool-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`btn-tool-${tool}`);
  if (btn) btn.classList.add('active');

  const overlay = document.getElementById('editor-overlay');
  if (tool === 'edit') {
    overlay.style.cursor = 'default';
  } else if (tool === 'add-text') {
    overlay.style.cursor = 'text';
  } else if (tool === 'redact' || tool === 'highlight') {
    overlay.style.cursor = 'crosshair';
  }
}

function updateEditorActiveFont() {
  editorState.activeFont = document.getElementById('editor-font-family').value;
}
function updateEditorActiveSize() {
  editorState.activeFontSize = parseFloat(document.getElementById('editor-font-size').value) || 14;
}
function updateEditorActiveColor() {
  editorState.activeColor = document.getElementById('editor-color').value;
}

function renderEditorOverlay(textBlocks) {
  const overlay = document.getElementById('editor-overlay');
  overlay.innerHTML = '';
  const scale = editorState.scale;
  const pEdits = getPageEdits(editorState.currentPage);

  // 1. Render interactive existing text blocks
  textBlocks.forEach(span => {
    const box = document.createElement('div');
    box.className = 'text-span-box';
    box.id = span.id;

    const [x0, y0, x1, y1] = span.bbox;
    const domX = x0 * scale;
    const domY = y0 * scale;
    const domW = Math.max(12, (x1 - x0) * scale);
    const domH = Math.max(12, (y1 - y0) * scale);

    const fInfo = span.font_info || {
      family: 'Arial',
      css_family: 'Arial, sans-serif',
      is_bold: false,
      is_italic: false,
      display_name: span.font || 'Arial'
    };

    box.style.left = `${domX}px`;
    box.style.top = `${domY}px`;
    box.style.width = `${domW}px`;
    box.style.height = `${domH}px`;
    box.title = `Cliquez pour modifier: "${span.text}"\nPolice: ${fInfo.display_name} (${span.size} pt)`;

    // Check if this span was already edited
    const existingEdit = pEdits.replacements.find(r => r.span_id === span.id);
    if (existingEdit) {
      box.textContent = existingEdit.new_text;
      box.style.backgroundColor = '#ffffff';
      box.style.outline = '1.5px solid var(--primary)';
      box.style.fontFamily = fInfo.css_family;
      box.style.fontWeight = (existingEdit.is_bold ?? fInfo.is_bold) ? 'bold' : 'normal';
      box.style.fontStyle = (existingEdit.is_italic ?? fInfo.is_italic) ? 'italic' : 'normal';
      box.style.fontSize = `${existingEdit.font_size * scale}px`;
      box.style.color = existingEdit.color;
    }

    // Click handler to edit text
    box.onclick = (e) => {
      if (editorState.activeTool !== 'edit') return;
      e.stopPropagation();
      startEditingSpan(box, span, existingEdit);
    };

    overlay.appendChild(box);
  });

  // 2. Render previous redactions for this page
  pEdits.redactions.forEach(r => {
    const redBox = document.createElement('div');
    redBox.className = 'redaction-box';
    redBox.style.left = `${r.bbox[0] * scale}px`;
    redBox.style.top = `${r.bbox[1] * scale}px`;
    redBox.style.width = `${(r.bbox[2] - r.bbox[0]) * scale}px`;
    redBox.style.height = `${(r.bbox[3] - r.bbox[1]) * scale}px`;
    redBox.style.backgroundColor = r.fill || '#ffffff';
    overlay.appendChild(redBox);
  });

  // 3. Render previous highlights for this page
  pEdits.highlights.forEach(h => {
    const hlBox = document.createElement('div');
    hlBox.className = 'highlight-box';
    hlBox.style.left = `${h.bbox[0] * scale}px`;
    hlBox.style.top = `${h.bbox[1] * scale}px`;
    hlBox.style.width = `${(h.bbox[2] - h.bbox[0]) * scale}px`;
    hlBox.style.height = `${(h.bbox[3] - h.bbox[1]) * scale}px`;
    overlay.appendChild(hlBox);
  });

  // 4. Render previous new text additions
  pEdits.additions.forEach(a => {
    renderAddedTextElement(a, overlay);
  });

  // 5. Render previous signatures
  pEdits.signatures.forEach(sig => {
    renderSignatureElement(sig, overlay);
  });

  setupOverlayDragEvents();
}

function startEditingSpan(boxEl, span, existingEdit) {
  if (boxEl.classList.contains('editing')) return;
  boxEl.classList.add('editing');
  boxEl.style.backgroundColor = '#ffffff';

  const fInfo = span.font_info || {
    family: 'Arial',
    css_family: 'Arial, sans-serif',
    is_bold: false,
    is_italic: false,
    display_name: span.font || 'Arial'
  };

  // Surface detected font in the toolbar badge
  const detectedBadge = document.getElementById('editor-font-detected');
  if (detectedBadge) {
    detectedBadge.innerHTML = `
      <span class="font-detected-pill" title="Police détectée et appliquée à la modification">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>
        Police origine : <strong>${fInfo.display_name}</strong> (${span.size} pt)
      </span>
    `;
    detectedBadge.style.display = 'inline-flex';
  }

  // Synchronize toolbar controls with the detected font
  const fontFamSelect = document.getElementById('editor-font-family');
  if (fontFamSelect) {
    let opt = Array.from(fontFamSelect.options).find(o => o.value.toLowerCase() === fInfo.family.toLowerCase());
    if (!opt) {
      opt = new Option(`${fInfo.family} (Détectée)`, fInfo.family, true, true);
      fontFamSelect.add(opt);
    }
    fontFamSelect.value = opt.value;
  }
  const sizeInput = document.getElementById('editor-font-size');
  if (sizeInput) sizeInput.value = span.size;
  const colorInput = document.getElementById('editor-color');
  if (colorInput) colorInput.value = span.color_hex || '#000000';

  const currentVal = existingEdit ? existingEdit.new_text : span.text;
  boxEl.innerHTML = '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'text-span-input';
  input.value = currentVal;

  // Apply EXACT matching font styles to the input box
  input.style.fontFamily = fInfo.css_family;
  input.style.fontWeight = fInfo.is_bold ? 'bold' : 'normal';
  input.style.fontStyle = fInfo.is_italic ? 'italic' : 'normal';
  input.style.fontSize = `${span.size * editorState.scale}px`;
  input.style.color = span.color_hex || span.color || '#000000';

  boxEl.appendChild(input);
  input.focus();
  input.select();

  const finishEdit = () => {
    const newVal = input.value.trim();
    boxEl.classList.remove('editing');
    boxEl.innerHTML = '';
    boxEl.textContent = newVal || currentVal;

    // Apply the exact font styling to the rendered element
    boxEl.style.fontFamily = fInfo.css_family;
    boxEl.style.fontWeight = fInfo.is_bold ? 'bold' : 'normal';
    boxEl.style.fontStyle = fInfo.is_italic ? 'italic' : 'normal';
    boxEl.style.fontSize = `${span.size * editorState.scale}px`;
    boxEl.style.color = span.color_hex || span.color || '#000000';

    const pEdits = getPageEdits(editorState.currentPage);
    // Remove previous if exists
    pEdits.replacements = pEdits.replacements.filter(r => r.span_id !== span.id);

    if (newVal !== span.text) {
      pEdits.replacements.push({
        span_id: span.id,
        bbox: span.bbox,
        old_text: span.text,
        new_text: newVal,
        font_size: span.size,
        font_name: span.font,
        font_family: fInfo.family,
        is_bold: fInfo.is_bold,
        is_italic: fInfo.is_italic,
        color: span.color_hex || span.color
      });
      boxEl.style.outline = '1.5px solid var(--primary)';
      boxEl.style.backgroundColor = '#ffffff';
    } else {
      boxEl.style.outline = 'none';
      boxEl.style.backgroundColor = 'transparent';
    }
  };

  input.onblur = finishEdit;
  input.onkeydown = (e) => {
    if (e.key === 'Enter') {
      input.blur();
    } else if (e.key === 'Escape') {
      input.value = span.text;
      input.blur();
    }
  };
}

function handleCanvasClick(e) {
  if (editorState.activeTool === 'add-text') {
    const rect = document.getElementById('editor-overlay').getBoundingClientRect();
    const domX = e.clientX - rect.left;
    const domY = e.clientY - rect.top;
    const pdfX = domX / editorState.scale;
    const pdfY = domY / editorState.scale;

    const newItem = {
      id: `add_${Date.now()}`,
      x: pdfX,
      y: pdfY,
      text: 'Nouveau Texte',
      font_size: editorState.activeFontSize,
      font_name: editorState.activeFont,
      color: editorState.activeColor
    };

    getPageEdits(editorState.currentPage).additions.push(newItem);
    renderAddedTextElement(newItem, document.getElementById('editor-overlay'), true);
  }
}

function renderAddedTextElement(item, overlay, autoFocus = false) {
  const el = document.createElement('div');
  el.className = 'custom-editor-item';
  el.style.left = `${item.x * editorState.scale}px`;
  el.style.top = `${item.y * editorState.scale}px`;
  el.style.fontSize = `${item.font_size * editorState.scale}px`;
  el.style.color = item.color;
  el.style.fontFamily = item.font_name === 'times' ? 'Times New Roman' : (item.font_name === 'couri' ? 'Courier New' : 'Helvetica');
  el.contentEditable = true;
  el.textContent = item.text;
  el.style.padding = '2px 6px';
  el.style.border = '1px dashed var(--primary)';
  el.style.backgroundColor = 'rgba(255, 255, 255, 0.85)';
  el.style.borderRadius = '3px';

  el.onblur = () => {
    item.text = el.textContent;
  };

  overlay.appendChild(el);
  if (autoFocus) {
    el.focus();
    document.execCommand('selectAll', false, null);
  }
}

function setupOverlayDragEvents() {
  const overlay = document.getElementById('editor-overlay');

  overlay.onmousedown = (e) => {
    if (editorState.activeTool !== 'redact' && editorState.activeTool !== 'highlight') return;
    const rect = overlay.getBoundingClientRect();
    editorState.isDrawingBox = true;
    editorState.dragStartX = e.clientX - rect.left;
    editorState.dragStartY = e.clientY - rect.top;

    const box = document.createElement('div');
    box.className = editorState.activeTool === 'redact' ? 'redaction-box' : 'highlight-box';
    box.style.left = `${editorState.dragStartX}px`;
    box.style.top = `${editorState.dragStartY}px`;
    box.style.width = '0px';
    box.style.height = '0px';
    overlay.appendChild(box);
    editorState.tempBoxEl = box;
    e.preventDefault();
  };

  overlay.onmousemove = (e) => {
    if (!editorState.isDrawingBox || !editorState.tempBoxEl) return;
    const rect = overlay.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const left = Math.min(editorState.dragStartX, currentX);
    const top = Math.min(editorState.dragStartY, currentY);
    const width = Math.abs(currentX - editorState.dragStartX);
    const height = Math.abs(currentY - editorState.dragStartY);

    editorState.tempBoxEl.style.left = `${left}px`;
    editorState.tempBoxEl.style.top = `${top}px`;
    editorState.tempBoxEl.style.width = `${width}px`;
    editorState.tempBoxEl.style.height = `${height}px`;
  };

  overlay.onmouseup = () => {
    if (!editorState.isDrawingBox || !editorState.tempBoxEl) return;
    editorState.isDrawingBox = false;

    const boxEl = editorState.tempBoxEl;
    const left = parseFloat(boxEl.style.left);
    const top = parseFloat(boxEl.style.top);
    const width = parseFloat(boxEl.style.width);
    const height = parseFloat(boxEl.style.height);

    if (width > 5 && height > 5) {
      const pdfBbox = [
        left / editorState.scale,
        top / editorState.scale,
        (left + width) / editorState.scale,
        (top + height) / editorState.scale
      ];

      const pEdits = getPageEdits(editorState.currentPage);
      if (editorState.activeTool === 'redact') {
        pEdits.redactions.push({ bbox: pdfBbox, fill: '#ffffff' });
      } else if (editorState.activeTool === 'highlight') {
        pEdits.highlights.push({ bbox: pdfBbox, color: '#fef08a' });
      }
    } else {
      boxEl.remove();
    }
    editorState.tempBoxEl = null;
  };
}

// SIGNATURE HANDLING
let sigCanvas, sigCtx, isDrawingSig = false;

function openSignatureModal() {
  document.getElementById('modal-signature').classList.add('active');
  sigCanvas = document.getElementById('sig-pad');
  sigCtx = sigCanvas.getContext('2d');
  sigCanvas.width = sigCanvas.offsetWidth;
  sigCanvas.height = 180;
  clearSignaturePad();

  sigCanvas.onmousedown = (e) => {
    isDrawingSig = true;
    sigCtx.beginPath();
    sigCtx.moveTo(e.offsetX, e.offsetY);
  };
  sigCanvas.onmousemove = (e) => {
    if (!isDrawingSig) return;
    sigCtx.lineTo(e.offsetX, e.offsetY);
    sigCtx.strokeStyle = '#000000';
    sigCtx.lineWidth = 2.5;
    sigCtx.lineCap = 'round';
    sigCtx.stroke();
  };
  window.onmouseup = () => { isDrawingSig = false; };
}

function closeSignatureModal() {
  document.getElementById('modal-signature').classList.remove('active');
}

function clearSignaturePad() {
  if (!sigCtx) return;
  sigCtx.clearRect(0, 0, sigCanvas.width, sigCanvas.height);
}

function loadSignatureImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      clearSignaturePad();
      sigCtx.drawImage(img, 20, 20, sigCanvas.width - 40, sigCanvas.height - 40);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function applySignatureToPage() {
  const dataUrl = sigCanvas.toDataURL('image/png');
  closeSignatureModal();

  const scale = editorState.scale;
  const sigItem = {
    bbox: [100, 100, 240, 160], // default size in points
    image_base64: dataUrl
  };

  getPageEdits(editorState.currentPage).signatures.push(sigItem);
  renderSignatureElement(sigItem, document.getElementById('editor-overlay'));
}

function renderSignatureElement(sigItem, overlay) {
  const box = document.createElement('div');
  box.className = 'signature-overlay';
  const scale = editorState.scale;

  box.style.left = `${sigItem.bbox[0] * scale}px`;
  box.style.top = `${sigItem.bbox[1] * scale}px`;
  box.style.width = `${(sigItem.bbox[2] - sigItem.bbox[0]) * scale}px`;
  box.style.height = `${(sigItem.bbox[3] - sigItem.bbox[1]) * scale}px`;

  box.innerHTML = `<img src="${sigItem.image_base64}" alt="Signature">`;

  // Make draggable
  let isMoving = false, sx = 0, sy = 0, origLeft = 0, origTop = 0;
  box.onmousedown = (e) => {
    isMoving = true;
    sx = e.clientX;
    sy = e.clientY;
    origLeft = parseFloat(box.style.left);
    origTop = parseFloat(box.style.top);
    e.stopPropagation();
    e.preventDefault();
  };

  window.addEventListener('mousemove', (e) => {
    if (!isMoving) return;
    const nx = origLeft + (e.clientX - sx);
    const ny = origTop + (e.clientY - sy);
    box.style.left = `${nx}px`;
    box.style.top = `${ny}px`;

    const w = parseFloat(box.style.width);
    const h = parseFloat(box.style.height);
    sigItem.bbox = [nx / scale, ny / scale, (nx + w) / scale, (ny + h) / scale];
  });

  window.addEventListener('mouseup', () => { isMoving = false; });
  overlay.appendChild(box);
}

async function saveAndApplyEditor() {
  showToast('Enregistrement des modifications du texte...', 'info');

  try {
    const res = await fetch('/api/editor/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: editorState.fileId,
        edits: editsByPage
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderResultBanner('editor-panel', data.download_url, data.filename, '', data.download_name);
    showToast('Modifications appliquées avec succès !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
