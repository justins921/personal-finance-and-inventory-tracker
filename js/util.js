/* ============================================================================
 * util.js — formatting, ids, dates, small DOM helpers
 * Attaches to window.App.util
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});

  const util = {
    /** Generate a short unique id. */
    uid() {
      return (
        Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
      );
    },

    /** Coerce any input into a finite number, defaulting to 0. */
    num(v) {
      if (v === null || v === undefined || v === "") return 0;
      const n = typeof v === "number" ? v : parseFloat(String(v).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    },

    /** Format a number as USD currency. */
    money(v, opts) {
      const n = util.num(v);
      const o = opts || {};
      return n.toLocaleString("en-US", {
        style: "currency",
        currency: "USD",
        minimumFractionDigits: o.cents ? 2 : 0,
        maximumFractionDigits: o.cents ? 2 : 0,
      });
    },

    /** Format a ratio (0.06) or a percent value depending on `asRatio`. */
    pct(v, digits) {
      const n = util.num(v);
      const d = digits == null ? 1 : digits;
      return n.toFixed(d) + "%";
    },

    /** Today's date as YYYY-MM-DD (local). */
    today() {
      const d = new Date();
      return util.toISODate(d);
    },

    toISODate(d) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    },

    /** Parse a YYYY-MM-DD string into a Date at local midnight. */
    parseDate(s) {
      if (!s) return null;
      const parts = String(s).split("-").map(Number);
      if (parts.length < 3 || parts.some(isNaN)) {
        const d = new Date(s);
        return isNaN(d.getTime()) ? null : d;
      }
      return new Date(parts[0], parts[1] - 1, parts[2]);
    },

    /** Whole months elapsed between two dates (a before b). */
    monthsBetween(a, b) {
      if (!a || !b) return 0;
      let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
      if (b.getDate() < a.getDate()) months -= 1;
      return Math.max(0, months);
    },

    /** Add months to a date, returning a new Date. */
    addMonths(d, months) {
      const r = new Date(d.getTime());
      r.setMonth(r.getMonth() + months);
      return r;
    },

    /** Human readable date like "May 2026". */
    monthLabel(d) {
      return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    },

    /** Friendly full date. */
    niceDate(s) {
      const d = util.parseDate(s);
      if (!d) return "—";
      return d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    },

    /** Escape text for safe insertion into HTML. */
    esc(s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    },

    /** Build a DOM element from an HTML string (first child). */
    el(html) {
      const t = document.createElement("template");
      t.innerHTML = html.trim();
      return t.content.firstElementChild;
    },

    /** querySelector shortcut. */
    $(sel, root) {
      return (root || document).querySelector(sel);
    },
    $$(sel, root) {
      return Array.from((root || document).querySelectorAll(sel));
    },

    /** Clamp a number. */
    clamp(n, lo, hi) {
      return Math.min(hi, Math.max(lo, n));
    },

    /** Sign-aware CSS class for positive / negative figures. */
    signClass(n) {
      const v = util.num(n);
      if (v > 0) return "pos";
      if (v < 0) return "neg";
      return "";
    },
  };

  App.util = util;
})();
