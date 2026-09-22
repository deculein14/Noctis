// ---------- Folders (Images & Videos) ----------

let pendingFolder = null;
let editingFolderId = null;
let currentOpenFolderId = null;

const mediaMainView = document.getElementById("media-main-view");
const folderDetailView = document.getElementById("folder-detail-view");
const foldersContainer = document.getElementById("folders-container");
const addFolderButton = document.getElementById("add-folder-button");

function showMediaMainView() {
  mediaMainView.style.display = "block";
  folderDetailView.style.display = "none";
  fadeInView(mediaMainView);
  resetScroll();
  loadFolders();
}

async function loadFolders() {
  const folders = await window.pywebview.api.get_folders();
  foldersContainer.innerHTML = "";

  if (folders.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No folders yet.";
    foldersContainer.appendChild(empty);
    return;
  }

  folders.forEach((folder) => {
    foldersContainer.appendChild(buildFolderRow(folder));
  });
}

function buildFolderRow(folder) {
  const row = document.createElement("div");
  row.className = "entry-row";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", `Open ${folder.name}`);

  const descriptionHtml = folder.description
    ? `<p>${escapeHtml(folder.description)}</p>`
    : `<p>No description</p>`;

  row.innerHTML = `
    <div class="entry-info">
      <h3>${escapeHtml(folder.name)}</h3>
      ${descriptionHtml}
    </div>
  `;

  const openThisFolder = () => openFolder(folder);

  row.addEventListener("click", openThisFolder);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      openThisFolder();
    }
  });
  row.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showFolderContextMenu(event.pageX, event.pageY, folder);
  });

  return row;
}

function showFolderContextMenu(x, y, folder) {
  const existing = document.getElementById("folder-context-menu");
  if (existing) existing.remove();

  const menu = document.createElement("div");
  menu.id = "folder-context-menu";
  menu.style.cssText = `
    position: fixed;
    top: ${y}px;
    left: ${x}px;
    background: #1A1D24;
    border: 1px solid #2A2E38;
    border-radius: 6px;
    padding: 4px;
    z-index: 200;
    min-width: 120px;
  `;

  const editOption = document.createElement("div");
  editOption.textContent = "Edit";
  editOption.style.cssText = "padding: 8px 12px; cursor: pointer; font-size: 13px; border-radius: 4px;";
  editOption.addEventListener("mouseenter", () => editOption.style.background = "#22262F");
  editOption.addEventListener("mouseleave", () => editOption.style.background = "transparent");
  editOption.addEventListener("click", () => {
    menu.remove();
    startEditFolderForm(folder);
  });

  const deleteOption = document.createElement("div");
  deleteOption.textContent = "Delete";
  deleteOption.style.cssText = "padding: 8px 12px; cursor: pointer; font-size: 13px; color: #EF4444; border-radius: 4px;";
  deleteOption.addEventListener("mouseenter", () => deleteOption.style.background = "#22262F");
  deleteOption.addEventListener("mouseleave", () => deleteOption.style.background = "transparent");
  deleteOption.addEventListener("click", async () => {
    menu.remove();
    const confirmed = confirm(`Delete folder "${folder.name}"? This will also delete everything inside it. This cannot be undone.`);
    if (confirmed) {
      await window.pywebview.api.delete_folder(folder.id);
      loadFolders();
    }
  });

  menu.appendChild(editOption);
  menu.appendChild(deleteOption);
  document.body.appendChild(menu);

  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

addFolderButton.addEventListener("click", () => {
  startNewFolderForm();
});

function startNewFolderForm() {
  pendingFolder = { name: "", description: "" };
  editingFolderId = null;
  renderFolderForm();
}

function startEditFolderForm(folder) {
  pendingFolder = { name: folder.name || "", description: folder.description || "" };
  editingFolderId = folder.id;
  renderFolderForm();
}

function renderFolderForm() {
  openModal(`
    <p class="modal-title">${editingFolderId !== null ? "Edit Folder" : "New Folder"}</p>
    <div class="modal-field">
      <label>Folder Name</label>
      <input type="text" id="folder-name-input" value="${escapeHtml(pendingFolder.name)}">
    </div>
    <div class="modal-field">
      <label>Description (optional)</label>
      <input type="text" id="folder-description-input" value="${escapeHtml(pendingFolder.description)}">
    </div>
    <p class="modal-error" id="folder-error"></p>
    <div class="modal-button-row">
      <button class="modal-secondary" id="folder-cancel">Cancel</button>
      <button class="modal-primary" id="folder-save">Save</button>
    </div>
  `);

  document.getElementById("folder-cancel").addEventListener("click", closeFolderModal);
  document.getElementById("folder-save").addEventListener("click", onFolderSave);
}

function closeFolderModal() {
  closeModal();
  pendingFolder = null;
  editingFolderId = null;
}

async function onFolderSave() {
  const name = document.getElementById("folder-name-input").value.trim();
  const description = document.getElementById("folder-description-input").value.trim();
  const errorLabel = document.getElementById("folder-error");

  if (!name) {
    errorLabel.textContent = "Folder name is required.";
    return;
  }

  const dataToSave = { name: name, description: description };

  let result;
  if (editingFolderId !== null) {
    result = await window.pywebview.api.update_folder(editingFolderId, dataToSave);
  } else {
    result = await window.pywebview.api.save_folder(dataToSave);
  }

  if (!result.success) {
    errorLabel.textContent = result.message;
    return;
  }

  closeFolderModal();
  loadFolders();
}

async function openFolder(folder) {
  const entered = await promptForMasterPassword(`Enter your master password to open "${folder.name}"`);
  if (entered === null) return;

  const result = await window.pywebview.api.open_folder(folder.id, entered);
  if (!result.success) {
    alert(result.message);
    return;
  }

  showFolderDetailView(result);
}

function showFolderDetailView(folder) {
  currentOpenFolderId = folder.id;

  mediaMainView.style.display = "none";
  folderDetailView.style.display = "block";
  fadeInView(folderDetailView);
  resetScroll();

  folderDetailView.innerHTML = `
    <div class="detail-card">
      <div class="detail-hero">
        <div class="detail-avatar" style="background: ${getAvatarColor(folder.name)}">${escapeHtml((folder.name || "?").trim().charAt(0).toUpperCase())}</div>
        <div>
          <h1 class="detail-hero-title">${escapeHtml(folder.name)}</h1>
        </div>
      </div>

      ${folder.description ? `
        <div class="detail-field">
          <div class="detail-field-label-row">
            <span class="detail-field-label">Description</span>
          </div>
          <div class="detail-field-value-row">
            <span class="detail-field-value">${escapeHtml(folder.description)}</span>
          </div>
        </div>
      ` : ""}

      <div class="detail-secondary-row" style="justify-content:flex-end;">
        <button type="button" class="modal-primary" id="insert-media-btn">+ Insert</button>
      </div>

      <div class="detail-section-label">Contents</div>
      <p class="empty-state" style="margin-top:-8px; margin-bottom:12px;">Right-click a file to remove it.</p>
      <div id="media-grid" style="display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:12px;"></div>

      <div class="detail-button-row">
        <button class="modal-secondary" id="folder-back-btn">Back</button>
      </div>
    </div>
  `;

  document.getElementById("folder-back-btn").addEventListener("click", showMediaMainView);
  document.getElementById("insert-media-btn").addEventListener("click", onInsertMedia);

  loadFolderFiles(folder.id);
}

async function loadFolderFiles(folderId) {
  const files = await window.pywebview.api.get_folder_files(folderId);
  const grid = document.getElementById("media-grid");
  if (!grid) return;

  grid.innerHTML = "";

  if (files.length === 0) {
    grid.innerHTML = `<p class="empty-state" style="grid-column:1/-1;">No images or videos yet. Click "+ Insert" to add one.</p>`;
    return;
  }

  files.forEach((file) => {
    grid.appendChild(buildMediaThumbnail(file));
  });
}

function buildMediaThumbnail(file) {
  const thumb = document.createElement("div");
  thumb.style.cssText = `
    aspect-ratio: 1 / 1;
    border-radius: 8px;
    overflow: hidden;
    background: #1A1D24;
    border: 1px solid #2A2E38;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    cursor: pointer;
  `;
  thumb.title = file.original_filename;

  if (file.file_type === "image") {
    thumb.innerHTML = `<img src="${file.url}" alt="${escapeHtml(file.original_filename)}" style="width:100%; height:100%; object-fit:cover;">`;
  } else {
    thumb.innerHTML = `
      <svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:36px; height:36px; color:#9096A2;">
        <polygon points="23 7 16 12 23 17 23 7"/>
        <rect x="1" y="5" width="15" height="14" rx="2"/>
      </svg>
    `;
  }

  thumb.addEventListener("click", () => showMediaViewer(file));
  thumb.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    showMediaFileContextMenu(event.pageX, event.pageY, file);
  });

  return thumb;
}

