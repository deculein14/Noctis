let allEntries = [];
let activeCategory = null;
let showFavoritesOnly = false;
let pendingAccount = null;
let pendingCustomFields = [];

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
}

function openModal(contentHtml) {
  modalBox.innerHTML = contentHtml;
  modalOverlay.classList.add("visible");
}

modalOverlay.addEventListener("click", (event) => {
  if (event.target === modalOverlay) closeModal();
});

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
    chipRow.appendChild(makeChip(category, activeCategory === category, () => {
      activeCategory = category;
      renderEntries();
      renderChips();
    }));
  });
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

  const starButton = document.createElement("button");
  starButton.className = "action-button star" + (entry.is_favorite ? " active" : "");
  starButton.textContent = entry.is_favorite ? "\u2605" : "\u2606";
  starButton.addEventListener("click", async () => {
    await window.pywebview.api.toggle_favorite(entry.id, !entry.is_favorite);
    loadEntries();
  });
  actions.appendChild(starButton);

  const viewButton = document.createElement("button");
  viewButton.className = "action-button";
  viewButton.textContent = "View";
  viewButton.addEventListener("click", () => {
    alert("View screen not built yet for: " + entry.title);
  });
  actions.appendChild(viewButton);

  const deleteButton = document.createElement("button");
  deleteButton.className = "action-button danger";
  deleteButton.textContent = "Delete";
  deleteButton.addEventListener("click", async () => {
    const confirmed = confirm(`Are you sure you want to delete "${entry.title}"? This cannot be undone.`);
    if (confirmed) {
      await window.pywebview.api.delete_entry(entry.id);
      loadEntries();
    }
  });
  actions.appendChild(deleteButton);

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
    alert("Group view not built yet for: " + groupEntries[0].title);
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

function startNewAccountForm() {
  pendingAccount = { title: "", email: "", username: "", password: "", notes: "", url: "" };
  pendingCustomFields = [];
  renderAccountForm();
}

function renderAccountForm() {
  const customFieldsHtml = pendingCustomFields.map((field, index) => `
    <div class="custom-field-row">
      <div class="modal-field">
        <label>${escapeHtml(field.label)}</label>
        <input type="text" class="custom-field-value" data-index="${index}" value="${escapeHtml(field.value)}">
      </div>
      <button type="button" class="remove-field-button" data-remove="${index}">&times;</button>
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
        <button type="button" class="icon-button" id="acc-toggle-password">\u{1F441}</button>
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
    passwordField.type = passwordField.type === "password" ? "text" : "password";
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

async function showCategoryPicker() {
  const categories = await window.pywebview.api.get_categories();

  const optionsHtml = categories.length === 0
    ? `<p style="color:#9096A2; font-size:13px;">No categories yet. You can add one later.</p>`
    : categories.map((category) => `
        <label class="category-option">
          <input type="radio" name="category-pick" value="${escapeHtml(category)}">
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

    await window.pywebview.api.save_account(dataToSave);
    closeModal();
    loadEntries();
  });
}

if (window.pywebview) {
  loadEntries();
} else {
  window.addEventListener("pywebviewready", loadEntries);
}