/**
 * Mobile Application Script for PDF Studio Pro
 * 100% Offline Client-Side Mobile Processing
 */

let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Active single file state for single-file tools (stores native File objects)
let activeFileMap = {};

// Active batch files state for multi-file tools
let batchFilesMap = {
  'word-to-pdf': [],
  'to-word': [],
  'pdf-to-img': []
};

function handleBatchPdfUpload(files, tool) {
  if (!files || files.length === 0) return;
  if (!batchFilesMap[tool]) batchFilesMap[tool] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    f.base_name = f.name.substring(0, f.name.lastIndexOf('.')) || f.name;
    batchFilesMap[tool].push(f);
  }
  activeFileMap[tool] = batchFilesMap[tool][0];

  document.getElementById(`dropzone-${tool}`).style.display = 'none';
  document.getElementById(`${tool}-panel`).style.display = 'block';

  renderBatchFileList(tool);
  renderFilePreviewThumbnails(tool, batchFilesMap[tool]);
  showToast(`${files.length} document(s) ajouté(s)`);
}

function renderBatchFileList(tool) {
  const container = document.getElementById(`${tool}-file-list`);
  const nameEl = document.getElementById(`${tool}-filename`) || document.getElementById(`${tool}-name`);
  const files = batchFilesMap[tool] || [];

  if (nameEl) {
    nameEl.textContent = `${files.length} document(s) sélectionné(s)`;
  }

  if (!container) return;
  container.innerHTML = '';

  files.forEach((f, idx) => {
    const item = document.createElement('div');
    item.className = 'batch-file-item';
    const sizeStr = f.size > 1024*1024 ? `${(f.size / (1024*1024)).toFixed(2)} Mo` : `${(f.size / 1024).toFixed(0)} Ko`;
    const safeName = escapeHtml(f.name);
    item.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.5rem; overflow:hidden;">
        <span style="font-weight:600; color:var(--primary);">${idx + 1}.</span>
        <span dir="auto" class="filename-text" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; unicode-bidi: plaintext;" title="${safeName}">${safeName}</span>
        <span style="font-size:0.75rem; color:var(--text-muted);">(${sizeStr})</span>
      </div>
      <button type="button" class="batch-file-remove" onclick="removeBatchFile('${tool}', ${idx})" title="Retirer">🗑️</button>
    `;
    container.appendChild(item);
  });
}

function removeBatchFile(tool, idx) {
  if (batchFilesMap[tool]) {
    batchFilesMap[tool].splice(idx, 1);
    if (batchFilesMap[tool].length === 0) {
      document.getElementById(`dropzone-${tool}`).style.display = 'block';
      document.getElementById(`${tool}-panel`).style.display = 'none';
      delete activeFileMap[tool];
    } else {
      activeFileMap[tool] = batchFilesMap[tool][0];
      renderBatchFileList(tool);
    }
  }
}

const ALL_TOOLS = [
  { id: 'img-to-pdf', name: 'Images en PDF', icon: '🖼️' },
  { id: 'pdf-to-img', name: 'PDF en Images', icon: '📸' },
  { id: 'organize', name: 'Organiser & Fusionner', icon: '📑' },
  { id: 'editor', name: 'Éditeur Sejda', icon: '✍️' },
  { id: 'crop', name: 'Rogner / Crop', icon: '✂️' },
  { id: 'compress', name: 'Compresser PDF', icon: '🗜️' },
  { id: 'protect', name: 'Protéger le PDF', icon: '🔒' },
  { id: 'unlock', name: 'Déverrouiller PDF', icon: '🔓' },
  { id: 'watermark', name: 'Ajouter un Filigrane', icon: '💧' },
  { id: 'page-numbers', name: 'Numéroter les pages', icon: '🔢' },
  { id: 'to-word', name: 'PDF en Word (DOCX)', icon: '📝' },
  { id: 'word-to-pdf', name: 'Word en PDF (DOCX)', icon: '📄' },
  { id: 'split', name: 'Découper / Diviser PDF', icon: '✂️' },
  { id: 'remove-pages', name: 'Supprimer des pages', icon: '🗑️' },
  { id: 'flatten', name: 'Aplatir PDF', icon: '📋' },
  { id: 'pdf-to-text', name: 'PDF en Texte & Markdown', icon: '📖' },
  { id: 'metadata', name: 'Métadonnées & RGPD', icon: '🏷️' },
  { id: 'bates', name: 'Numérotation Bates Juridique', icon: '⚖️' },
  { id: 'rotate-fast', name: 'Pivoter les pages', icon: '🔄' }
];

function toggleTheme() {
  currentTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', currentTheme);
  localStorage.setItem('theme', currentTheme);
}

function switchView(viewId) {
  if (viewId === 'dashboard') {
    clearAllWorkspacesAndFiles(false);
  }
  document.querySelectorAll('.workspace-view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewId}`);
  if (target) {
    target.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.querySelectorAll('.quick-tool-select').forEach(sel => {
      sel.value = viewId;
    });
  }
}

function goToPrevTool(currentToolId) {
  const idx = ALL_TOOLS.findIndex(t => t.id === currentToolId);
  if (idx > 0) switchView(ALL_TOOLS[idx - 1].id);
  else switchView(ALL_TOOLS[ALL_TOOLS.length - 1].id);
}

function goToNextTool(currentToolId) {
  const idx = ALL_TOOLS.findIndex(t => t.id === currentToolId);
  if (idx !== -1 && idx < ALL_TOOLS.length - 1) switchView(ALL_TOOLS[idx + 1].id);
  else switchView(ALL_TOOLS[0].id);
}

function resetCurrentWorkspace(toolId) {
  let panelId = `${toolId}-panel`;
  let resultId = `${toolId}-result`;
  if (toolId === 'img-to-pdf') {
    panelId = 'img-panel';
    resultId = 'img-result';
    if (typeof selectedImages !== 'undefined') selectedImages = [];
  }
  const dropzone = document.getElementById(`dropzone-${toolId === 'img-to-pdf' ? 'img' : toolId}`);
  const panel = document.getElementById(panelId);
  const result = document.getElementById(resultId);

  if (dropzone) dropzone.style.display = 'block';
  if (panel) panel.style.display = 'none';
  if (result) result.style.display = 'none';

  delete activeFileMap[toolId];
  showToast('Prêt pour un nouveau fichier', 'info');
}

function openTool(toolId) {
  switchView(toolId);
  closeNavDrawer();
}

function filterTools() {
  const query = document.getElementById('tool-search').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#tools-container .tool-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

let _lastFileTriggerTime = 0;
function triggerFileInput(id, event) {
  if (event) {
    event.stopPropagation();
  }
  const now = Date.now();
  if (now - _lastFileTriggerTime < 500) {
    return; // Prevent duplicate immediate clicks from event bubbling
  }
  _lastFileTriggerTime = now;
  const el = document.getElementById(id);
  if (el) {
    // Reset value so selecting the same file again triggers onchange
    el.value = '';
    el.click();
  }
}

function showToast(message, type = 'info') {
  if (window.AndroidBridge && window.AndroidBridge.showToast) {
    window.AndroidBridge.showToast(message);
    return;
  }
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' o';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' Ko';
  return (bytes / (1024 * 1024)).toFixed(2) + ' Mo';
}

function renderResultBanner(containerId, downloadName, customHtml = '', toolName = '', base64Data = null, mimeType = 'application/pdf', bytes = null) {
  const item = addProcessedFile(downloadName, toolName || 'PDF Studio', null, bytes ? formatBytes(bytes.length) : '', base64Data, mimeType, bytes);
  const container = document.getElementById(containerId);
  if (!container) return;

  const safeName = escapeHtml(downloadName);
  const itemId = item ? item.id : '';

  container.innerHTML = `
    <div class="result-banner">
      <div style="display:flex; align-items:center; justify-content:center; gap:0.5rem; margin-bottom:0.5rem;">
        <span style="font-size:1.75rem;">🎉</span>
        <h2 style="margin:0;">Traitement Terminé avec Succès !</h2>
      </div>
      <p style="margin-bottom:1rem;">Votre document <strong dir="auto" class="filename-text">${safeName}</strong> est prêt et enregistré dans vos <strong>Téléchargements</strong>.</p>
      ${customHtml}
      <div class="result-actions" style="margin-top:1.25rem; display:flex; gap:0.6rem; justify-content:center; flex-wrap:wrap;">
        <button class="btn btn-white btn-lg" onclick="openProcessedFile('${itemId}')" title="Ouvrir dans l'application par défaut">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          Ouvrir le fichier
        </button>
        <button class="btn btn-secondary btn-lg" onclick="previewProcessedFile('${itemId}')" title="Visualiser dans l'application">
          👁️ Visualiser
        </button>
        <button class="btn btn-secondary btn-lg" onclick="shareProcessedFile('${itemId}')" title="Partager">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
          Partager
        </button>
      </div>
    </div>
  `;
  container.style.display = 'block';
  container.scrollIntoView({ behavior: 'smooth' });
}

// Single File Upload Handler
function handleSinglePdfUpload(files, tool) {
  if (!files || files.length === 0) return;
  const file = files[0];
  const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
  file.base_name = baseName;
  activeFileMap[tool] = file;

  const dropzone = document.getElementById(`dropzone-${tool}`);
  const panel = document.getElementById(`${tool}-panel`);
  const filenameEl = document.getElementById(`${tool}-filename`);

  if (dropzone) dropzone.style.display = 'none';
  if (panel) panel.style.display = 'block';
  if (filenameEl) filenameEl.textContent = file.name;

  if (tool === 'metadata') {
    loadMetadataForFile(file);
  }
  renderFilePreviewThumbnails(tool, [file]);
}

// 1. Watermark
async function executeWatermarkPdf() {
  const file = activeFileMap['watermark'];
  if (!file) return;

  const text = document.getElementById('wm-text').value;
  const fontSize = parseInt(document.getElementById('wm-size').value, 10);
  const color = document.getElementById('wm-color').value;
  const rotation = parseInt(document.getElementById('wm-rotation').value, 10);

  showToast('Application du filigrane hors-ligne...');
  try {
    const bytes = await MobileEngine.watermarkPdf(file, text, fontSize, color, 0.25, rotation);
    const dlName = `${file.base_name}_filigrane.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('watermark-panel', dlName, '', 'Filigrane', b64, 'application/pdf', bytes);
    showToast('Filigrane appliqué avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 2. Page Numbers
async function executePageNumbersPdf() {
  const file = activeFileMap['page-numbers'];
  if (!file) return;

  const fmt = document.getElementById('pn-format').value;
  const pos = document.getElementById('pn-position').value;
  const startAt = parseInt(document.getElementById('pn-start').value, 10);

  showToast('Numérotation des pages...');
  try {
    const bytes = await MobileEngine.pageNumbersPdf(file, fmt, pos, startAt);
    const dlName = `${file.base_name}_numerote.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('page-numbers-panel', dlName, '', 'Numérotation', b64, 'application/pdf', bytes);
    showToast('Numérotation appliquée !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 3. Split PDF
async function executeSplitPdf() {
  const file = activeFileMap['split'];
  if (!file) return;

  const mode = document.getElementById('split-mode').value;
  let ranges = 'all';
  if (mode === 'custom') {
    ranges = document.getElementById('split-ranges').value.trim();
    if (!ranges) {
      showToast('Veuillez indiquer les plages (ex: 1-2, 3-5)');
      return;
    }
  }

  showToast('Découpage du document...');
  try {
    const bytes = await MobileEngine.splitPdf(file, ranges);
    const dlName = `${file.base_name}_decoupe.pdf`;
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('split-panel', dlName);
    showToast('Document découpé avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 4. Remove Pages
async function executeRemovePages() {
  const file = activeFileMap['remove-pages'];
  if (!file) return;

  const pagesStr = document.getElementById('remove-pages-input').value.trim();
  if (!pagesStr) {
    showToast('Veuillez indiquer les pages à supprimer');
    return;
  }

  showToast('Suppression des pages...');
  try {
    const bytes = await MobileEngine.removePages(file, pagesStr);
    const dlName = `${file.base_name}_pages_supprimees.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('remove-pages-panel', dlName, '', 'Supprimer Pages', b64, 'application/pdf', bytes);
    showToast('Pages supprimées avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 5. Flatten PDF
async function executeFlattenPdf() {
  const file = activeFileMap['flatten'];
  if (!file) return;

  showToast('Aplatissement du PDF...');
  try {
    const bytes = await MobileEngine.flattenPdf(file);
    const dlName = `${file.base_name}_aplati.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('flatten-panel', dlName, '', 'Aplatir PDF', b64, 'application/pdf', bytes);
    showToast('PDF aplati avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 6. Fast Rotate
async function executeFastRotate() {
  const file = activeFileMap['rotate-fast'];
  if (!file) return;

  const angle = parseInt(document.getElementById('rotate-angle').value, 10);
  const pagesMode = document.getElementById('rotate-pages-mode').value;

  showToast('Rotation des pages...');
  try {
    const bytes = await MobileEngine.rotateFast(file, angle, pagesMode);
    const dlName = `${file.base_name}_pivote.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('rotate-fast-panel', dlName, '', 'Pivoter Pages', b64, 'application/pdf', bytes);
    showToast('Pages pivotées avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 7. Bates Stamping
async function executeBatesStamping() {
  const file = activeFileMap['bates'];
  if (!file) return;

  const prefix = document.getElementById('bates-prefix').value;
  const digits = parseInt(document.getElementById('bates-digits').value, 10);
  const start = parseInt(document.getElementById('bates-start').value, 10);
  const position = document.getElementById('bates-position').value;

  showToast('Indexation Bates...');
  try {
    const bytes = await MobileEngine.batesStamping(file, prefix, digits, start, position);
    const dlName = `${file.base_name}_bates.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('bates-panel', dlName, '', 'Numérotation Bates', b64, 'application/pdf', bytes);
    showToast('Numérotation Bates appliquée !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 8. Metadata
async function loadMetadataForFile(file) {
  try {
    const m = await MobileEngine.getMetadata(file);
    document.getElementById('meta-title').value = m.title || '';
    document.getElementById('meta-author').value = m.author || '';
    document.getElementById('meta-subject').value = m.subject || '';
    document.getElementById('meta-keywords').value = m.keywords || '';
    document.getElementById('meta-creator').value = m.creator || '';
  } catch (e) {
    console.warn(e);
  }
}

async function executeMetadataUpdate(sanitize = false) {
  const file = activeFileMap['metadata'];
  if (!file) return;

  const metadata = {
    title: document.getElementById('meta-title').value.trim(),
    author: document.getElementById('meta-author').value.trim(),
    subject: document.getElementById('meta-subject').value.trim(),
    keywords: document.getElementById('meta-keywords').value.trim(),
    creator: document.getElementById('meta-creator').value.trim()
  };

  showToast(sanitize ? 'Anonymisation RGPD...' : 'Mise à jour des métadonnées...');
  try {
    const bytes = await MobileEngine.updateMetadata(file, metadata, sanitize);
    const suffix = sanitize ? 'anonymise' : 'metadonnees';
    const dlName = `${file.base_name}_${suffix}.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('metadata-panel', dlName, '', 'Métadonnées', b64, 'application/pdf', bytes);
    showToast(sanitize ? 'Document anonymisé !' : 'Métadonnées enregistrées !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 9. PDF to Text & Markdown
async function executePdfToText() {
  const file = activeFileMap['pdf-to-text'];
  if (!file) return;

  const fmt = document.getElementById('pdf-to-text-format').value;
  showToast('Extraction du texte...');
  try {
    const textContent = await MobileEngine.extractTextOrMarkdown(file, fmt);
    const dlName = `${file.base_name}.${fmt}`;

    const encoder = new TextEncoder();
    const bytes = encoder.encode(textContent);
    MobileEngine.saveFile(bytes, dlName, fmt === 'md' ? 'text/markdown' : 'text/plain');

    const customHtml = `
      <div style="margin: 1rem 0; text-align: left; background: rgba(0,0,0,0.1); padding: 1rem; border-radius: 8px; max-height: 200px; overflow-y: auto;">
        <strong style="display:block; margin-bottom: 0.5rem; font-size: 0.9rem;">Aperçu :</strong>
        <pre style="white-space: pre-wrap; font-size: 0.85rem;">${textContent.substring(0, 1500)}...</pre>
      </div>
    `;
    renderResultBanner('pdf-to-text-panel', dlName, customHtml);
    showToast('Texte extrait avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 10. Images to PDF
let selectedImages = [];
function handleImageFiles(files) {
  if (!files || files.length === 0) return;
  for (let i = 0; i < files.length; i++) {
    selectedImages.push(files[i]);
  }
  document.getElementById('dropzone-img').style.display = 'none';
  document.getElementById('img-panel').style.display = 'block';
  document.getElementById('img-count-text').textContent = `${selectedImages.length} image(s) sélectionnée(s)`;
}

async function executeImagesToPdf() {
  if (selectedImages.length === 0) {
    showToast('Veuillez sélectionner au moins une image');
    return;
  }
  const pageSize = document.getElementById('img-page-size').value;
  const orientation = document.getElementById('img-orientation').value;
  const margin = parseInt(document.getElementById('img-margin').value, 10);
  const mergeSingle = document.querySelector('input[name="img-batch-mode"]:checked')?.value !== 'separate';

  showToast(mergeSingle ? 'Conversion des images en PDF unique...' : 'Création des PDF séparés (ZIP)...');
  try {
    const res = await MobileEngine.batchImagesToPdf(selectedImages, pageSize, orientation, margin, mergeSingle);
    const firstImg = selectedImages[0].name;
    const baseName = firstImg.substring(0, firstImg.lastIndexOf('.')) || 'Images_Converties';
    const dlName = res.isZip ? `${baseName}.zip` : `${baseName}.pdf`;
    const mime = res.isZip ? 'application/zip' : 'application/pdf';

    const b64 = MobileEngine.saveFile(res.bytes, dlName, mime);
    renderResultBanner('img-result', dlName, '', 'Images en PDF', b64, mime, res.bytes);
    showToast('Conversion terminée avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 11. PDF to Images
async function executePdfToImages() {
  const batch = (batchFilesMap['pdf-to-img'] && batchFilesMap['pdf-to-img'].length > 0)
    ? batchFilesMap['pdf-to-img']
    : (activeFileMap['pdf-to-img'] ? [activeFileMap['pdf-to-img']] : []);

  if (batch.length === 0) {
    showToast('Veuillez sélectionner au moins un fichier PDF');
    return;
  }

  showToast('Extraction des pages en images...');
  try {
    const res = await MobileEngine.batchPdfToImages(batch, 2.0);
    const sec = document.getElementById('p2i-gallery-section');
    const grid = document.getElementById('p2i-gallery-grid');
    grid.innerHTML = '';

    res.pages.forEach(p => {
      const card = document.createElement('div');
      card.className = 'organizer-card';
      card.innerHTML = `
        <div class="page-thumb-container">
          <img src="${p.thumbnail}" class="page-thumb-img" alt="${p.file_name}">
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 0.5rem;">
          <span class="page-num-tag" style="font-size:0.75rem;">${p.file_name}</span>
          <button class="btn btn-secondary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="downloadDataUrl('${p.dataUrl}', '${p.file_name}')">
            Enregistrer
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Save ZIP containing all images
    const baseName = batch[0].base_name || 'PDF_Images';
    const zipName = `${baseName}.zip`;
    MobileEngine.saveFile(res.zipBytes, zipName, 'application/zip');

    sec.style.display = 'block';
    sec.scrollIntoView({ behavior: 'smooth' });
    showToast(`${res.pages.length} pages extraites et enregistrées en ZIP !`);
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 12. Word to PDF / PDF to Word offline client-side handlers
async function executeWordToPdf() {
  const batch = batchFilesMap['word-to-pdf'] || [];
  if (batch.length === 0) {
    showToast('Veuillez sélectionner au moins un fichier Word (.docx)');
    return;
  }
  const modeSingleEl = document.getElementById('w2p-mode-single');
  const mergeSingle = modeSingleEl ? modeSingleEl.checked : true;
  showToast('Conversion Word vers PDF en cours...');
  try {
    const res = await MobileEngine.batchWordToPdf(batch, mergeSingle);
    const baseName = batch[0].base_name || 'Document_Word';
    let dlName = '';
    let mime = 'application/pdf';
    if (res.isZip) {
      dlName = `${baseName}_PDFs.zip`;
      mime = 'application/zip';
    } else {
      dlName = `${baseName}.pdf`;
    }
    const b64 = MobileEngine.saveFile(res.bytes, dlName, mime);
    renderResultBanner('word-to-pdf-panel', dlName, '', 'Word en PDF (DOCX)', b64, mime, res.bytes);
    showToast('Conversion Word en PDF terminée avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

async function executeToWord() {
  const batch = batchFilesMap['to-word'] || [];
  if (batch.length === 0) {
    showToast('Veuillez sélectionner au moins un fichier PDF');
    return;
  }
  const modeSingleEl = document.getElementById('to-word-mode-single');
  const mergeSingle = modeSingleEl ? modeSingleEl.checked : false;
  showToast('Conversion PDF vers Word (.docx) en cours...');
  try {
    const res = await MobileEngine.batchPdfToWord(batch, mergeSingle);
    const baseName = batch[0].base_name || 'Document';
    let dlName = '';
    let mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (res.isZip) {
      dlName = `${baseName}_Word.zip`;
      mime = 'application/zip';
    } else {
      dlName = `${baseName}.docx`;
    }
    const b64 = MobileEngine.saveFile(res.bytes, dlName, mime);
    renderResultBanner('to-word-panel', dlName, '', 'PDF en Word (DOCX)', b64, mime, res.bytes);
    showToast('Conversion PDF en Word (.docx) terminée avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

function downloadDataUrl(dataUrl, filename) {
  const arr = dataUrl.split(',');
  const mime = arr[0].match(/:(.*?);/)[1];
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  MobileEngine.saveFile(u8arr, filename, mime);
}

// 12. Compress PDF
async function executeCompressPdf() {
  const file = activeFileMap['compress'];
  if (!file) return;

  showToast('Compression du PDF...');
  try {
    // Re-pack streams and flatten AcroForms to reduce weight
    const bytes = await MobileEngine.flattenPdf(file);
    const dlName = `${file.base_name}_compresse.pdf`;
    const b64 = MobileEngine.saveFile(bytes, dlName, 'application/pdf');
    renderResultBanner('compress-panel', dlName, '', 'Compresser PDF', b64, 'application/pdf', bytes);
    showToast('Document compressé et enregistré !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

/* ========================================================
   FILE CLEARING, THUMBNAIL PREVIEWS & PROCESSED HISTORY
   ======================================================== */

function clearAllWorkspacesAndFiles(showNotification = false) {
  activeFileMap = {};
  for (const k in batchFilesMap) {
    batchFilesMap[k] = [];
  }
  if (typeof selectedImages !== 'undefined') selectedImages = [];

  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.value = '';
  });

  document.querySelectorAll('.dropzone').forEach(dz => {
    dz.style.display = 'block';
  });
  document.querySelectorAll('[id$="-panel"], #img-panel').forEach(p => {
    p.style.display = 'none';
  });

  document.querySelectorAll('.batch-file-list').forEach(el => {
    el.innerHTML = '';
  });

  document.querySelectorAll('.result-banner').forEach(el => {
    if (el.parentElement) el.parentElement.style.display = 'none';
  });

  document.querySelectorAll('.preview-container').forEach(el => {
    el.innerHTML = '';
    el.style.display = 'none';
  });

  document.querySelectorAll('[id$="-filename"], [id$="-name"]').forEach(el => {
    if (el.tagName === 'STRONG' || el.tagName === 'SPAN') {
      el.textContent = '0 document(s) sélectionné(s)';
    }
  });

  if (showNotification) {
    showToast('Fichiers joints vidés.');
  }
}

function goToHomeAndClear() {
  clearAllWorkspacesAndFiles(true);
  switchView('dashboard');
  closeNavDrawer();
}

async function renderFilePreviewThumbnails(tool, files) {
  const container = document.getElementById(`${tool}-preview-container`);
  if (!container) return;

  container.innerHTML = '';
  const fileList = Array.isArray(files) ? files : [files];
  if (!fileList || fileList.length === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  const label = document.createElement('div');
  label.className = 'preview-header-label';
  label.innerHTML = `<span>👁️ Aperçu des documents (${fileList.length})</span>`;
  container.appendChild(label);

  const grid = document.createElement('div');
  grid.className = 'selected-preview-grid';

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    if (!file) continue;

    const isImg = (file.type && file.type.startsWith('image/')) || /\.(png|jpg|jpeg|webp|bmp|gif)$/i.test(file.name);
    const isPdf = (file.type && file.type.includes('pdf')) || /\.pdf$/i.test(file.name);
    const isWord = /\.docx?$/i.test(file.name);

    const card = document.createElement('div');
    card.className = 'selected-preview-card';

    if (isImg) {
      const url = URL.createObjectURL(file);
      card.innerHTML = `
        <div class="thumb-img-wrapper">
          <img src="${url}" alt="${escapeHtml(file.name)}">
          <span class="thumb-badge">Image ${i + 1}</span>
        </div>
        <div class="thumb-meta" dir="auto" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
      `;
      grid.appendChild(card);
    } else if (isPdf && typeof pdfjsLib !== 'undefined') {
      const thumbWrapper = document.createElement('div');
      thumbWrapper.className = 'thumb-img-wrapper';
      thumbWrapper.innerHTML = `
        <div class="thumb-loading-placeholder">📄 Chargement aperçu...</div>
        <span class="thumb-badge">PDF ${i + 1}</span>
      `;
      const meta = document.createElement('div');
      meta.className = 'thumb-meta';
      meta.setAttribute('dir', 'auto');
      meta.setAttribute('title', file.name);
      meta.textContent = file.name;

      card.appendChild(thumbWrapper);
      card.appendChild(meta);
      grid.appendChild(card);

      (async () => {
        try {
          const buf = await file.slice(0, 1024 * 1024 * 6).arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 0.25 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
          thumbWrapper.innerHTML = '';
          thumbWrapper.appendChild(canvas);
          const badge = document.createElement('span');
          badge.className = 'thumb-badge';
          badge.textContent = `${pdf.numPages} p.`;
          thumbWrapper.appendChild(badge);
        } catch (e) {
          thumbWrapper.innerHTML = `<div class="thumb-icon-placeholder">📄</div><span class="thumb-badge">PDF</span>`;
        }
      })();
    } else if (isWord) {
      card.innerHTML = `
        <div class="thumb-img-wrapper" style="background:#eff6ff;">
          <div class="thumb-icon-placeholder" style="color:#2563eb;">📝</div>
          <span class="thumb-badge">DOCX</span>
        </div>
        <div class="thumb-meta" dir="auto" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
      `;
      grid.appendChild(card);
    }
  }

  container.appendChild(grid);
}

// In-memory active cache to prevent localStorage quota exhaustion for large documents
window._processedBlobs = window._processedBlobs || {};

const HISTORY_KEY = 'pdf_studio_treated_history';

function getProcessedFiles() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function addProcessedFile(name, toolName, downloadUrl = null, sizeStr = '', base64Data = null, mimeType = 'application/pdf', bytes = null) {
  let history = getProcessedFiles();
  const id = 'f_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);

  // Keep complete data in session cache
  window._processedBlobs[id] = {
    id: id,
    name: name,
    toolName: toolName || 'PDF Studio',
    mimeType: mimeType || 'application/pdf',
    base64Data: base64Data,
    bytes: bytes,
    downloadUrl: downloadUrl
  };

  const item = {
    id: id,
    name: name,
    toolName: toolName || 'PDF Studio',
    downloadUrl: downloadUrl,
    sizeStr: sizeStr || (bytes ? formatBytes(bytes.length) : ''),
    mimeType: mimeType || 'application/pdf',
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    dateStr: new Date().toLocaleDateString('fr-FR'),
    // Store in localStorage if small, else retain in session cache
    base64Data: (base64Data && base64Data.length < 1500000) ? base64Data : null
  };

  history = [item, ...history.filter(h => h.name !== name)].slice(0, 30);
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (e) {
    history.forEach(h => delete h.base64Data);
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (ignore) {}
  }
  updateHistoryUI();
  return item;
}

function removeProcessedFile(id) {
  let history = getProcessedFiles();
  history = history.filter(h => h.id !== id);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  if (window._processedBlobs && window._processedBlobs[id]) {
    delete window._processedBlobs[id];
  }
  updateHistoryUI();
  showToast('Fichier retiré');
}

function clearProcessedHistory() {
  localStorage.removeItem(HISTORY_KEY);
  window._processedBlobs = {};
  updateHistoryUI();
  showToast('Historique vidé');
}

function getFileItem(id) {
  if (window._processedBlobs && window._processedBlobs[id]) {
    return window._processedBlobs[id];
  }
  const history = getProcessedFiles();
  return history.find(h => h.id === id);
}

function openProcessedFile(id) {
  const item = getFileItem(id);
  if (!item) return;

  const base64Data = item.base64Data;
  const mimeType = item.mimeType || 'application/pdf';

  if (window.AndroidBridge && window.AndroidBridge.openBase64File && base64Data) {
    window.AndroidBridge.openBase64File(base64Data, item.name, mimeType);
    showToast('Ouverture de ' + item.name);
  } else if (base64Data) {
    try {
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const byteCharacters = atob(cleanData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      if (mimeType === 'application/pdf' || mimeType.startsWith('image/')) {
        window.open(blobUrl, '_blank');
      } else {
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = item.name;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        }, 500);
      }
    } catch (e) {
      showToast('Erreur : ' + e.message);
    }
  } else if (item.downloadUrl) {
    window.open(item.downloadUrl, '_blank');
  } else {
    showToast('Fichier disponible dans vos Téléchargements : ' + item.name);
  }
}

function shareProcessedFile(id) {
  const item = getFileItem(id);
  if (!item) return;

  const base64Data = item.base64Data;
  const mimeType = item.mimeType || 'application/pdf';

  if (window.AndroidBridge && window.AndroidBridge.shareBase64File && base64Data) {
    window.AndroidBridge.shareBase64File(base64Data, item.name, mimeType);
  } else if (base64Data) {
    try {
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const byteCharacters = atob(cleanData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const file = new File([blob], item.name, { type: mimeType });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
          files: [file],
          title: item.name,
          text: `Document traité avec PDF Studio Pro : ${item.name}`
        }).catch(err => {
          if (err.name !== 'AbortError') console.error(err);
        });
      } else {
        openProcessedFile(id);
      }
    } catch (e) {
      showToast('Partage indisponible : ' + e.message);
    }
  } else {
    showToast('Document disponible dans vos Téléchargements');
  }
}

async function previewProcessedFile(id) {
  const item = getFileItem(id);
  if (!item) return;

  const modal = document.getElementById('document-preview-modal');
  const titleEl = document.getElementById('doc-preview-title');
  const bodyEl = document.getElementById('doc-preview-body');
  const shareBtn = document.getElementById('doc-preview-share-btn');
  const openBtn = document.getElementById('doc-preview-open-btn');

  if (!modal || !bodyEl) return;

  if (titleEl) titleEl.textContent = `👁️ ${item.name}`;
  if (shareBtn) shareBtn.onclick = () => shareProcessedFile(item.id);
  if (openBtn) openBtn.onclick = () => openProcessedFile(item.id);

  bodyEl.innerHTML = `<div style="padding:2.5rem; color:#fff;"><p>Chargement de l'aperçu du document...</p></div>`;
  modal.classList.add('active');

  try {
    const base64Data = item.base64Data;
    const mimeType = item.mimeType || 'application/pdf';

    if (!base64Data && !item.bytes) {
      bodyEl.innerHTML = `
        <div style="background:#1e293b; border-radius:8px; padding:2rem; max-width:500px; margin:2rem auto; color:#fff;">
          <p style="font-size:1.1rem; margin-bottom:1rem;">Document volumineux déjà enregistré sur votre appareil.</p>
          <button class="btn btn-primary" onclick="openProcessedFile('${item.id}')">Ouvrir dans une application</button>
        </div>
      `;
      return;
    }

    let byteArray;
    if (item.bytes) {
      byteArray = item.bytes;
    } else {
      const cleanData = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
      const byteCharacters = atob(cleanData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      byteArray = new Uint8Array(byteNumbers);
    }

    if (mimeType === 'application/pdf' || item.name.toLowerCase().endsWith('.pdf')) {
      const pdf = await pdfjsLib.getDocument({ data: byteArray }).promise;
      const numPages = pdf.numPages;

      bodyEl.innerHTML = `
        <div style="color:#e2e8f0; font-size:0.85rem; margin-bottom:1rem; text-align:center;">
          Document PDF — ${numPages} page(s)
        </div>
        <div id="pdf-preview-pages-container" style="display:flex; flex-direction:column; gap:1.25rem; align-items:center;"></div>
      `;
      const pagesContainer = document.getElementById('pdf-preview-pages-container');

      const renderCount = Math.min(numPages, 12);
      for (let pNum = 1; pNum <= renderCount; pNum++) {
        const page = await pdf.getPage(pNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(750 / unscaledViewport.width, 1.6);
        const viewport = page.getViewport({ scale: scale });

        const pageCard = document.createElement('div');
        pageCard.style.cssText = 'background:#fff; border-radius:4px; box-shadow:0 4px 12px rgba(0,0,0,0.3); overflow:hidden; display:inline-block; max-width:100%;';

        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.cssText = 'display:block; max-width:100%; height:auto;';

        const pageLabel = document.createElement('div');
        pageLabel.style.cssText = 'padding:4px 8px; font-size:0.75rem; background:#f1f5f9; color:#475569; text-align:right; border-top:1px solid #e2e8f0;';
        pageLabel.textContent = `Page ${pNum} sur ${numPages}`;

        pageCard.appendChild(canvas);
        pageCard.appendChild(pageLabel);
        pagesContainer.appendChild(pageCard);

        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      }

      if (numPages > renderCount) {
        const moreNote = document.createElement('p');
        moreNote.style.cssText = 'color:#e2e8f0; font-size:0.85rem; margin-top:1rem;';
        moreNote.textContent = `+ ${numPages - renderCount} autres pages (utilisez "Ouvrir" pour visualiser le document complet).`;
        pagesContainer.appendChild(moreNote);
      }
    } else if (mimeType.startsWith('image/')) {
      const blob = new Blob([byteArray], { type: mimeType });
      const imgUrl = URL.createObjectURL(blob);
      bodyEl.innerHTML = `
        <img src="${imgUrl}" style="max-width:100%; max-height:75vh; border-radius:6px; box-shadow:0 4px 16px rgba(0,0,0,0.3);" alt="${escapeHtml(item.name)}">
      `;
    } else {
      bodyEl.innerHTML = `
        <div style="background:#fff; border-radius:8px; padding:2rem; max-width:500px; margin:2rem auto; text-align:center; color:#1e293b;">
          <div style="font-size:3rem; margin-bottom:1rem;">📄</div>
          <h4 style="margin:0 0 0.5rem 0; font-size:1.15rem;">${escapeHtml(item.name)}</h4>
          <p style="color:#64748b; font-size:0.9rem; margin-bottom:1.5rem;">Document Word / Archive prêt à être visualisé dans votre application bureautique.</p>
          <div style="display:flex; justify-content:center; gap:0.75rem; flex-wrap:wrap;">
            <button class="btn btn-primary" onclick="openProcessedFile('${item.id}')">Ouvrir dans Word / Office</button>
            <button class="btn btn-secondary" onclick="shareProcessedFile('${item.id}')">Partager</button>
          </div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Preview error:', err);
    bodyEl.innerHTML = `
      <div style="color:#f87171; padding:2rem; text-align:center;">
        <p>Aperçu direct indisponible pour ce format (${err.message}).</p>
        <button class="btn btn-secondary" style="margin-top:1rem;" onclick="openProcessedFile('${item.id}')">
          Ouvrir avec une application externe
        </button>
      </div>
    `;
  }
}

function closeDocumentPreviewModal() {
  const modal = document.getElementById('document-preview-modal');
  if (modal) modal.classList.remove('active');
}

function getFileIconEmoji(mimeType, filename) {
  if (mimeType === 'application/pdf' || filename.endsWith('.pdf')) return '📕';
  if (mimeType.includes('word') || filename.endsWith('.docx') || filename.endsWith('.doc')) return '📝';
  if (mimeType.includes('zip') || filename.endsWith('.zip')) return '📦';
  if (mimeType.startsWith('image/')) return '🖼️';
  return '📄';
}

function updateHistoryUI() {
  const history = getProcessedFiles();
  const count = history.length;

  const navBadge = document.getElementById('nav-history-badge');
  if (navBadge) navBadge.textContent = count;
  const modalBadge = document.getElementById('modal-history-badge');
  if (modalBadge) modalBadge.textContent = count;

  const drawerList = document.getElementById('drawer-recent-list');
  if (drawerList) {
    if (count === 0) {
      drawerList.innerHTML = `<p style="font-size:0.75rem; color:var(--text-muted); text-align:center; padding:0.5rem;">Aucun document traité.</p>`;
    } else {
      drawerList.innerHTML = history.slice(0, 6).map(item => `
        <div class="drawer-recent-item">
          <div class="drawer-recent-info" onclick="openProcessedFile('${item.id}')" title="Cliquer pour ouvrir" style="flex:1; overflow:hidden; cursor:pointer;">
            <span class="drawer-recent-name" dir="auto">${escapeHtml(item.name)}</span>
            <span class="drawer-recent-tool">${escapeHtml(item.toolName)} • ${item.timestamp}</span>
          </div>
          <div style="display:flex; gap:0.25rem; align-items:center; flex-shrink:0;">
            <button class="btn-icon-tiny" onclick="previewProcessedFile('${item.id}')" title="Visualiser">👁️</button>
            <button class="btn-icon-tiny" onclick="shareProcessedFile('${item.id}')" title="Partager">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            <button class="btn-icon-tiny" onclick="openProcessedFile('${item.id}')" title="Ouvrir">↗️</button>
          </div>
        </div>
      `).join('');
    }
  }

  const modalList = document.getElementById('modal-history-list');
  if (modalList) {
    if (count === 0) {
      modalList.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:2rem 0;">Aucun document traité pour l'instant.</p>`;
    } else {
      modalList.innerHTML = history.map(item => `
        <div class="history-card-item">
          <div style="display:flex; align-items:center; gap:0.75rem; overflow:hidden; flex:1; cursor:pointer;" onclick="openProcessedFile('${item.id}')" title="Cliquer pour ouvrir directement">
            <div style="font-size:1.5rem; flex-shrink:0;">${getFileIconEmoji(item.mimeType, item.name)}</div>
            <div style="overflow:hidden;">
              <strong dir="auto" class="filename-text" style="display:block; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--primary);">${escapeHtml(item.name)}</strong>
              <div style="font-size:0.75rem; color:var(--text-muted);">
                <span class="tool-badge" style="background:var(--bg-subtle); padding:1px 6px;">${escapeHtml(item.toolName)}</span>
                ${item.dateStr} à ${item.timestamp} ${item.sizeStr ? '• ' + item.sizeStr : ''}
              </div>
            </div>
          </div>
          <div style="display:flex; align-items:center; gap:0.4rem; flex-shrink:0;">
            <button class="btn btn-secondary btn-icon-sm" onclick="previewProcessedFile('${item.id}')" title="Visualiser / Aperçu">
              👁️
            </button>
            <button class="btn btn-secondary btn-icon-sm" onclick="shareProcessedFile('${item.id}')" title="Partager (WhatsApp, Mail...)">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            </button>
            <button class="btn btn-primary btn-sm" onclick="openProcessedFile('${item.id}')" title="Ouvrir dans une application">
              Ouvrir
            </button>
            <button class="btn btn-secondary btn-icon-sm" onclick="removeProcessedFile('${item.id}')" title="Retirer de l'historique">
              ✕
            </button>
          </div>
        </div>
      `).join('');
    }
  }
}

function openProcessedFilesModal() {
  updateHistoryUI();
  const modal = document.getElementById('processed-files-modal');
  if (modal) modal.classList.add('active');
}

function closeProcessedFilesModal() {
  const modal = document.getElementById('processed-files-modal');
  if (modal) modal.classList.remove('active');
}

function toggleNavDrawer() {
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('nav-drawer-backdrop');
  if (!drawer || !backdrop) return;
  const isOpen = drawer.classList.contains('active');
  if (isOpen) {
    closeNavDrawer();
  } else {
    drawer.classList.add('active');
    backdrop.classList.add('active');
    updateHistoryUI();
  }
}

function closeNavDrawer() {
  const drawer = document.getElementById('nav-drawer');
  const backdrop = document.getElementById('nav-drawer-backdrop');
  if (drawer) drawer.classList.remove('active');
  if (backdrop) backdrop.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
  updateHistoryUI();
});
