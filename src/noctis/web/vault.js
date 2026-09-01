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

function resetScroll() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  const contentArea = document.querySelector(".content-area");
  if (contentArea) contentArea.scrollLeft = 0;
}

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

function getAvatarColor(name) {
  const colors = ["#6C7CF7", "#34D399", "#F0576B", "#F59E0B", "#38BDF8", "#A78BFA", "#FB7185", "#4ADE80"];
  const text = name || "?";
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function fadeInView(element) {
  element.classList.remove("view-fade-in");
  void element.offsetWidth;
  element.classList.add("view-fade-in");
}

function formatPHP(amount) {
  if (amount === null || amount === undefined || amount === "") return null;
  return "\u20b1" + Number(amount).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  resetScroll();
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
  resetScroll();

  let revealedPassword = null;

  const avatarColor = getAvatarColor(details.title);
  const avatarLetter = (details.title || "?").trim().charAt(0).toUpperCase();

  function fieldRow(icon, label, value) {
    if (!value) return "";
    return `
      <div class="detail-field">
        <div class="detail-field-label-row">
          <span class="detail-field-icon">${icon}</span>
          <span class="detail-field-label">${escapeHtml(label)}</span>
        </div>
        <div class="detail-field-value-row">
          <span class="detail-field-value">${escapeHtml(value)}</span>
          <button type="button" class="field-icon-button copy-field" data-value="${escapeHtml(value)}" aria-label="Copy ${escapeHtml(label)}"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
      </div>
    `;
  }

  const loginFieldsHtml = [
    ['<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>', "Email", details.email],
    ['<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>', "Username", details.username],
  ].map(([icon, label, value]) => fieldRow(icon, label, value)).join("");

  const additionalFieldsHtml = [
    ['<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>', "Notes", details.notes],
    ['<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>', "URL", details.url],
  ].map(([icon, label, value]) => fieldRow(icon, label, value)).join("")
  + details.custom_fields.map(({ label, value }) => fieldRow('<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41 13.42 20.6a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>', label, value)).join("");

  detailView.innerHTML = `
    <div class="detail-card">
      <div class="detail-hero">
        <div class="detail-avatar" style="background: ${avatarColor}">${escapeHtml(avatarLetter)}</div>
        <div>
          <h1 class="detail-hero-title">${escapeHtml(details.title)}</h1>
          ${details.category ? `<span class="detail-category-badge">${escapeHtml(details.category)}</span>` : ""}
        </div>
      </div>

      ${loginFieldsHtml ? `<div class="detail-section-label">Login Details</div>${loginFieldsHtml}` : ""}

      <div class="detail-field">
        <div class="detail-field-label-row">
          <span class="detail-field-icon"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
          <span class="detail-field-label">Password</span>
        </div>
        <div class="detail-field-value-row">
          <span class="detail-field-value detail-password-value" id="password-display">\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022</span>
          <button type="button" class="field-icon-button" id="reveal-password-btn" aria-label="Reveal password"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button>
          <button type="button" class="field-icon-button" id="copy-password-btn" aria-label="Copy password"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></button>
        </div>
        <p class="detail-error" id="password-error"></p>
      </div>

      ${additionalFieldsHtml ? `<div class="detail-section-label">Additional Information</div>${additionalFieldsHtml}` : ""}

      <div class="detail-secondary-row">
        <button type="button" id="favorite-toggle-btn">${details.is_favorite ? '<svg class="icon-svg" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>' : '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'}${details.is_favorite ? " Unfavorite" : " Favorite"}</button>
        <button type="button" class="danger-text" id="delete-entry-btn">Delete</button>
      </div>

      <p class="detail-error" id="edit-error"></p>
      <div class="detail-button-row">
        <button class="modal-secondary" id="detail-back-btn">Back</button>
        <button class="modal-primary" id="detail-edit-btn">Edit</button>
      </div>
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
  resetScroll();

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

// ---------- Sidebar navigation ----------

const sidebarItems = document.querySelectorAll(".sidebar-item");
const contentSections = document.querySelectorAll(".content-section");

function activateSection(targetSection) {
  sidebarItems.forEach((i) => i.classList.remove("active"));
  const tab = document.querySelector(`.sidebar-item[data-section="${targetSection}"]`);
  if (tab) tab.classList.add("active");

  contentSections.forEach((section) => {
    section.style.display = section.id === `section-${targetSection}` ? "block" : "none";
  });

  resetScroll();

  if (targetSection === "accounts") {
    showMainView();
  } else if (targetSection === "subscriptions") {
    showSubscriptionsMainView();
  }
}

sidebarItems.forEach((item) => {
  item.addEventListener("click", () => {
    activateSection(item.dataset.section);
  });
});

// ---------- Subscriptions ----------

let pendingSubscription = null;
let pendingSubscriptionFields = [];
let pendingSubscriptionPrivileges = [];
let editingSubscriptionId = null;

const subscriptionsMainView = document.getElementById("subscriptions-main-view");
const subscriptionDetailView = document.getElementById("subscription-detail-view");
const subscriptionsContainer = document.getElementById("subscriptions-container");
const addSubscriptionButton = document.getElementById("add-subscription-button");

function showSubscriptionsMainView() {
  subscriptionsMainView.style.display = "block";
  subscriptionDetailView.style.display = "none";
  fadeInView(subscriptionsMainView);
  resetScroll();
  loadSubscriptions();
}

async function loadSubscriptions() {
  const subscriptions = await window.pywebview.api.get_subscriptions();
  subscriptionsContainer.innerHTML = "";

  if (subscriptions.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "No subscriptions yet.";
    subscriptionsContainer.appendChild(empty);
    return;
  }

  subscriptions.forEach((sub) => {
    subscriptionsContainer.appendChild(buildSubscriptionRow(sub));
  });
}

function formatDateForDisplay(isoDateString) {
  if (!isoDateString) return null;
  const parsed = new Date(isoDateString + "T00:00:00");
  if (isNaN(parsed.getTime())) return isoDateString;
  return parsed.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function buildSubscriptionRow(sub) {
  const row = document.createElement("div");
  row.className = "entry-row subscription-row";
  row.tabIndex = 0;
  row.setAttribute("role", "button");
  row.setAttribute("aria-label", `View ${sub.name}`);

  const privileges = sub.privileges || [];

  const planPillHtml = sub.plan
    ? `<p>${escapeHtml(sub.plan)}</p>`
    : `<p>No plan set</p>`;

  const formattedEndDate = formatDateForDisplay(sub.date_ended);
  const endDatePillHtml = formattedEndDate
    ? `<p class="subscription-end-pill">Ends ${escapeHtml(formattedEndDate)}</p>`
    : "";

  const formattedAmount = formatPHP(sub.amount);
  const amountPillHtml = formattedAmount
    ? `<p class="subscription-amount-pill">${escapeHtml(formattedAmount)}</p>`
    : "";

  const previewHtml = privileges.length > 0
    ? `<ul>${privileges.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul>`
    : `<p class="subscription-privileges-empty">No privileges listed yet.</p>`;

  row.innerHTML = `
    <div class="subscription-row-main">
      <div class="entry-info">
        <h3>${escapeHtml(sub.name)}</h3>
        ${planPillHtml}
        ${endDatePillHtml}
        ${amountPillHtml}
      </div>
    </div>
    <div class="subscription-privileges-preview">${previewHtml}</div>
  `;

  const goToDetail = () => showSubscriptionDetailView(sub.id);

  row.addEventListener("click", goToDetail);
  row.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      goToDetail();
    }
  });

  return row;
}

addSubscriptionButton.addEventListener("click", () => {
  startNewSubscriptionForm();
});

function startNewSubscriptionForm() {
  pendingSubscription = { name: "", plan: "", date_started: "", date_ended: "", amount: "" };
  pendingSubscriptionFields = [];
  pendingSubscriptionPrivileges = [];
  editingSubscriptionId = null;
  renderSubscriptionForm();
}

function renderSubscriptionForm(focusLastPrivilege) {
  const fieldsHtml = pendingSubscriptionFields.map((field, index) => `
    <div class="custom-field-row">
      <div class="modal-field">
        <label>${escapeHtml(field.label)}</label>
        <input type="text" class="sub-field-value" data-index="${index}" value="${escapeHtml(field.value)}">
      </div>
      <button type="button" class="remove-field-button" data-remove="${index}" aria-label="Remove field"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  `).join("");

  const privilegesHtml = pendingSubscriptionPrivileges.map((value, index) => `
    <div class="custom-field-row">
      <input type="text" class="privilege-value" data-index="${index}" placeholder="e.g. No ads" value="${escapeHtml(value)}">
      <button type="button" class="remove-field-button" data-remove-privilege="${index}" aria-label="Remove privilege"><svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
    </div>
  `).join("");

  openModal(`
    <p class="modal-title">${editingSubscriptionId !== null ? "Edit Subscription" : "Add Subscription"}</p>
    <div class="modal-field">
      <label>Subscription Name (e.g. Spotify)</label>
      <input type="text" id="sub-name" value="${escapeHtml(pendingSubscription.name)}">
    </div>
    <div class="modal-field">
      <label>Plan (e.g. Student Plan)</label>
      <input type="text" id="sub-plan" value="${escapeHtml(pendingSubscription.plan)}">
    </div>
    <div class="modal-field">
      <label>Amount (\u20b1, optional)</label>
      <input type="text" inputmode="decimal" id="sub-amount" placeholder="e.g. 149.00" value="${escapeHtml(pendingSubscription.amount)}">
    </div>
    <div class="modal-field">
      <label>Date Availed</label>
      <input type="date" id="sub-date-started" value="${escapeHtml(pendingSubscription.date_started)}">
    </div>
    <div class="modal-field">
      <label>Date Ended (optional)</label>
      <input type="date" id="sub-date-ended" value="${escapeHtml(pendingSubscription.date_ended)}">
    </div>

    <div class="modal-field">
      <label>Privileges</label>
      <div id="privileges-container">${privilegesHtml}</div>
      <button type="button" class="add-field-link" id="add-privilege-button">+ Add Privilege</button>
    </div>

    <div id="sub-fields-container">${fieldsHtml}</div>
    <button type="button" class="add-field-link" id="sub-add-field-button">+ Add Field</button>
    <p class="modal-error" id="sub-error"></p>
    <div class="modal-button-row">
      <button class="modal-secondary" id="sub-cancel">Cancel</button>
      <button class="modal-primary" id="sub-save">Save</button>
    </div>
  `);

  const amountInput = document.getElementById("sub-amount");
  amountInput.addEventListener("input", () => {
    let cleaned = amountInput.value.replace(/[^0-9.]/g, "");
    const firstDot = cleaned.indexOf(".");
    if (firstDot !== -1) {
      cleaned = cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");
    }
    amountInput.value = cleaned;
  });

  document.getElementById("sub-add-field-button").addEventListener("click", () => {
    const label = prompt("Field Name (e.g. Renewal Date)");
    if (label) {
      saveSubscriptionMainValues();
      saveSubscriptionFieldValues();
      saveSubscriptionPrivilegeValues();
      pendingSubscriptionFields.push({ label: label, value: "" });
      renderSubscriptionForm();
    }
  });

  document.querySelectorAll("#sub-fields-container .remove-field-button").forEach((button) => {
    button.addEventListener("click", () => {
      saveSubscriptionMainValues();
      saveSubscriptionFieldValues();
      saveSubscriptionPrivilegeValues();
      const index = parseInt(button.dataset.remove, 10);
      pendingSubscriptionFields.splice(index, 1);
      renderSubscriptionForm();
    });
  });

  document.getElementById("add-privilege-button").addEventListener("click", () => {
    saveSubscriptionMainValues();
    saveSubscriptionFieldValues();
    saveSubscriptionPrivilegeValues();
    pendingSubscriptionPrivileges.push("");
    renderSubscriptionForm(true);
  });

  document.querySelectorAll("#privileges-container .remove-field-button").forEach((button) => {
    button.addEventListener("click", () => {
      saveSubscriptionMainValues();
      saveSubscriptionFieldValues();
      saveSubscriptionPrivilegeValues();
      const index = parseInt(button.dataset.removePrivilege, 10);
      pendingSubscriptionPrivileges.splice(index, 1);
      renderSubscriptionForm();
    });
  });

  document.getElementById("sub-cancel").addEventListener("click", closeSubscriptionModal);
  document.getElementById("sub-save").addEventListener("click", onSubscriptionSave);

  if (focusLastPrivilege) {
    const privilegeInputs = document.querySelectorAll(".privilege-value");
    if (privilegeInputs.length) privilegeInputs[privilegeInputs.length - 1].focus();
  }
}

function saveSubscriptionMainValues() {
  pendingSubscription.name = document.getElementById("sub-name").value;
  pendingSubscription.plan = document.getElementById("sub-plan").value;
  pendingSubscription.date_started = document.getElementById("sub-date-started").value;
  pendingSubscription.date_ended = document.getElementById("sub-date-ended").value;
  pendingSubscription.amount = document.getElementById("sub-amount").value;
}

function saveSubscriptionFieldValues() {
  document.querySelectorAll(".sub-field-value").forEach((input) => {
    const index = parseInt(input.dataset.index, 10);
    pendingSubscriptionFields[index].value = input.value;
  });
}

function saveSubscriptionPrivilegeValues() {
  document.querySelectorAll(".privilege-value").forEach((input) => {
    const index = parseInt(input.dataset.index, 10);
    pendingSubscriptionPrivileges[index] = input.value;
  });
}

function closeSubscriptionModal() {
  closeModal();
  pendingSubscription = null;
  pendingSubscriptionFields = [];
  pendingSubscriptionPrivileges = [];
  editingSubscriptionId = null;
}

async function onSubscriptionSave() {
  saveSubscriptionMainValues();
  saveSubscriptionFieldValues();
  saveSubscriptionPrivilegeValues();

  const errorLabel = document.getElementById("sub-error");
  const name = pendingSubscription.name.trim();

  if (!name) {
    errorLabel.textContent = "Please enter a subscription name.";
    return;
  }

  const cleanPrivileges = pendingSubscriptionPrivileges
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  const amountValue = pendingSubscription.amount.toString().trim();

  const dataToSave = {
    name: name,
    plan: pendingSubscription.plan.trim(),
    date_started: pendingSubscription.date_started,
    date_ended: pendingSubscription.date_ended,
    fields: pendingSubscriptionFields.slice(),
    privileges: cleanPrivileges,
    amount: amountValue === "" ? null : amountValue,
  };

  let result;
  if (editingSubscriptionId !== null) {
    result = await window.pywebview.api.update_subscription(editingSubscriptionId, dataToSave);
  } else {
    result = await window.pywebview.api.save_subscription(dataToSave);
  }

  if (!result.success) {
    errorLabel.textContent = result.message;
    return;
  }

  closeSubscriptionModal();
  showSubscriptionsMainView();
  refreshNotifications();
}

async function showSubscriptionDetailView(subscriptionId) {
  const details = await window.pywebview.api.get_subscription_details(subscriptionId);
  if (!details.success) {
    alert(details.message);
    return;
  }

  subscriptionsMainView.style.display = "none";
  subscriptionDetailView.style.display = "block";
  fadeInView(subscriptionDetailView);
  resetScroll();

  const avatarColor = getAvatarColor(details.name);
  const avatarLetter = (details.name || "?").trim().charAt(0).toUpperCase();

  function subFieldRow(label, value) {
    if (!value) return "";
    return `
      <div class="detail-field">
        <div class="detail-field-label-row">
          <span class="detail-field-label">${escapeHtml(label)}</span>
        </div>
        <div class="detail-field-value-row">
          <span class="detail-field-value">${escapeHtml(value)}</span>
        </div>
      </div>
    `;
  }

  const coreFieldsHtml =
    subFieldRow("Plan", details.plan) +
    subFieldRow("Amount", formatPHP(details.amount)) +
    subFieldRow("Date Availed", details.date_started) +
    subFieldRow("Date Ended", details.date_ended);

  const privileges = details.privileges || [];
  const privilegesHtml = privileges.length > 0
    ? `
      <div class="detail-section-label">Privileges</div>
      <ul class="privilege-list">
        ${privileges.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
      </ul>
    `
    : "";

  const extraFieldsHtml = details.fields.map(({ label, value }) => subFieldRow(label, value)).join("");

  subscriptionDetailView.innerHTML = `
    <div class="detail-card">
      <div class="detail-hero">
        <div class="detail-avatar" style="background: ${avatarColor}">${escapeHtml(avatarLetter)}</div>
        <div>
          <h1 class="detail-hero-title">${escapeHtml(details.name)}</h1>
        </div>
      </div>

      ${coreFieldsHtml}
      ${privilegesHtml}
      ${extraFieldsHtml ? `<div class="detail-section-label">Additional Information</div>${extraFieldsHtml}` : ""}

      <div class="detail-secondary-row">
        <button type="button" class="danger-text" id="sub-delete-btn">Delete</button>
      </div>

      <div class="detail-button-row">
        <button class="modal-secondary" id="sub-back-btn">Back</button>
        <button class="modal-primary" id="sub-edit-btn">Edit</button>
      </div>
    </div>
  `;

  document.getElementById("sub-back-btn").addEventListener("click", showSubscriptionsMainView);

  document.getElementById("sub-delete-btn").addEventListener("click", async () => {
    const confirmed = confirm(`Are you sure you want to delete "${details.name}"? This cannot be undone.`);
    if (confirmed) {
      await window.pywebview.api.delete_subscription(subscriptionId);
      showSubscriptionsMainView();
      refreshNotifications();
    }
  });

  document.getElementById("sub-edit-btn").addEventListener("click", () => {
    pendingSubscription = {
      name: details.name || "",
      plan: details.plan || "",
      date_started: details.date_started || "",
      date_ended: details.date_ended || "",
      amount: details.amount != null ? String(details.amount) : "",
    };
    pendingSubscriptionFields = details.fields.map((f) => ({ label: f.label, value: f.value }));
    pendingSubscriptionPrivileges = (details.privileges || []).slice();
    editingSubscriptionId = details.id;
    subscriptionsMainView.style.display = "block";
    subscriptionDetailView.style.display = "none";
    renderSubscriptionForm();
  });
}

// ---------- Renewal notifications ----------

const RENEWAL_THRESHOLDS = [30, 7, 3, 1];

const notificationBell = document.getElementById("notification-bell");
const notificationDot = document.getElementById("notification-dot");
const notificationDropdown = document.getElementById("notification-dropdown");

function daysUntil(dateStr) {
  const target = new Date(dateStr + "T00:00:00");
  if (isNaN(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffMs = target.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function renewalLabel(days) {
  if (days < 0) return `overdue by ${Math.abs(days)}d`;
  if (days === 0) return "due today";
  if (days === 1) return "ends tomorrow";
  return `ends in ${days} days`;
}

function getDueSubscriptions(subscriptions) {
  const due = [];
  subscriptions.forEach((sub) => {
    if (!sub.date_ended) return;
    const days = daysUntil(sub.date_ended);
    if (days === null) return;
    if (days <= 0 || RENEWAL_THRESHOLDS.includes(days)) {
      due.push({ id: sub.id, name: sub.name, days, amount: sub.amount });
    }
  });
  due.sort((a, b) => a.days - b.days);
  return due;
}

function renderNotificationDropdown(dueList) {
  if (dueList.length === 0) {
    notificationDropdown.innerHTML = `<p class="notification-empty">No renewals coming up.</p>`;
    return;
  }

  notificationDropdown.innerHTML = dueList.map((item) => {
    const amountPart = formatPHP(item.amount);
    const suffix = amountPart ? ` \u00b7 ${amountPart}` : "";
    return `
      <div class="notification-item" data-id="${item.id}">
        <span class="notification-item-name">${escapeHtml(item.name)}</span>
        <span class="notification-item-days">${escapeHtml(renewalLabel(item.days) + suffix)}</span>
      </div>
    `;
  }).join("");

  notificationDropdown.querySelectorAll(".notification-item").forEach((item) => {
    item.addEventListener("click", () => {
      const subId = parseInt(item.dataset.id, 10);
      notificationDropdown.style.display = "none";
      activateSection("subscriptions");
      showSubscriptionDetailView(subId);
    });
  });
}

async function refreshNotifications() {
  const subscriptions = await window.pywebview.api.get_subscriptions();
  const due = getDueSubscriptions(subscriptions);
  notificationDot.style.display = due.length > 0 ? "block" : "none";
  renderNotificationDropdown(due);
}

notificationBell.addEventListener("click", (event) => {
  event.stopPropagation();
  const isOpen = notificationDropdown.style.display === "block";
  notificationDropdown.style.display = isOpen ? "none" : "block";
});

document.addEventListener("click", (event) => {
  if (!notificationBell.contains(event.target) && !notificationDropdown.contains(event.target)) {
    notificationDropdown.style.display = "none";
  }
});

// ---------- Init ----------

if (window.pywebview) {
  loadEntries();
  refreshNotifications();
} else {
  window.addEventListener("pywebviewready", () => {
    loadEntries();
    refreshNotifications();
  });
}