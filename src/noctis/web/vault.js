let allEntries = [];
let activeCategory = null;
let showFavoritesOnly = false;

const searchInput = document.getElementById("search-input");
const chipRow = document.getElementById("chip-row");
const entriesContainer = document.getElementById("entries-container");
const addButton = document.getElementById("add-button");

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
    (showFavoritesOnly ? "★" : "☆") + " Favorites",
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

  if (showFavoritesOnly) {
    entries = entries.filter((e) => e.is_favorite);
  }
  if (activeCategory) {
    entries = entries.filter((e) => e.category === activeCategory);
  }
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
  starButton.textContent = entry.is_favorite ? "★" : "☆";
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
  alert("Add Account / Category screen not built yet.");
});

loadEntries();