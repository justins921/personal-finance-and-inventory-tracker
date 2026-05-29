/* ============================================================================
 * views/trends.js — net worth, equity, debt and cash-flow trends over time.
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const { money, num, esc, signClass } = App.util;
  const ui = App.ui;

  function findByMonthsAgo(snaps, months) {
    if (!snaps.length) return null;
    const targetStr = App.util.toISODate(App.util.addMonths(new Date(), -months));
    let best = null;
    for (const s of snaps) if (s.date <= targetStr) best = s;
    return best;
  }

  V.trends = {
    render(root) {
      const data = App.store.data;
      const snaps = data.netWorthSnapshots.slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      const liveNw = App.finance.netWorth(data);
      const current = liveNw.netWorth;

      const oneYr = findByMonthsAgo(snaps, 12);
      const fiveYr = findByMonthsAgo(snaps, 60);
      const first = snaps[0];

      const delta = (then) => (then ? current - num(then.netWorth) : null);

      root.innerHTML = `
        <div class="view-head">
          <div>
            <h1>Net Worth & Performance Trends</h1>
            <p class="muted">Snapshots build your history. Capture one whenever your numbers change.</p>
          </div>
          <button class="btn btn--primary" id="capBtn">📸 Capture snapshot</button>
        </div>

        <div class="stat-grid">
          ${ui.statCard({ label: "Current Net Worth", value: money(current), big: false })}
          ${ui.statCard({ label: "1 Year Ago", value: oneYr ? money(oneYr.netWorth) : "—", sub: delta(oneYr) != null ? `<span class="${signClass(delta(oneYr))}">${delta(oneYr) >= 0 ? "+" : ""}${money(delta(oneYr))}</span>` : "" })}
          ${ui.statCard({ label: "5 Years Ago", value: fiveYr ? money(fiveYr.netWorth) : "—", sub: delta(fiveYr) != null ? `<span class="${signClass(delta(fiveYr))}">${delta(fiveYr) >= 0 ? "+" : ""}${money(delta(fiveYr))}</span>` : "" })}
          ${ui.statCard({ label: "Lifetime Growth", value: first ? money(current - num(first.netWorth)) : "—", tone: first ? signClass(current - num(first.netWorth)) : "" })}
        </div>

        ${snaps.length < 2 ? ui.emptyState(
          "Capture at least two snapshots over time to chart your progress. Tip: capture one now, then again next month.",
          `<button class="btn btn--primary" id="capBtn2">📸 Capture snapshot</button>`
        ) : `
        <div class="two-col">
          <div class="card">
            <h3>Net Worth</h3>
            <div class="chart-wrap"><canvas id="trNw"></canvas></div>
          </div>
          <div class="card">
            <h3>Assets · Liabilities · Equity</h3>
            <div class="chart-wrap"><canvas id="trAL"></canvas></div>
          </div>
        </div>
        <div class="card">
          <h3>Annual Cash Flow</h3>
          <div class="chart-wrap"><canvas id="trCF"></canvas></div>
        </div>`}

        ${ui.sectionTitle("Snapshot History")}
        ${this.snapshotTable(snaps)}
      `;

      const cap = () => {
        App.store.captureSnapshot();
        ui.toast("Snapshot saved.", "ok");
        App.router.refresh();
      };
      App.util.$("#capBtn", root).addEventListener("click", cap);
      const cap2 = App.util.$("#capBtn2", root);
      if (cap2) cap2.addEventListener("click", cap);

      App.util.$$("[data-delsnap]", root).forEach((btn) =>
        btn.addEventListener("click", () => {
          App.store.removeItem("netWorthSnapshots", btn.getAttribute("data-delsnap"));
          App.router.refresh();
        })
      );

      if (snaps.length >= 2) {
        App.charts.netWorthLine("trNw", snaps);
        App.charts.assetsLiabilitiesLine("trAL", snaps);
        App.charts.cashFlowLine("trCF", snaps);
      }
    },

    snapshotTable(snaps) {
      if (!snaps.length) return `<p class="muted">No snapshots yet.</p>`;
      const rows = snaps
        .slice()
        .reverse()
        .map(
          (s) => `<tr>
            <td>${App.util.niceDate(s.date)}</td>
            <td class="num"><strong>${money(s.netWorth)}</strong></td>
            <td class="num">${money(s.totalAssets)}</td>
            <td class="num">${money(s.totalLiabilities)}</td>
            <td class="num">${money(s.realEstateEquity)}</td>
            <td class="num">${money(s.cashFlowAnnual)}</td>
            <td class="num"><button class="icon-btn icon-btn--sm" data-delsnap="${esc(s.id)}" title="Delete">✕</button></td>
          </tr>`
        )
        .join("");
      return `<div class="table-wrap"><table class="data-table">
        <thead><tr><th>Date</th><th class="num">Net Worth</th><th class="num">Assets</th>
        <th class="num">Liabilities</th><th class="num">RE Equity</th><th class="num">Annual CF</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
    },
  };
})();