function showMediaFileContextMenu(x, y, file) {
  const existing = document.getElementById("media-file-context-menu");
  if (existing) existing.remove();

  const menu = document.createElement("div");
  menu.id = "media-file-context-menu";
  menu.style.cssText = `
    position: fixed;
    top: ${y}px;
    left: ${x}px;
    background: #1A1D24;
    border: 1px solid #2A2E38;
    border-radius: 6px;
    padding: 4px;
    z-index: 200;
    min-width: 120px;
  `;

  const removeOption = document.createElement("div");
  removeOption.textContent = "Remove";
  removeOption.style.cssText = "padding: 8px 12px; cursor: pointer; font-size: 13px; color: #EF4444; border-radius: 4px;";
  removeOption.addEventListener("mouseenter", () => removeOption.style.background = "#22262F");
  removeOption.addEventListener("mouseleave", () => removeOption.style.background = "transparent");
  removeOption.addEventListener("click", async () => {
    menu.remove();
    const confirmed = confirm(`Remove "${file.original_filename}"? This cannot be undone.`);
    if (confirmed) {
      await window.pywebview.api.remove_media_file(file.id);
      loadFolderFiles(currentOpenFolderId);
    }
  });

  menu.appendChild(removeOption);
  document.body.appendChild(menu);

  const closeMenu = (event) => {
    if (!menu.contains(event.target)) {
      menu.remove();
      document.removeEventListener("click", closeMenu);
    }
  };
  setTimeout(() => document.addEventListener("click", closeMenu), 0);
}

function showMediaViewer(file) {
  const contentHtml = file.file_type === "image"
    ? `<img src="${file.url}" alt="${escapeHtml(file.original_filename)}" style="max-width:100%; max-height:70vh; display:block; margin:0 auto; border-radius:8px;">`
    : `<video src="${file.url}" controls autoplay style="max-width:100%; max-height:70vh; display:block; margin:0 auto; border-radius:8px;"></video>`;

  openModal(`
    <p class="modal-title">${escapeHtml(file.original_filename)}</p>
    ${contentHtml}
    <div class="modal-button-row">
      <button class="modal-secondary" id="media-viewer-close">Close</button>
    </div>
  `);

  document.getElementById("media-viewer-close").addEventListener("click", closeModal);
}

async function onInsertMedia() {
  const result = await window.pywebview.api.insert_media_file(currentOpenFolderId);
  if (!result.success) {
    if (result.message !== "No file selected.") {
      alert(result.message);
    }
    return;
  }
  loadFolderFiles(currentOpenFolderId);
}