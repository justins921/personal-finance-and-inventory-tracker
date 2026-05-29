/* ============================================================================
 * app.js — bootstrap + hash router. Wires the nav, loads data, renders views.
 * Attaches to window.App.router
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const util = App.util;

  const ROUTES = [
    { pattern: /^\/?$/, view: "dashboard" },
    { pattern: /^\/dashboard$/, view: "dashboard" },
    { pattern: /^\/statement$/, view: "statement" },
    { pattern: /^\/portfolio$/, view: "portfolio" },
    { pattern: /^\/property\/(.+)$/, view: "property", param: "id" },
    { pattern: /^\/trends$/, view: "trends" },
    { pattern: /^\/settings$/, view: "settings" },
  ];

  function parseHash() {
    let h = location.hash.replace(/^#/, "");
    if (!h) h = "/dashboard";
    for (const r of ROUTES) {
      const m = h.match(r.pattern);
      if (m) {
        const params = {};
        if (r.param) params[r.param] = decodeURIComponent(m[1]);
        return { view: r.view, params };
      }
    }
    return { view: "dashboard", params: {} };
  }

  const router = {
    current: null,

    render() {
      const { view, params } = parseHash();
      this.current = { view, params };
      const root = util.$("#view");
      const mod = App.views[view];
      if (!mod) {
        root.innerHTML = `<h1>Not found</h1>`;
        return;
      }
      window.scrollTo(0, 0);
      try {
        mod.render(root, params);
      } catch (e) {
        console.error("Render error in view '" + view + "':", e);
        root.innerHTML = `<div class="card"><h3>Something went wrong rendering this page.</h3>
          <p class="muted">${util.esc(e.message)}</p>
          <p><a href="#/dashboard">Go to dashboard</a></p></div>`;
      }
      this.syncNav(view);
      // remember last view
      App.store.data.settings.lastView = view;
    },

    /** Re-render the current view in place (after a data mutation). */
    refresh() {
      this.render();
    },

    syncNav(view) {
      util.$$(".nav-link").forEach((a) => {
        const target = a.getAttribute("data-view");
        a.classList.toggle("active", target === view || (view === "property" && target === "portfolio"));
      });
    },

    go(view) {
      location.hash = "#/" + view;
    },
  };

  App.router = router;

  function init() {
    App.store.load();

    // Render once on load and on every hash change.
    window.addEventListener("hashchange", () => router.render());

    // Mobile nav toggle
    const toggle = util.$("#navToggle");
    const sidebar = util.$("#sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
      util.$$(".nav-link").forEach((a) =>
        a.addEventListener("click", () => sidebar.classList.remove("open"))
      );
    }

    router.render();

    // First-time hint: offer the sample portfolio.
    const empty =
      !App.store.data.properties.length &&
      !App.store.data.accounts.checking.length &&
      !App.store.data.netWorthSnapshots.length;
    if (empty && !localStorage.getItem("pfs-re-tracker:seen-welcome")) {
      localStorage.setItem("pfs-re-tracker:seen-welcome", "1");
      setTimeout(() => {
        if (confirm("Welcome! Load a sample portfolio to explore how everything works? (You can erase it anytime in Settings.)")) {
          App.store.loadDemo();
          router.refresh();
        }
      }, 400);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
