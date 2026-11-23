/**
 * Organize & Merge Module (iLovePDF Style)
 */

let organizePages = []; // Array of { file_id, file_name, page_index, rotation, thumbnail }
let organizeFilesMap = {}; // file_id -> file_name

async function handleOrganizeUpload(fileList) {
  if (!fileList || fileList.length === 0) return;

  try {
    const uploaded = await uploadFilesToServer(fileList);
    for (const f of uploaded) {
      organizeFilesMap[f.id] = f.name;
      // Fetch page info and thumbnails
      const res = await fetch('/api/pdf-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file_id: f.id })
      });
      const data = await res.json();
      if (data.success) {
        data.data.pages.forEach(p => {
          organizePages.push({
            file_id: f.id,
            file_name: f.name,
            page_index: p.index,
            rotation: p.rotation || 0,
            thumbnail: p.thumbnail
          });
        });
      }
    }

    document.getElementById('dropzone-organize').style.display = 'none';
    document.getElementById('organize-panel').style.display = 'block';
    renderOrganizeGrid();
  } catch (err) {
    console.error(err);
  }
}

function renderOrganizeGrid() {
  const grid = document.getElementById('organize-pages-grid');
  const countTag = document.getElementById('organize-total-pages');
  countTag.textContent = `${organizePages.length} page(s) au total`;
  grid.innerHTML = '';

  organizePages.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'organizer-card';
    card.draggable = true;

    card.innerHTML = `
      <div class="page-thumb-container">
        <img src="${item.thumbnail}" class="page-thumb-img" style="transform: rotate(${item.rotation}deg);" alt="Page ${index + 1}">
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.35rem;">
        <span class="page-num-tag">#${index + 1} (orig. p.${item.page_index + 1})</span>
        <span style="font-size: 0.7rem; color: var(--text-muted);">${item.rotation}°</span>
      </div>
      <div class="organizer-controls">
        <button class="organizer-btn" onclick="rotatePage(${index}, -90)" title="Pivoter -90°">↺</button>
        <button class="organizer-btn" onclick="rotatePage(${index}, 90)" title="Pivoter +90°">↻</button>
        <button class="organizer-btn" onclick="duplicatePage(${index})" title="Dupliquer">📋</button>
        <button class="organizer-btn" style="color:#ef4444;" onclick="deletePage(${index})" title="Supprimer">🗑️</button>
      </div>
    `;

    // Drag & Drop reordering
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
        const pageItem = organizePages.splice(fromIdx, 1)[0];
        organizePages.splice(index, 0, pageItem);
        renderOrganizeGrid();
      }
    });

    grid.appendChild(card);
  });
}

function rotatePage(index, deg) {
  organizePages[index].rotation = (organizePages[index].rotation + deg + 360) % 360;
  renderOrganizeGrid();
}

function rotateAllPages(deg) {
  organizePages.forEach(p => {
    p.rotation = (p.rotation + deg + 360) % 360;
  });
  renderOrganizeGrid();
}

function duplicatePage(index) {
  const copy = { ...organizePages[index] };
  organizePages.splice(index + 1, 0, copy);
  renderOrganizeGrid();
}

function deletePage(index) {
  organizePages.splice(index, 1);
  if (organizePages.length === 0) {
    document.getElementById('dropzone-organize').style.display = 'block';
    document.getElementById('organize-panel').style.display = 'none';
  } else {
    renderOrganizeGrid();
  }
}

async function executeOrganizePdf() {
  if (organizePages.length === 0) {
    showToast('Aucune page à organiser', 'error');
    return;
  }

  showToast('Recomposition et fusion du document...', 'info');
  try {
    const payload = organizePages.map(p => ({
      file_id: p.file_id,
      page_index: p.page_index,
      rotation: p.rotation
    }));

    const res = await fetch('/api/organize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: payload })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);

    renderResultBanner('organize-result', data.download_url, data.filename, '', data.download_name);
    showToast('Document réorganisé avec succès !', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
