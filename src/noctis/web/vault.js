let allEntries = [];
let activeCategory = null;
let showFavoritesOnly = false;
let pendingAccount = null;
let pendingCustomFields = [];
let editingEntryId = null;

const searchInput = document.getElementById("search-input");
const chipRow = document.getElementById("chip-row");
const entriesContainer = document.getElementById("entries-container");
const addButton = document.getElementById("add-button");
const modalOverlay = document.getElementById("modal-overlay");
const modalBox = document.getElementById("modal-box");

function closeModal() {
  modalOverlay.classList.remove("visible");
  modalBox.innerHTML = "";
  pendingAccount = null;
  pendingCustomFields = [];
  editingEntryId = null;
}

function openModal(contentHtml) {
  modalBox.innerHTML = contentHtml;
  modalOverlay.classList.add("visible");

  requestAnimationFrame(() => {
    const firstField = modalBox.querySelector("input, textarea");
    if (firstField) firstField.focus();
  });
}

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (modalOverlay.classList.contains("visible")) {
    closeModal();
    return;
  }
  if (detailView.style.display !== "none" || groupListView.style.display !== "none") {
    showMainView();
  }
});

// ---------- Data loading ----------

async function loadEntries() {
  allEntries = await window.pywebview.api.get_entries();
  await renderChips();
  renderEntries();
}

async function renderChips() {
  const categories = await window.pywebview.api.get_categories();
  chipRow.innerHTML = "";

  chipRow.appendChild(makeChip("All", activeCategory === null, () => {
    activeCategory = null;
    renderEntries();
    renderChips();
  }));

  const favChip = makeChip(
    (showFavoritesOnly ? "\u2605" : "\u2606") + " Favorites",
    showFavoritesOnly,
    () => {
      showFavoritesOnly = !showFavoritesOnly;
      renderEntries();
      renderChips();
    }
  );
  chipRow.appendChild(favChip);

  categories.forEach((category) => {
    const chip = makeChip(category, activeCategory === category, () => {
      activeCategory = category;
      renderEntries();
      renderChips();
    });
    chip.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      showCategoryContextMenu(event.pageX, event.pageY, category);
    });
    chipRow.appendChild(chip);
  });
}

