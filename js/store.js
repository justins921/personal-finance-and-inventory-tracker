/* ============================================================================
 * store.js — application state, persistence, and the data schema.
 *
 * Single source of truth. Views read from App.store.data and mutate through
 * the helper methods, which persist to localStorage and emit a "change"
 * event so the UI can re-render.
 * Attaches to window.App.store
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const uid = App.util.uid;

  const STORAGE_BASE = "pfs-re-tracker:v1";
  const SCHEMA_VERSION = 1;

  // Storage is namespaced so multiple accounts on the same browser never see
  // each other's cached data. "local" is the no-login namespace; once a user
  // signs in we switch to "u:<userId>".
  let namespace = "local";
  function storageKey() {
    return STORAGE_BASE + ":" + namespace;
  }

  /** A fresh, empty data object. */
  function emptyData() {
    return {
      schemaVersion: SCHEMA_VERSION,
      profile: { name: "", baseCurrency: "USD", created: App.util.today() },
      accounts: {
        cash: [],
        checking: [],
        savings: [],
        stocks: [],
        retirement: [],
        other: [],
      },
      properties: [],
      vehicles: [],
      businesses: [],
      liabilities: {
        personalLoans: [],
        businessLoans: [],
        creditCards: [],
        otherDebts: [],
      },
      netWorthSnapshots: [],
      settings: { lastView: "dashboard" },
    };
  }

  /** Deep-merge loaded data onto a fresh skeleton so missing keys are safe. */
  function normalize(loaded) {
    const base = emptyData();
    if (!loaded || typeof loaded !== "object") return base;
    const out = base;
    out.schemaVersion = SCHEMA_VERSION;
    if (loaded.profile) Object.assign(out.profile, loaded.profile);
    if (loaded.accounts) {
      for (const k of Object.keys(out.accounts)) {
        if (Array.isArray(loaded.accounts[k])) out.accounts[k] = loaded.accounts[k];
      }
    }
    if (Array.isArray(loaded.properties)) out.properties = loaded.properties;
    if (Array.isArray(loaded.vehicles)) out.vehicles = loaded.vehicles;
    if (Array.isArray(loaded.businesses)) out.businesses = loaded.businesses;
    if (loaded.liabilities) {
      for (const k of Object.keys(out.liabilities)) {
        if (Array.isArray(loaded.liabilities[k])) out.liabilities[k] = loaded.liabilities[k];
      }
    }
    if (Array.isArray(loaded.netWorthSnapshots)) out.netWorthSnapshots = loaded.netWorthSnapshots;
    if (loaded.settings) Object.assign(out.settings, loaded.settings);
    return out;
  }

  const listeners = [];
  let remoteSaver = null; // optional cloud persister, registered by cloud.js
  let viewAsBackup = null; // stashed owner state while an admin views another account

  function notify() {
    listeners.forEach((fn) => {
      try {
        fn(store.data);
      } catch (e) {
        console.error(e);
      }
    });
  }

  const store = {
    data: emptyData(),

    // True while an admin is viewing someone else's account. In this mode the
    // store is strictly READ-ONLY: nothing is written to localStorage or the
    // cloud, so the viewed data can never overwrite the admin's own row.
    isViewingAs: false,

    /* ---- namespace / persistence ---------------------------------------*/

    /**
     * Switch the active storage namespace (e.g. on login/logout) and reload
     * the cached data for that namespace into memory.
     */
    setNamespace(ns) {
      namespace = ns || "local";
      store.load();
    },

    getNamespace() {
      return namespace;
    },

    /** Read (without switching to) the cached data for another namespace. */
    readNamespace(ns) {
      try {
        const raw = localStorage.getItem(STORAGE_BASE + ":" + ns);
        return raw ? normalize(JSON.parse(raw)) : null;
      } catch (e) {
        return null;
      }
    },

    /** Permanently clear a namespace's local cache. */
    clearNamespace(ns) {
      try {
        localStorage.removeItem(STORAGE_BASE + ":" + ns);
      } catch (e) {
        /* ignore */
      }
    },

    load() {
      try {
        const raw = localStorage.getItem(storageKey());
        if (raw) {
          store.data = normalize(JSON.parse(raw));
          return true;
        }
      } catch (e) {
        console.error("Failed to load saved data:", e);
      }
      store.data = emptyData();
      return false;
    },

    /* ---- admin read-only "view as" mode --------------------------------*/

    /** Swap in another user's data for read-only viewing (admins only). */
    enterViewAs(data) {
      if (!store.isViewingAs) viewAsBackup = { data: store.data, namespace };
      store.isViewingAs = true;
      store.data = normalize(data);
      notify();
    },

    /** Restore the admin's own data and leave read-only mode. */
    exitViewAs() {
      if (!store.isViewingAs) return;
      store.isViewingAs = false;
      if (viewAsBackup) {
        namespace = viewAsBackup.namespace;
        store.data = viewAsBackup.data; // owner's in-memory state, untouched
        viewAsBackup = null;
      } else {
        store.load();
      }
      notify();
    },

    /** Write the in-memory data to the local cache only. */
    save() {
      if (store.isViewingAs) return; // never persist a viewed account
      try {
        localStorage.setItem(storageKey(), JSON.stringify(store.data));
      } catch (e) {
        console.error("Failed to save data:", e);
        const msg =
          "Could not save your data to this browser. Storage may be full or disabled. " +
          "Use Settings → Export to back up your data.";
        if (App.ui && App.ui.alert) App.ui.alert({ title: "Couldn't save", message: msg, danger: true });
        else alert(msg);
      }
    },

    /**
     * Replace the entire data object (e.g. with data pulled from the cloud).
     * By default this does NOT push back to the remote, preventing sync loops.
     */
    replaceData(data, opts) {
      opts = opts || {};
      store.data = normalize(data);
      store.save();
      listeners.forEach((fn) => {
        try {
          fn(store.data);
        } catch (e) {
          console.error(e);
        }
      });
      if (opts.pushRemote && remoteSaver) remoteSaver(store.data);
    },

    /** Register a cloud persister: fn(data) called (debounced) on each commit. */
    setRemoteSaver(fn) {
      remoteSaver = fn;
    },

    /** Persist (local + remote) and notify listeners. Call after any mutation. */
    commit() {
      if (store.isViewingAs) {
        // Read-only: re-render but never write the viewed account anywhere.
        notify();
        return;
      }
      store.save();
      if (remoteSaver) {
        try {
          remoteSaver(store.data);
        } catch (e) {
          console.error("Remote save failed:", e);
        }
      }
      notify();
    },

    onChange(fn) {
      listeners.push(fn);
    },

    /** True when the data object has no user-entered content worth syncing. */
    isEmpty(d) {
      d = d || store.data;
      const a = d.accounts || {};
      const accountsEmpty = ["cash", "checking", "savings", "stocks", "retirement", "other"].every(
        (k) => !(a[k] && a[k].length)
      );
      return (
        accountsEmpty &&
        !(d.properties && d.properties.length) &&
        !(d.vehicles && d.vehicles.length) &&
        !(d.businesses && d.businesses.length) &&
        !(d.netWorthSnapshots && d.netWorthSnapshots.length)
      );
    },

    /* ---- generic collection helpers ------------------------------------*/

    /** Resolve a dotted path like "accounts.cash" to its array. */
    collection(path) {
      const parts = path.split(".");
      let node = store.data;
      for (const p of parts) node = node[p];
      return node;
    },

    addItem(path, item) {
      const coll = store.collection(path);
      item.id = item.id || uid();
      coll.push(item);
      store.commit();
      return item;
    },

    updateItem(path, id, patch) {
      const coll = store.collection(path);
      const it = coll.find((x) => x.id === id);
      if (it) {
        Object.assign(it, patch);
        store.commit();
      }
      return it;
    },

    removeItem(path, id) {
      const coll = store.collection(path);
      const idx = coll.findIndex((x) => x.id === id);
      if (idx >= 0) {
        coll.splice(idx, 1);
        store.commit();
      }
    },

    /* ---- properties -----------------------------------------------------*/

    getProperty(id) {
      return store.data.properties.find((p) => p.id === id);
    },

    addProperty(p) {
      p.id = p.id || uid();
      p.valueHistory = p.valueHistory || [];
      p.actuals = p.actuals || [];
      store.data.properties.push(p);
      store.commit();
      return p;
    },

    /** Record a market value observation and update currentValue. */
    addValueObservation(propertyId, value, date, method) {
      const p = store.getProperty(propertyId);
      if (!p) return;
      p.valueHistory = p.valueHistory || [];
      p.valueHistory.push({
        id: uid(),
        date: date || App.util.today(),
        value: App.util.num(value),
        method: method || "manual",
      });
      p.valueHistory.sort((a, b) => (a.date < b.date ? -1 : 1));
      p.currentValue = App.util.num(value);
      store.commit();
    },

    /** Record an annual actual-results entry for projected-vs-actual. */
    addActual(propertyId, actual) {
      const p = store.getProperty(propertyId);
      if (!p) return;
      p.actuals = p.actuals || [];
      actual.id = actual.id || uid();
      // replace an existing entry for the same year
      const idx = p.actuals.findIndex((a) => String(a.year) === String(actual.year));
      if (idx >= 0) p.actuals[idx] = Object.assign(p.actuals[idx], actual);
      else p.actuals.push(actual);
      p.actuals.sort((a, b) => App.util.num(a.year) - App.util.num(b.year));
      store.commit();
    },

    /* ---- net worth snapshots -------------------------------------------*/

    /**
     * Capture today's net worth as a dated snapshot. If a snapshot for the
     * same month already exists it is overwritten so the trend stays clean.
     */
    captureSnapshot(date) {
      const d = date || App.util.today();
      const nw = App.finance.netWorth(store.data, App.util.parseDate(d));
      const month = d.slice(0, 7); // YYYY-MM
      const snap = {
        id: uid(),
        date: d,
        netWorth: nw.netWorth,
        totalAssets: nw.totalAssets,
        totalLiabilities: nw.totalLiabilities,
        realEstateEquity: nw.realEstateEquity,
        portfolioValue: nw.portfolio.value,
        portfolioDebt: nw.portfolio.debt,
        cashFlowAnnual: nw.portfolio.annualCashFlow,
      };
      const arr = store.data.netWorthSnapshots;
      const idx = arr.findIndex((s) => s.date.slice(0, 7) === month);
      if (idx >= 0) arr[idx] = snap;
      else arr.push(snap);
      arr.sort((a, b) => (a.date < b.date ? -1 : 1));
      store.commit();
      return snap;
    },

    /* ---- import / export / reset ---------------------------------------*/

    exportJSON() {
      return JSON.stringify(store.data, null, 2);
    },

    importJSON(text) {
      const parsed = JSON.parse(text);
      store.data = normalize(parsed);
      store.commit();
    },

    reset() {
      store.data = emptyData();
      store.commit();
    },

    loadDemo() {
      store.data = App.demoData();
      store.commit();
    },
  };

  App.store = store;
})();
