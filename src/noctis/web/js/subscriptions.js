// ---------- Months-paid confirmation modal (Subscriptions - Mark as Done) ----------

function promptForMonthsPaid(subscriptionName) {
  return new Promise((resolve) => {
    openModal(`
      <p class="modal-title">Mark "${escapeHtml(subscriptionName)}" as Paid</p>
      <p style="text-align:center; color:#9096A2; font-size:12px; margin-top:-12px;">How many months did you just pay for? (e.g. 1 for monthly, 12 for a year)</p>
      <div class="modal-field">
        <label>Months Paid</label>
        <input type="number" id="months-paid-input" min="1" step="1" value="1">
      </div>
      <p class="modal-error" id="months-paid-error"></p>
      <div class="modal-button-row">
        <button class="modal-secondary" id="months-paid-cancel">Cancel</button>
        <button class="modal-primary" id="months-paid-confirm">Confirm</button>
      </div>
    `);

    const input = document.getElementById("months-paid-input");
    input.focus();
    input.select();

    const cleanup = (value) => {
      closeModal();
      resolve(value);
    };

    const attemptConfirm = () => {
      const errorLabel = document.getElementById("months-paid-error");
      const months = parseInt(input.value, 10);
      if (!months || months < 1) {
        errorLabel.textContent = "Enter a whole number of months (1 or more).";
        return;
      }
      cleanup(months);
    };

    document.getElementById("months-paid-cancel").addEventListener("click", () => cleanup(null));
    document.getElementById("months-paid-confirm").addEventListener("click", attemptConfirm);
  });
}

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

  const payments = await window.pywebview.api.get_subscription_payments(subscriptionId);

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
    subFieldRow("Date Availed", formatDateForDisplay(details.date_started)) +
    subFieldRow("Date Ended", formatDateForDisplay(details.date_ended));

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

  const paymentHistoryHtml = payments.length > 0
    ? `
      <div class="detail-section-label">Payment History</div>
      <div class="payment-history-list">
        ${payments.map((p) => `
          <div class="detail-field payment-history-item">
            <div class="detail-field-label-row">
              <span class="detail-field-label">${p.months_paid} month${p.months_paid > 1 ? "s" : ""} paid</span>
            </div>
            <div class="detail-field-value-row">
              <span class="detail-field-value">${escapeHtml(formatDateForDisplay(p.previous_due_date))} \u2192 ${escapeHtml(formatDateForDisplay(p.new_due_date))}</span>
            </div>
          </div>
        `).join("")}
      </div>
    `
    : "";

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
      ${paymentHistoryHtml}

      <div class="detail-secondary-row">
        <button type="button" class="modal-secondary" id="sub-mark-paid-btn">Mark as Done</button>
        <button type="button" class="danger-text" id="sub-delete-btn">Delete</button>
      </div>

      <p class="detail-error" id="sub-mark-paid-error"></p>

      <div class="detail-button-row">
        <button class="modal-secondary" id="sub-back-btn">Back</button>
        <button class="modal-primary" id="sub-edit-btn">Edit</button>
      </div>
    </div>
  `;

  document.getElementById("sub-back-btn").addEventListener("click", showSubscriptionsMainView);

  document.getElementById("sub-mark-paid-btn").addEventListener("click", async () => {
    const errorLabel = document.getElementById("sub-mark-paid-error");
    errorLabel.textContent = "";

    if (!details.date_ended) {
      errorLabel.textContent = 'This subscription has no "Date Ended" set yet. Edit it and set a date first, then mark it as paid.';
      return;
    }

    const months = await promptForMonthsPaid(details.name);
    if (months === null) return;

    const result = await window.pywebview.api.mark_subscription_paid(subscriptionId, months);
    if (!result.success) {
      errorLabel.textContent = result.message;
      return;
    }

    showSubscriptionDetailView(subscriptionId);
    refreshNotifications();
  });

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