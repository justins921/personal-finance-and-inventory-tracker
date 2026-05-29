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

  /* ---- shared chrome ----------------------------------------------------*/

  let chromeWired = false;
  function wireChrome() {
    if (chromeWired) return;
    chromeWired = true;
    window.addEventListener("hashchange", () => router.render());
    const toggle = util.$("#navToggle");
    const sidebar = util.$("#sidebar");
    if (toggle && sidebar) {
      toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
      util.$$(".nav-link").forEach((a) =>
        a.addEventListener("click", () => sidebar.classList.remove("open"))
      );
    }
  }

  function maybeWelcome() {
    if (!App.store.isEmpty()) return;
    if (localStorage.getItem("pfs-re-tracker:seen-welcome")) return;
    localStorage.setItem("pfs-re-tracker:seen-welcome", "1");
    setTimeout(() => {
      App.ui
        .confirm({
          title: "Welcome! 👋",
          message:
            "Want to load a sample portfolio to explore how everything works? You can erase it anytime in Settings.",
          confirmLabel: "Load sample",
          cancelLabel: "Start empty",
        })
        .then((yes) => {
          if (yes) {
            App.store.loadDemo();
            router.refresh();
          }
        });
    }, 400);
  }

  /** Render the app shell + current view (used after login or in local mode). */
  function startApp() {
    document.body.classList.remove("auth-locked");
    wireChrome();
    router.render();
    updateAccountChrome();
  }

  /** Reflect login + sync status in the sidebar footer. */
  function updateAccountChrome(syncStatus) {
    const foot = util.$("#sidebarAccount");
    if (!foot) return;
    const user = App.auth && App.auth.user && App.auth.user();
    const configured = App.config.isConfigured();
    if (configured && user) {
      const dot = syncStatus || (App.cloud ? App.cloud.getStatus() : "synced");
      foot.innerHTML = `
        <div class="acct">
          <div class="acct__sync acct__sync--${dot}" title="Sync: ${dot}"></div>
          <div class="acct__email" title="${util.esc(user.email || "")}">${util.esc(user.email || "Signed in")}</div>
          <button class="acct__out" id="signOutBtn" title="Sign out">Sign out</button>
        </div>`;
      const out = util.$("#signOutBtn", foot);
      if (out) out.addEventListener("click", () => App.auth.signOut());
    } else if (configured) {
      foot.innerHTML = `<button class="acct__signin" id="signInBtn">Sign in to sync</button>`;
      const inb = util.$("#signInBtn", foot);
      if (inb) inb.addEventListener("click", () => location.reload());
    } else {
      foot.innerHTML = `<p>Free &amp; private.<br/>Your data never leaves your device.</p>`;
    }
  }
  App.updateAccountChrome = updateAccountChrome;

  /* ---- auth + cloud orchestration --------------------------------------*/

  async function enterApp(user) {
    App.auth.removeGate();
    App.cloud.setUser(user.id);
    App.store.setNamespace("u:" + user.id); // loads this user's local cache

    // Pull authoritative data from the cloud.
    const cloudData = await App.cloud.pull();

    if (cloudData && !App.store.isEmpty(cloudData)) {
      // Cloud is the source of truth.
      App.store.replaceData(cloudData);
    } else {
      // No cloud data yet — seed it from whatever local data we have.
      let seed = null;
      if (!App.store.isEmpty()) {
        seed = App.store.data; // this user's device cache
      } else {
        // Adopt pre-login local-mode data, if any (first-time signup flow).
        const localData = App.store.readNamespace("local");
        if (localData && !App.store.isEmpty(localData)) {
          App.store.replaceData(localData);
          seed = localData;
        }
      }
      if (seed) await App.cloud.pushNow(seed);
    }

    startApp();
    maybeWelcome();
  }

  function showLogin() {
    document.body.classList.add("auth-locked");
    App.auth.renderGate(() => {
      // "Use on this device only" — fall back to local mode.
      App.store.setNamespace("local");
      App.auth.removeGate();
      startApp();
      maybeWelcome();
    });
  }

  function handleAuthChange(user) {
    if (user) {
      enterApp(user);
    } else {
      // Signed out: drop to login gate, keep nothing in view.
      App.store.setNamespace("local");
      showLogin();
    }
  }

  /* ---- bootstrap --------------------------------------------------------*/

  async function init() {
    const configured = App.config.isConfigured();

    if (!configured) {
      // Local-only mode (no backend configured).
      App.store.setNamespace("local");
      startApp();
      maybeWelcome();
      return;
    }

    // Cloud mode: set up Supabase, auth, and sync.
    const client = window.supabase.createClient(App.config.url, App.config.anonKey);
    App.sb = client;
    App.auth.init(client);
    App.cloud.init(client);
    App.store.setRemoteSaver((data) => App.cloud.pushDebounced(data));
    App.cloud.onStatus((s) => updateAccountChrome(s));
    App.auth.onChange(handleAuthChange);
    App.auth.listen();

    try {
      const user = await App.auth.getSession();
      if (user) await enterApp(user);
      else showLogin();
    } catch (e) {
      console.error("Auth init failed; falling back to local mode:", e);
      App.store.setNamespace("local");
      startApp();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
