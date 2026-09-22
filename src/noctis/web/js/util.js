function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

function resetScroll() {
  document.documentElement.scrollLeft = 0;
  document.body.scrollLeft = 0;
  const contentArea = document.querySelector(".content-area");
  if (contentArea) contentArea.scrollLeft = 0;
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