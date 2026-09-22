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