function showCategoryContextMenu(x, y, category) {
  const existing = document.getElementById("category-context-menu");
  if (existing) existing.remove();

  const menu = document.createElement("div");
  menu.id = "category-context-menu";
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

  const renameOption = document.createElement("div");
  renameOption.textContent = "Rename";
  renameOption.style.cssText = "padding: 8px 12px; cursor: pointer; font-size: 13px; border-radius: 4px;";
  renameOption.addEventListener("mouseenter", () => renameOption.style.background = "#22262F");
  renameOption.addEventListener("mouseleave", () => renameOption.style.background = "transparent");
  renameOption.addEventListener("click", async () => {
    menu.remove();
    const newName = prompt(`Rename category "${category}" to:`, category);
    if (newName && newName.trim() && newName.trim() !== category) {
      await window.pywebview.api.rename_category(category, newName.trim());
      if (activeCategory === category) activeCategory = newName.trim();
      loadEntries();
    }
  });

  const deleteOption = document.createElement("div");
  deleteOption.textContent = "Delete";
  deleteOption.style.cssText = "padding: 8px 12px; cursor: pointer; font-size: 13px; color: #EF4444; border-radius: 4px;";
  deleteOption.addEventListener("mouseenter", () => deleteOption.style.background = "#22262F");
  deleteOption.addEventListener("mouseleave", () => deleteOption.style.background = "transparent");
  deleteOption.addEventListener("click", async () => {
    menu.remove();
    const confirmed = confirm(`Delete category "${category}"? Accounts in it will become uncategorized.`);
    if (confirmed) {
      await window.pywebview.api.delete_category(category);
      if (activeCategory === category) activeCategory = null;
      loadEntries();
    }
  });

  menu.appendChild(renameOption);
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

function makeChip(label, isActive, onClick) {
  const chip = document.createElement("button");
  chip.className = "chip" + (isActive ? " active" : "");
  chip.textContent = label;
  chip.addEventListener("click", onClick);
  return chip;
}

function getFilteredEntries() {
  const query = searchInput.value.trim().toLowerCase();
  let entries = allEntries;

  if (showFavoritesOnly) entries = entries.filter((e) => e.is_favorite);
  if (activeCategory) entries = entries.filter((e) => e.category === activeCategory);
  if (query) {
    entries = entries.filter((e) =>
      (e.title || "").toLowerCase().includes(query) ||
      (e.username || "").toLowerCase().includes(query)
    );
  }
  return entries;
}

function renderEntries() {
  const entries = getFilteredEntries();
  entriesContainer.innerHTML = "";

  if (entries.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No matching entries.";
    entriesContainer.appendChild(empty);
    return;
  }

  const groups = {};
  const groupOrder = [];
  entries.forEach((entry) => {
    const key = (entry.title || "").trim().toLowerCase();
    if (!groups[key]) {
      groups[key] = [];
      groupOrder.push(key);
    }
    groups[key].push(entry);
  });

  groupOrder.forEach((key) => {
    const group = groups[key];
    if (group.length === 1) {
      entriesContainer.appendChild(buildEntryRow(group[0]));
    } else {
      entriesContainer.appendChild(buildGroupRow(group));
    }
  });
}

function buildEntryRow(entry) {
  const row = document.createElement("div");
  row.className = "entry-row";

  const info = document.createElement("div");
  info.className = "entry-info";
  info.innerHTML = `<h3>${escapeHtml(entry.title)}</h3><p>1 account</p>`;
  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const viewButton = document.createElement("button");
  viewButton.className = "action-button";
  viewButton.textContent = "View";
  viewButton.addEventListener("click", () => {
    showDetailView(entry.id);
  });
  actions.appendChild(viewButton);

  row.appendChild(actions);
  return row;
}

function buildGroupRow(groupEntries) {
  const row = document.createElement("div");
  row.className = "entry-row";

  const info = document.createElement("div");
  info.className = "entry-info";
  info.innerHTML = `<h3>${escapeHtml(groupEntries[0].title)}</h3><p>${groupEntries.length} accounts</p>`;
  row.appendChild(info);

  const actions = document.createElement("div");
  actions.className = "entry-actions";

  const viewButton = document.createElement("button");
  viewButton.className = "action-button";
  viewButton.textContent = "View";
  viewButton.addEventListener("click", () => {
    showGroupList(groupEntries);
  });
  actions.appendChild(viewButton);

  row.appendChild(actions);
  return row;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

searchInput.addEventListener("input", renderEntries);

// ---------- "+" choice modal ----------

addButton.addEventListener("click", () => {
  openModal(`
    <p class="modal-title">What would you like to add?</p>
    <button class="choice-button category-choice" id="choice-category">Category</button>
    <button class="choice-button account-choice" id="choice-account">Account</button>
    <button class="modal-cancel" id="choice-cancel">Cancel</button>
  `);
  document.getElementById("choice-category").addEventListener("click", showAddCategoryForm);
  document.getElementById("choice-account").addEventListener("click", startNewAccountForm);
  document.getElementById("choice-cancel").addEventListener("click", closeModal);
});

// ---------- Category creation ----------

function showAddCategoryForm() {
  openModal(`
    <p class="modal-title">New Category</p>
    <div class="modal-field">
      <label>Category Name</label>
      <input type="text" id="category-name-input">
    </div>
    <p class="modal-error" id="category-error"></p>
    <div class="modal-button-row">
      <button class="modal-secondary" id="category-cancel">Cancel</button>
      <button class="modal-primary" id="category-save">Save</button>
    </div>
  `);
  document.getElementById("category-cancel").addEventListener("click", closeModal);
  document.getElementById("category-save").addEventListener("click", async () => {
    const name = document.getElementById("category-name-input").value.trim();
    const errorLabel = document.getElementById("category-error");
    if (!name) {
      errorLabel.textContent = "Category name is required.";
      return;
    }
    await window.pywebview.api.add_category(name);
    closeModal();
    loadEntries();
  });
}

// ---------- Account form ----------

function startNewAccountForm() {
  pendingAccount = { title: "", email: "", username: "", password: "", notes: "", url: "" };
  pendingCustomFields = [];
  editingEntryId = null;
  renderAccountForm();
}

function renderAccountForm() {
  const customFieldsHtml = pendingCustomFields.map((field, index) => `
    <div class="custom-field-row">
      <div class="modal-field">
        <label>${escapeHtml(field.label)}</label>
        <input type="text" class="custom-field-value" data-index="${index}" value="${escapeHtml(field.value)}">
      </div>
      <button type="button" class="remove-field-button" data-remove="${index}" aria-label="Remove field"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  `).join("");

  openModal(`
    <p class="modal-title">Add an Account</p>
    <div class="modal-field">
      <label>What account? (e.g. Instagram, Facebook)</label>
      <input type="text" id="acc-title" value="${escapeHtml(pendingAccount.title)}">
    </div>
    <div class="modal-field">
      <label>Email (optional)</label>
      <input type="text" id="acc-email" value="${escapeHtml(pendingAccount.email)}">
    </div>
    <div class="modal-field">
      <label>Username (optional)</label>
      <input type="text" id="acc-username" value="${escapeHtml(pendingAccount.username)}">
    </div>
    <div class="modal-field">
      <label>Password</label>
      <div class="modal-field-row">
        <input type="password" id="acc-password" value="${escapeHtml(pendingAccount.password)}">
        <button type="button" class="icon-button" id="acc-toggle-password" aria-label="Show or hide password"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
      </div>
    </div>
    <div class="modal-field">
      <label>Notes (optional)</label>
      <input type="text" id="acc-notes" value="${escapeHtml(pendingAccount.notes)}">
    </div>
    <div class="modal-field">
      <label>URL (optional)</label>
      <input type="text" id="acc-url" value="${escapeHtml(pendingAccount.url)}">
    </div>
    <div id="custom-fields-container">${customFieldsHtml}</div>
    <button type="button" class="add-field-link" id="add-field-button">+ Add Field</button>
    <p class="modal-error" id="acc-error"></p>
    <div class="modal-button-row">
      <button class="modal-secondary" id="acc-cancel">Cancel</button>
      <button class="modal-primary" id="acc-continue">Continue</button>
    </div>
  `);

  document.getElementById("acc-toggle-password").addEventListener("click", () => {
    const passwordField = document.getElementById("acc-password");
    const toggleBtn = document.getElementById("acc-toggle-password");
    const isPassword = passwordField.type === "password";
    passwordField.type = isPassword ? "text" : "password";
    toggleBtn.innerHTML = isPassword
      ? '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
      : `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
  });

  document.getElementById("add-field-button").addEventListener("click", () => {
    const label = prompt("Field Name (e.g. Phone Number)");
    if (label) {
      saveMainFieldValues();
      saveCurrentFieldValues();
      pendingCustomFields.push({ label: label, value: "" });
      renderAccountForm();
    }
  });

  document.querySelectorAll(".remove-field-button").forEach((button) => {
    button.addEventListener("click", () => {
      saveMainFieldValues();
      saveCurrentFieldValues();
      const index = parseInt(button.dataset.remove, 10);
      pendingCustomFields.splice(index, 1);
      renderAccountForm();
    });
  });

  document.getElementById("acc-cancel").addEventListener("click", closeModal);
  document.getElementById("acc-continue").addEventListener("click", onAccountContinue);
}

function saveMainFieldValues() {
  pendingAccount.title = document.getElementById("acc-title").value;
  pendingAccount.email = document.getElementById("acc-email").value;
  pendingAccount.username = document.getElementById("acc-username").value;
  pendingAccount.password = document.getElementById("acc-password").value;
  pendingAccount.notes = document.getElementById("acc-notes").value;
  pendingAccount.url = document.getElementById("acc-url").value;
}

function saveCurrentFieldValues() {
  document.querySelectorAll(".custom-field-value").forEach((input) => {
    const index = parseInt(input.dataset.index, 10);
    pendingCustomFields[index].value = input.value;
  });
}

function onAccountContinue() {
  saveMainFieldValues();
  saveCurrentFieldValues();

  const errorLabel = document.getElementById("acc-error");
  const title = pendingAccount.title.trim();
  const password = pendingAccount.password;

  if (!title) {
    errorLabel.textContent = "Please enter what account this is (e.g. Instagram).";
    return;
  }
  if (!password) {
    errorLabel.textContent = "Password is required.";
    return;
  }

  showCategoryPicker();
}

// ---------- Category picker ----------

async function showCategoryPicker() {
  const categories = await window.pywebview.api.get_categories();

  const optionsHtml = categories.length === 0
    ? `<p style="color:#9096A2; font-size:13px;">No categories yet. You can add one later.</p>`
    : categories.map((category) => `
        <label class="category-option">
          <input type="radio" name="category-pick" value="${escapeHtml(category)}" ${pendingAccount.category === category ? "checked" : ""}>
          ${escapeHtml(category)}
        </label>
      `).join("");

  openModal(`
    <p class="modal-title">Choose a Category</p>
    <p style="text-align:center; color:#9096A2; font-size:12px; margin-top:-12px;">Where should this account be placed?</p>
    <div id="category-options">${optionsHtml}</div>
    <div class="modal-button-row">
      <button class="modal-secondary" id="picker-back">Back</button>
      <button class="modal-primary" id="picker-save">Save</button>
    </div>
  `);

  document.getElementById("picker-back").addEventListener("click", () => {
    renderAccountForm();
  });

  document.getElementById("picker-save").addEventListener("click", async () => {
    const selected = document.querySelector('input[name="category-pick"]:checked');
    const category = selected ? selected.value : null;

    const dataToSave = {
      title: pendingAccount.title.trim(),
      email: pendingAccount.email.trim(),
      username: pendingAccount.username.trim(),
      password: pendingAccount.password,
      notes: pendingAccount.notes.trim(),
      url: pendingAccount.url.trim(),
      category: category,
      custom_fields: pendingCustomFields.slice(),
    };

    if (editingEntryId !== null) {
      await window.pywebview.api.update_account(editingEntryId, dataToSave);
    } else {
      await window.pywebview.api.save_account(dataToSave);
    }

    editingEntryId = null;
    closeModal();
    showMainView();
  });
}

// ---------- Master password confirmation modal ----------

function promptForMasterPassword(messageText) {
  return new Promise((resolve) => {
    openModal(`
      <p class="modal-title">Confirm Master Password</p>
      <p style="text-align:center; color:#9096A2; font-size:12px; margin-top:-12px;">${escapeHtml(messageText)}</p>
      <div class="modal-field">
        <input type="password" id="master-password-input">
      </div>
      <p class="modal-error" id="master-password-error"></p>
      <div class="modal-button-row">
        <button class="modal-secondary" id="master-password-cancel">Cancel</button>
        <button class="modal-primary" id="master-password-confirm">Confirm</button>
      </div>
    `);

    const input = document.getElementById("master-password-input");
    input.focus();

    const cleanup = (value) => {
      closeModal();
      resolve(value);
    };

    document.getElementById("master-password-cancel").addEventListener("click", () => cleanup(null));
    document.getElementById("master-password-confirm").addEventListener("click", () => cleanup(input.value));
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") cleanup(input.value);
    });
  });
}

// ---------- Clipboard copy with auto-clear ----------

let lastCopiedText = null;

const CHECK_ICON = `<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

function copyText(text) {
  navigator.clipboard.writeText(text);
  lastCopiedText = text;
  setTimeout(async () => {
    try {
      const current = await navigator.clipboard.readText();
      if (current === lastCopiedText) {
        navigator.clipboard.writeText("");
      }
    } catch (e) {
      // Clipboard read may be blocked; safe to ignore.
    }
  }, 30000);
}

function flashCopied(button) {
  const original = button.innerHTML;
  button.innerHTML = CHECK_ICON;
  button.classList.add("copied-flash");
  button.disabled = true;
  setTimeout(() => {
    button.innerHTML = original;
    button.classList.remove("copied-flash");
    button.disabled = false;
  }, 1200);
}

function fadeInView(element) {
  element.classList.remove("view-fade-in");
  void element.offsetWidth;
  element.classList.add("view-fade-in");
}

// ---------- Detail (View) screen ----------

const mainView = document.getElementById("main-view");
const groupListView = document.getElementById("group-list-view");
const detailView = document.getElementById("detail-view");

function showMainView() {
  mainView.style.display = "block";
  groupListView.style.display = "none";
  detailView.style.display = "none";
  fadeInView(mainView);
  loadEntries();
}

async function showDetailView(entryId) {
  const details = await window.pywebview.api.get_entry_details(entryId);
  if (!details.success) {
    alert(details.message);
    return;
  }

  mainView.style.display = "none";
  groupListView.style.display = "none";
  detailView.style.display = "block";
  fadeInView(detailView);

  let revealedPassword = null;

  const fieldsHtml = [
    ["Email", details.email],
    ["Username", details.username],
  ].filter(([, value]) => value).map(([label, value]) => `
    <div class="detail-field">
      <div class="detail-field-label">${escapeHtml(label)}</div>
      <div class="detail-field-value-row">
        <span class="detail-field-value">${escapeHtml(value)}</span>
        <button type="button" class="field-icon-button copy-field" data-value="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      </div>
    </div>
  `).join("");

  const trailingFieldsHtml = [
    ["Notes", details.notes],
    ["URL", details.url],
  ].filter(([, value]) => value).map(([label, value]) => `
    <div class="detail-field">
      <div class="detail-field-label">${escapeHtml(label)}</div>
      <div class="detail-field-value-row">
        <span class="detail-field-value">${escapeHtml(value)}</span>
        <button type="button" class="field-icon-button copy-field" data-value="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      </div>
    </div>
  `).join("");

  const customFieldsHtml = details.custom_fields.map(({ label, value }) => `
    <div class="detail-field">
      <div class="detail-field-label">${escapeHtml(label)}</div>
      <div class="detail-field-value-row">
        <span class="detail-field-value">${escapeHtml(value)}</span>
        <button type="button" class="field-icon-button copy-field" data-value="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      </div>
    </div>
  `).join("");

  detailView.innerHTML = `
    <div class="detail-header">
      <h1>${escapeHtml(details.title)}</h1>
    </div>
    ${details.category ? `<span class="detail-category-badge">${escapeHtml(details.category)}</span>` : '<div style="height: 20px;"></div>'}

    ${fieldsHtml}

    <div class="detail-field">
      <div class="detail-field-label">Password</div>
      <div class="detail-field-value-row">
        <span class="detail-field-value" id="password-display">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>
        <button type="button" class="field-icon-button" id="reveal-password-btn" aria-label="Reveal password"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
        <button type="button" class="field-icon-button" id="copy-password-btn" aria-label="Copy password"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
      </div>
      <p class="detail-error" id="password-error"></p>
    </div>

    ${trailingFieldsHtml}
    ${customFieldsHtml}

    <div class="detail-secondary-row">
      <button type="button" id="favorite-toggle-btn">${details.is_favorite ? '<svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'}${details.is_favorite ? " Unfavorite" : " Favorite"}</button>
      <button type="button" class="danger-text" id="delete-entry-btn">Delete</button>
    </div>

    <p class="detail-error" id="edit-error"></p>
    <div class="detail-button-row">
      <button class="modal-secondary" id="detail-back-btn">Back</button>
      <button class="modal-primary" id="detail-edit-btn">Edit</button>
    </div>
  `;

  document.querySelectorAll(".copy-field").forEach((button) => {
    button.addEventListener("click", () => {
      copyText(button.dataset.value);
      flashCopied(button);
    });
  });

  document.getElementById("reveal-password-btn").addEventListener("click", async () => {
    const errorLabel = document.getElementById("password-error");
    if (revealedPassword !== null) return;
    const entered = await promptForMasterPassword("Enter your master password to reveal this");
    if (entered === null) return;
    const result = await window.pywebview.api.reveal_password(entryId, entered);
    if (result.success) {
      revealedPassword = result.password;
      document.getElementById("password-display").textContent = revealedPassword;
      errorLabel.textContent = "";
    } else {
      errorLabel.textContent = result.message;
    }
  });

  document.getElementById("copy-password-btn").addEventListener("click", async (event) => {
    const errorLabel = document.getElementById("password-error");
    const copyBtn = event.currentTarget;
    if (revealedPassword !== null) {
      copyText(revealedPassword);
      flashCopied(copyBtn);
      return;
    }
    const entered = await promptForMasterPassword("Enter your master password to copy this");
    if (entered === null) return;
    const result = await window.pywebview.api.reveal_password(entryId, entered);
    if (result.success) {
      revealedPassword = result.password;
      document.getElementById("password-display").textContent = revealedPassword;
      errorLabel.textContent = "";
      copyText(revealedPassword);
      flashCopied(copyBtn);
    } else {
      errorLabel.textContent = result.message;
    }
  });

  document.getElementById("favorite-toggle-btn").addEventListener("click", async () => {
    await window.pywebview.api.toggle_favorite(entryId, !details.is_favorite);
    showDetailView(entryId);
  });

  document.getElementById("delete-entry-btn").addEventListener("click", async () => {
    const confirmed = confirm(`Are you sure you want to delete "${details.title}"? This cannot be undone.`);
    if (confirmed) {
      await window.pywebview.api.delete_entry(entryId);
      showMainView();
    }
  });

  document.getElementById("detail-back-btn").addEventListener("click", showMainView);

  document.getElementById("detail-edit-btn").addEventListener("click", async () => {
    const editError = document.getElementById("edit-error");
    const entered = await promptForMasterPassword("Enter your master password to edit this");
    if (entered === null) return;
    const pwResult = await window.pywebview.api.reveal_password(entryId, entered);
    if (pwResult.success) {
      showEditForm(details, pwResult.password);
    } else {
      editError.textContent = "Incorrect master password. Edit cancelled.";
    }
  });
}

function showEditForm(details, realPassword) {
  pendingAccount = {
    title: details.title || "",
    email: details.email || "",
    username: details.username || "",
    password: realPassword || "",
    notes: details.notes || "",
    url: details.url || "",
    category: details.category || null,
  };
  pendingCustomFields = details.custom_fields.map((f) => ({ label: f.label, value: f.value }));
  editingEntryId = details.id;

  mainView.style.display = "block";
  detailView.style.display = "none";
  renderAccountForm();
}

// ---------- Group list screen ----------

function showGroupList(groupEntries) {
  mainView.style.display = "none";
  detailView.style.display = "none";
  groupListView.style.display = "block";
  fadeInView(groupListView);

  renderGroupList(groupEntries);
}

async function renderGroupList(groupEntries) {
  const rowsHtml = groupEntries.map((entry, index) => {
    const label = entry.username || entry.email || `Account ${index + 1}`;
    return `
      <div class="group-account-row" data-id="${entry.id}">
        <span class="group-account-label">${escapeHtml(label)}</span>
        <div class="entry-actions">
          <button class="action-button group-view" data-id="${entry.id}">View</button>
        </div>
      </div>
    `;
  }).join("");

  groupListView.innerHTML = `
    <div class="group-list-header">
      <h1>${escapeHtml(groupEntries[0].title)}</h1>
    </div>
    <p class="group-list-hint">Choose which account to view</p>
    <div id="group-rows">${rowsHtml}</div>
    <button class="modal-secondary" id="group-back-btn" style="width:100%; padding:10px; border-radius:6px; border:none; margin-top:12px; cursor:pointer;">Back</button>
  `;

  document.querySelectorAll(".group-view").forEach((button) => {
    button.addEventListener("click", () => {
      const entryId = parseInt(button.dataset.id, 10);
      showDetailView(entryId);
    });
  });

  document.getElementById("group-back-btn").addEventListener("click", showMainView);
}

if (window.pywebview) {
  loadEntries();
} else {
  window.addEventListener("pywebviewready", loadEntries);
}