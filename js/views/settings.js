/* ============================================================================
 * views/settings.js — profile + data management (export / import / reset).
 * This is the heart of "update your data whenever you need": your data lives
 * in this browser and you can back it up or move it between devices.
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const { esc } = App.util;
  const ui = App.ui;

  V.settings = {
    render(root) {
      const profile = App.store.data.profile || {};
      const lastSaved = "Saved automatically to this browser";

      root.innerHTML = `
        <div class="view-head">
          <div>
            <h1>Settings & Data</h1>
            <p class="muted">Your data stays on this device. Back it up or move it anytime.</p>
          </div>
        </div>

        <div class="card">
          <h3>Profile</h3>
          <div class="grid-form">
            <div class="field">
              <label for="profName">Your Name</label>
              <input id="profName" type="text" value="${esc(profile.name || "")}" placeholder="e.g. Alex Investor">
            </div>
          </div>
          <button class="btn btn--primary" id="saveProfile">Save profile</button>
        </div>

        <div class="card">
          <h3>Backup & Restore</h3>
          <p class="muted">
            Everything you enter is stored locally in this browser (no account, no server).
            Export a backup file to keep your data safe or to load it on another device or browser.
          </p>
          <div class="btn-row">
            <button class="btn btn--primary" id="exportBtn">⬇ Export backup (.json)</button>
            <button class="btn btn--ghost" id="importBtn">⬆ Import backup</button>
            <input type="file" id="importFile" accept="application/json,.json" hidden>
          </div>
          <p class="hint">${esc(lastSaved)}.</p>
        </div>

        <div class="card">
          <h3>Sample Data</h3>
          <p class="muted">Load a sample portfolio to explore the app, or clear everything to start fresh.</p>
          <div class="btn-row">
            <button class="btn btn--ghost" id="demoBtn">Load sample portfolio</button>
            <button class="btn btn--danger-ghost" id="resetBtn">Erase all my data</button>
          </div>
        </div>

        <div class="card card--about">
          <h3>About</h3>
          <p>
            This is a free Personal Financial Statement &amp; Real Estate Portfolio tracker —
            a command center for your net worth, equity, debt, cash flow, and portfolio performance,
            with automatic loan amortization. It is not accounting or property-management software.
          </p>
          <p class="hint">Tip: bookmark this page. As long as you use the same browser, your data will be here when you return.</p>
        </div>
      `;

      App.util.$("#saveProfile", root).addEventListener("click", () => {
        App.store.data.profile.name = App.util.$("#profName", root).value.trim();
        App.store.commit();
        ui.toast("Profile saved.", "ok");
      });

      App.util.$("#exportBtn", root).addEventListener("click", () => this.exportData());

      const fileInput = App.util.$("#importFile", root);
      App.util.$("#importBtn", root).addEventListener("click", () => fileInput.click());
      fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            App.store.importJSON(reader.result);
            ui.toast("Backup imported.", "ok");
            location.hash = "#/dashboard";
            App.router.refresh();
          } catch (err) {
            ui.toast("That file could not be read as a valid backup.", "warn");
          }
        };
        reader.readAsText(file);
        fileInput.value = "";
      });

      App.util.$("#demoBtn", root).addEventListener("click", () => {
        if (confirm("Load the sample portfolio? This replaces your current data. Export a backup first if you want to keep it.")) {
          App.store.loadDemo();
          ui.toast("Sample portfolio loaded.", "ok");
          location.hash = "#/dashboard";
          App.router.refresh();
        }
      });

      App.util.$("#resetBtn", root).addEventListener("click", () => {
        if (confirm("Erase ALL your data from this browser? This cannot be undone. Export a backup first if unsure.")) {
          App.store.reset();
          ui.toast("All data erased.");
          location.hash = "#/dashboard";
          App.router.refresh();
        }
      });
    },

    exportData() {
      const blob = new Blob([App.store.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "financial-tracker-backup-" + App.util.today() + ".json";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      ui.toast("Backup downloaded.", "ok");
    },
  };
})();
