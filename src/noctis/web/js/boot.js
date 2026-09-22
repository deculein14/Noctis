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