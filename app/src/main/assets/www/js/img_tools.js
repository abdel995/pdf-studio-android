/**
 * Images to PDF & PDF to Images Module
 */

let selectedImages = []; // Array of uploaded image file objects

async function handleImageFiles(fileList) {
  if (!fileList || fileList.length === 0) return;
  try {
    const uploaded = await uploadFilesToServer(fileList);
    selectedImages = selectedImages.concat(uploaded);
    renderImageThumbnails();

    document.getElementById('dropzone-img').style.display = 'none';
    document.getElementById('img-panel').style.display = 'block';
  } catch (err) {
    console.error(err);
  }
}

function renderImageThumbnails() {
  const container = document.getElementById('img-thumbnails');
  const countText = document.getElementById('img-count-text');
  countText.textContent = `${selectedImages.length} image(s) sélectionnée(s)`;
  container.innerHTML = '';

  selectedImages.forEach((img, index) => {
    const card = document.createElement('div');
    card.className = 'organizer-card';
    card.draggable = true;

    card.innerHTML = `
      <div class="page-thumb-container">
        <img src="/view/${img.id}" class="page-thumb-img" alt="${img.name}" onerror="this.src='/static/icons/image-placeholder.svg'">
      </div>
      <div style="font-size: 0.8rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.35rem;" title="${img.name}">
        ${index + 1}. ${img.name}
      </div>
      <div class="organizer-controls">
        <button class="organizer-btn" onclick="moveImage(${index}, -1)" ${index === 0 ? 'disabled' : ''} title="Déplacer vers la gauche">◀</button>
        <button class="organizer-btn" onclick="moveImage(${index}, 1)" ${index === selectedImages.length - 1 ? 'disabled' : ''} title="Déplacer vers la droite">▶</button>
        <button class="organizer-btn" style="color:#ef4444;" onclick="removeImage(${index})" title="Supprimer">🗑️</button>
      </div>
    `;

    // Drag and drop ordering
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
      card.classList.add('dragging');
    });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
    card.addEventListener('dragover', (e) => e.preventDefault());
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(fromIdx) && fromIdx !== index) {
        const item = selectedImages.splice(fromIdx, 1)[0];
        selectedImages.splice(index, 0, item);
        renderImageThumbnails();
      }
    });

    container.appendChild(card);
  });
}

function moveImage(index, dir) {
  const target = index + dir;
  if (target < 0 || target >= selectedImages.length) return;
  const temp = selectedImages[index];
  selectedImages[index] = selectedImages[target];
  selectedImages[target] = temp;
  renderImageThumbnails();
}

function removeImage(index) {
  selectedImages.splice(index, 1);
  if (selectedImages.length === 0) {
    document.getElementById('dropzone-img').style.display = 'block';
    document.getElementById('img-panel').style.display = 'none';
  } else {
    renderImageThumbnails();
  }
}

async function executeImagesToPdf() {
  if (selectedImages.length === 0) {
    showToast('Veuillez ajouter au moins une image', 'error');
    return;
  }

  const pageSize = document.getElementById('img-page-size').value;
  const orientation = document.getElementById('img-orientation').value;
  const margin = parseInt(document.getElementById('img-margin').value, 10);

  showToast('Conversion des images en PDF...', 'info');

  try {
    const res = await fetch('/api/images-to-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_ids: selectedImages.map(img => img.id),
        page_size: pageSize,
        orientation: orientation,
        margin: margin
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderResultBanner('img-result', data.download_url, data.filename, '', data.download_name);
    showToast('PDF créé avec succès !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// PDF TO IMAGES
async function executePdfToImages() {
  const file = activeFileMap['pdf-to-img'];
  if (!file) return;

  const fmt = document.getElementById('p2i-format').value;
  const dpi = parseInt(document.getElementById('p2i-dpi').value, 10);
  const pages = document.getElementById('p2i-pages').value.trim() || null;

  showToast('Rendu et extraction des pages en haute définition...', 'info');

  try {
    const res = await fetch('/api/pdf-to-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        file_id: file.id,
        format: fmt,
        dpi: dpi,
        pages: pages
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    // Populate gallery
    const sec = document.getElementById('p2i-gallery-section');
    const grid = document.getElementById('p2i-gallery-grid');
    const zipLink = document.getElementById('p2i-zip-link');
    
    zipLink.href = data.zip_download_url;
    zipLink.download = data.zip_filename;
    grid.innerHTML = '';

    data.pages.forEach(p => {
      const card = document.createElement('div');
      card.className = 'organizer-card';
      card.innerHTML = `
        <div class="page-thumb-container">
          <img src="${p.thumbnail}" class="page-thumb-img" alt="Page ${p.page_number}">
        </div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 0.5rem;">
          <span class="page-num-tag">Page ${p.page_number}</span>
          <a class="btn btn-secondary" style="font-size:0.75rem; padding:0.25rem 0.5rem;" href="${p.download_url}" download="${p.file_name}">
            Télécharger
          </a>
        </div>
      `;
      grid.appendChild(card);
    });

    sec.style.display = 'block';
    sec.scrollIntoView({ behavior: 'smooth' });
    showToast(`${data.pages.length} page(s) extraite(s) avec succès !`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
