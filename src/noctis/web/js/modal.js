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

// ---------- Enter-to-next-field navigation (applies to every modal form) ----------
//
// Works for any modal rendered into modalBox: Account, Subscription, Folder,
// Category, the master-password prompt, and the months-paid prompt. Pressing
// Enter in a text-like field moves focus to the next eligible field in DOM
// order; pressing Enter in the last field clicks the modal's primary button
// (".modal-primary"). Field lists are re-queried on every keypress, so
// dynamically added fields (e.g. custom fields, privileges) are included
// automatically without any extra wiring.

function handleModalEnterKey(event) {
  if (event.key !== "Enter") return;

  const target = event.target;
  if (target.tagName !== "INPUT") return;
  if (target.type === "radio" || target.type === "checkbox") return;

  const fields = Array.from(modalBox.querySelectorAll("input")).filter(
    (el) => el.type !== "radio" && el.type !== "checkbox" && !el.disabled && el.offsetParent !== null
  );

  const index = fields.indexOf(target);
  if (index === -1) return;

  event.preventDefault();

  if (index < fields.length - 1) {
    const nextField = fields[index + 1];
    nextField.focus();
    if (typeof nextField.select === "function") nextField.select();
  } else {
    const primaryButton = modalBox.querySelector(".modal-primary:not(:disabled)");
    if (primaryButton) primaryButton.click();
  }
}

modalBox.addEventListener("keydown", handleModalEnterKey);

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
  });
}