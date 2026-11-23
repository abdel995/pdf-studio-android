/**
 * Mobile Application Script for PDF Studio Pro
 * 100% Offline Client-Side Mobile Processing
 */

let currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
  document.documentElement.setAttribute('data-theme', 'dark');
}

// Active single file state for single-file tools (stores native File objects)
let activeFileMap = {};

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
}

function filterTools() {
  const query = document.getElementById('tool-search').value.toLowerCase().trim();
  const cards = document.querySelectorAll('#tools-container .tool-card');
  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? 'flex' : 'none';
  });
}

function triggerFileInput(id) {
  const el = document.getElementById(id);
  if (el) el.click();
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

function renderResultBanner(containerId, downloadName, customHtml = '') {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="result-banner">
      <h2>🎉 Traitement Terminé avec Succès !</h2>
      <p>Votre document <strong>${downloadName}</strong> a été généré et enregistré dans votre dossier <strong>Téléchargements</strong>.</p>
      ${customHtml}
      <div class="result-actions" style="margin-top: 1rem;">
        <button class="btn btn-white btn-lg" onclick="showToast('Fichier disponible dans Téléchargements : ${downloadName}')">
          ✓ Fichier Enregistré
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('watermark-panel', dlName);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('page-numbers-panel', dlName);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('remove-pages-panel', dlName);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('flatten-panel', dlName);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('rotate-fast-panel', dlName);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('bates-panel', dlName);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('metadata-panel', dlName);
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

  showToast('Conversion des images en PDF...');
  try {
    const bytes = await MobileEngine.imagesToPdf(selectedImages, pageSize, orientation, margin);
    const firstImg = selectedImages[0].name;
    const baseName = firstImg.substring(0, firstImg.lastIndexOf('.')) || 'Images_Converties';
    const dlName = `${baseName}.pdf`;
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('img-result', dlName);
    showToast('PDF créé avec succès !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}

// 11. PDF to Images
async function executePdfToImages() {
  const file = activeFileMap['pdf-to-img'];
  if (!file) return;

  showToast('Extraction des pages en images...');
  try {
    const pages = await MobileEngine.pdfToImages(file, 2.0);
    const sec = document.getElementById('p2i-gallery-section');
    const grid = document.getElementById('p2i-gallery-grid');
    grid.innerHTML = '';

    pages.forEach(p => {
      const card = document.createElement('div');
      card.className = 'organizer-card';
      card.innerHTML = `
        <div class="page-thumb-container">
          <img src="${p.thumbnail}" class="page-thumb-img" alt="Page ${p.page_number}">
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 0.5rem;">
          <span class="page-num-tag">Page ${p.page_number}</span>
          <button class="btn btn-secondary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" onclick="downloadDataUrl('${p.dataUrl}', '${file.base_name}_p${p.page_number}.png')">
            Enregistrer
          </button>
        </div>
      `;
      grid.appendChild(card);
    });

    sec.style.display = 'block';
    sec.scrollIntoView({ behavior: 'smooth' });
    showToast(`${pages.length} pages extraites avec succès !`);
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
    MobileEngine.saveFile(bytes, dlName);
    renderResultBanner('compress-panel', dlName);
    showToast('Document compressé et enregistré !');
  } catch (err) {
    showToast('Erreur : ' + err.message);
  }
}
