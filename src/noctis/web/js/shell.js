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
  } else if (targetSection === "media") {
    showMediaMainView();
  }
}

sidebarItems.forEach((item) => {
  item.addEventListener("click", async () => {
    const targetSection = item.dataset.section;

    if (targetSection === "wallet") {
      const entered = await promptForMasterPassword("Enter your master password to open Wallet");
      if (entered === null) return;
      const result = await window.pywebview.api.verify_master_password(entered);
      if (!result.success) {
        alert(result.message);
        return;
      }
    }

    activateSection(targetSection);
  });
});