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

  const STORAGE_KEY = "pfs-re-tracker:v1";
  const SCHEMA_VERSION = 1;

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

  const store = {
    data: emptyData(),

    /* ---- persistence ----------------------------------------------------*/
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
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

    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(store.data));
      } catch (e) {
        console.error("Failed to save data:", e);
        alert(
          "Could not save your data to this browser. Storage may be full or disabled. " +
            "Use Settings → Export to back up your data."
        );
      }
    },

    /** Persist + notify listeners. Call after any mutation. */
    commit() {
      store.save();
      listeners.forEach((fn) => {
        try {
          fn(store.data);
        } catch (e) {
          console.error(e);
        }
      });
    },

    onChange(fn) {
      listeners.push(fn);
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
