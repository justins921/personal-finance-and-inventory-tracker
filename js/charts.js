/* ============================================================================
 * charts.js — thin wrapper around Chart.js (loaded via CDN).
 * Degrades gracefully if Chart.js is unavailable (e.g. offline).
 * Attaches to window.App.charts
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const registry = {};

  function ready() {
    return typeof window.Chart !== "undefined";
  }

  function destroy(id) {
    if (registry[id]) {
      registry[id].destroy();
      delete registry[id];
    }
  }

  function ctx(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return el.getContext("2d");
  }

  const COLORS = {
    green: "#2e9e6b",
    greenFill: "rgba(46,158,107,0.12)",
    blue: "#3a7bd5",
    red: "#d9534f",
    amber: "#e0a93c",
    grid: "rgba(120,130,150,0.15)",
    text: "#6b7480",
  };

  function baseOptions(extra) {
    return Object.assign(
      {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (c) =>
                " " +
                (c.dataset.label ? c.dataset.label + ": " : "") +
                App.util.money(c.parsed.y),
            },
          },
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: COLORS.text } },
          y: {
            grid: { color: COLORS.grid },
            ticks: {
              color: COLORS.text,
              callback: (v) => {
                if (Math.abs(v) >= 1000000) return "$" + (v / 1000000).toFixed(1) + "M";
                if (Math.abs(v) >= 1000) return "$" + Math.round(v / 1000) + "k";
                return "$" + v;
              },
            },
          },
        },
      },
      extra || {}
    );
  }

  const charts = {
    ready,
    destroy,

    netWorthLine(id, snapshots) {
      if (!ready()) return;
      destroy(id);
      const c = ctx(id);
      if (!c) return;
      const data = (snapshots || []).slice();
      const labels = data.map((s) => App.util.niceDate(s.date));
      registry[id] = new window.Chart(c, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Net Worth",
              data: data.map((s) => s.netWorth),
              borderColor: COLORS.green,
              backgroundColor: COLORS.greenFill,
              fill: true,
              tension: 0.3,
              pointRadius: 3,
              borderWidth: 2,
            },
          ],
        },
        options: baseOptions(),
      });
    },

    assetsLiabilitiesLine(id, snapshots) {
      if (!ready()) return;
      destroy(id);
      const c = ctx(id);
      if (!c) return;
      const data = (snapshots || []).slice();
      registry[id] = new window.Chart(c, {
        type: "line",
        data: {
          labels: data.map((s) => App.util.niceDate(s.date)),
          datasets: [
            { label: "Assets", data: data.map((s) => s.totalAssets), borderColor: COLORS.blue, tension: 0.3, borderWidth: 2, pointRadius: 2 },
            { label: "Liabilities", data: data.map((s) => s.totalLiabilities), borderColor: COLORS.red, tension: 0.3, borderWidth: 2, pointRadius: 2 },
            { label: "RE Equity", data: data.map((s) => s.realEstateEquity), borderColor: COLORS.green, tension: 0.3, borderWidth: 2, pointRadius: 2 },
          ],
        },
        options: baseOptions({ plugins: { legend: { display: true, labels: { color: COLORS.text } } } }),
      });
    },

    cashFlowLine(id, snapshots) {
      if (!ready()) return;
      destroy(id);
      const c = ctx(id);
      if (!c) return;
      const data = (snapshots || []).slice();
      registry[id] = new window.Chart(c, {
        type: "bar",
        data: {
          labels: data.map((s) => App.util.niceDate(s.date)),
          datasets: [
            { label: "Annual Cash Flow", data: data.map((s) => s.cashFlowAnnual), backgroundColor: COLORS.green, borderRadius: 4 },
          ],
        },
        options: baseOptions(),
      });
    },

    valueHistoryLine(id, history) {
      if (!ready()) return;
      destroy(id);
      const c = ctx(id);
      if (!c) return;
      const data = (history || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      registry[id] = new window.Chart(c, {
        type: "line",
        data: {
          labels: data.map((s) => App.util.niceDate(s.date)),
          datasets: [
            {
              label: "Estimated Value",
              data: data.map((s) => s.value),
              borderColor: COLORS.blue,
              backgroundColor: "rgba(58,123,213,0.12)",
              fill: true,
              tension: 0.3,
              borderWidth: 2,
              pointRadius: 3,
            },
          ],
        },
        options: baseOptions(),
      });
    },

    donut(id, segments) {
      if (!ready()) return;
      destroy(id);
      const c = ctx(id);
      if (!c) return;
      const filtered = segments.filter((s) => s.value > 0);
      registry[id] = new window.Chart(c, {
        type: "doughnut",
        data: {
          labels: filtered.map((s) => s.label),
          datasets: [
            {
              data: filtered.map((s) => s.value),
              backgroundColor: filtered.map((s) => s.color),
              borderWidth: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: "62%",
          plugins: {
            legend: { position: "right", labels: { color: COLORS.text, boxWidth: 12, padding: 10 } },
            tooltip: { callbacks: { label: (c) => " " + c.label + ": " + App.util.money(c.parsed) } },
          },
        },
      });
    },

    COLORS,
  };

  App.charts = charts;
})();
