/* ============================================================================
 * views/dashboard.js — the owner's command center landing page.
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const { money, pct, num, signClass } = App.util;
  const ui = App.ui;

  function growthFrom(snapshots, monthsAgo, current, key) {
    if (!snapshots.length) return null;
    const target = App.util.addMonths(new Date(), -monthsAgo);
    const targetStr = App.util.toISODate(target);
    // find the closest snapshot at or before target date
    let best = null;
    for (const s of snapshots) {
      if (s.date <= targetStr) best = s;
    }
    if (!best) best = snapshots[0];
    return current - num(best[key]);
  }

  V.dashboard = {
    render(root) {
      const data = App.store.data;
      const nw = App.finance.netWorth(data);
      const port = nw.portfolio;
      const snaps = data.netWorthSnapshots.slice();

      // Best / worst property by ROE
      const ranked = port.properties
        .slice()
        .sort((a, b) => b.metrics.roe - a.metrics.roe);
      const best = ranked[0];
      const worst = ranked[ranked.length - 1];

      const nwYear = growthFrom(snaps, 12, nw.netWorth, "netWorth");
      const eqYear = growthFrom(snaps, 12, nw.realEstateEquity, "realEstateEquity");
      const cfYear = growthFrom(snaps, 12, port.annualCashFlow, "cashFlowAnnual");

      const name = data.profile.name ? data.profile.name : "Investor";

      root.innerHTML = `
        <div class="view-head">
          <div>
            <h1>Welcome back, ${App.util.esc(name)}</h1>
            <p class="muted">Your financial command center · ${App.util.niceDate(App.util.today())}</p>
          </div>
          <button class="btn btn--primary" id="snapshotBtn">📸 Capture net worth snapshot</button>
        </div>

        <div class="hero-net-worth">
          <div class="hero-net-worth__label">Net Worth</div>
          <div class="hero-net-worth__value">${money(nw.netWorth)}</div>
          ${
            nwYear != null
              ? `<div class="hero-net-worth__delta ${signClass(nwYear)}">
                  ${nwYear >= 0 ? "▲" : "▼"} ${money(Math.abs(nwYear))} in the last 12 months
                 </div>`
              : `<div class="hero-net-worth__delta muted">Capture snapshots to track growth over time</div>`
          }
        </div>

        ${ui.sectionTitle("Financial Snapshot")}
        <div class="stat-grid">
          ${ui.statCard({ label: "Total Assets", value: money(nw.totalAssets), tone: "pos" })}
          ${ui.statCard({ label: "Total Liabilities", value: money(nw.totalLiabilities), tone: "neg" })}
          ${ui.statCard({ label: "Real Estate Equity", value: money(nw.realEstateEquity) })}
          ${ui.statCard({ label: "Cash & Savings", value: money(nw.cashTotal) })}
          ${ui.statCard({ label: "Stocks & Retirement", value: money(nw.investmentsTotal) })}
          ${ui.statCard({ label: "Business Equity", value: money(nw.assets.businesses - nw.liabilities.businessDebt) })}
        </div>

        ${ui.sectionTitle("Real Estate Snapshot")}
        <div class="stat-grid">
          ${ui.statCard({ label: "Portfolio Value", value: money(port.value) })}
          ${ui.statCard({ label: "Portfolio Debt", value: money(port.debt), tone: "neg" })}
          ${ui.statCard({ label: "Portfolio Equity", value: money(port.equity), tone: "pos" })}
          ${ui.statCard({ label: "Annual Cash Flow", value: money(port.annualCashFlow) })}
          ${ui.statCard({ label: "Portfolio ROE", value: pct(port.roe) })}
          ${ui.statCard({ label: "Portfolio LTV", value: pct(port.ltv) })}
        </div>

        ${ui.sectionTitle("Performance Snapshot")}
        <div class="stat-grid">
          ${ui.statCard({
            label: "Best Property (ROE)",
            value: best ? App.util.esc(best.property.name) : "—",
            sub: best ? pct(best.metrics.roe) + " return on equity" : "",
            tone: "pos",
          })}
          ${ui.statCard({
            label: "Needs Attention (lowest ROE)",
            value: worst && ranked.length > 1 ? App.util.esc(worst.property.name) : "—",
            sub: worst && ranked.length > 1 ? pct(worst.metrics.roe) + " return on equity" : "",
            tone: "warn",
          })}
          ${ui.statCard({
            label: "Net Worth Growth (1yr)",
            value: nwYear != null ? money(nwYear) : "—",
            tone: nwYear != null ? signClass(nwYear) : "",
          })}
          ${ui.statCard({
            label: "Equity Growth (1yr)",
            value: eqYear != null ? money(eqYear) : "—",
            tone: eqYear != null ? signClass(eqYear) : "",
          })}
          ${ui.statCard({
            label: "Cash Flow Growth (1yr)",
            value: cfYear != null ? money(cfYear) : "—",
            tone: cfYear != null ? signClass(cfYear) : "",
          })}
        </div>

        ${this.alerts(nw)}

        <div class="dash-chart card">
          <h3>Net Worth Over Time</h3>
          <div class="chart-wrap"><canvas id="dashNwChart"></canvas></div>
          ${snaps.length < 2 ? `<p class="muted center">Capture snapshots over time to build this chart.</p>` : ""}
        </div>
      `;

      App.util.$("#snapshotBtn", root).addEventListener("click", () => {
        App.store.captureSnapshot();
        ui.toast("Net worth snapshot saved.", "ok");
      });

      App.charts.netWorthLine("dashNwChart", snaps);
    },

    alerts(nw) {
      const alerts = [];
      const port = nw.portfolio;

      // trapped equity: large equity earning low ROE
      port.properties.forEach(({ property, metrics }) => {
        if (metrics.equity > 100000 && metrics.roe < 4 && metrics.roe >= 0) {
          alerts.push({
            tone: "warn",
            text: `${property.name} has ${money(metrics.equity)} in equity earning only ${pct(metrics.roe)} — possible trapped equity.`,
          });
        }
      });

      // outperformance vs projection (latest actual)
      port.properties.forEach(({ property }) => {
        const projCF = property.projected && num(property.projected.cashFlow);
        const actuals = property.actuals || [];
        if (projCF && actuals.length) {
          const latest = actuals[actuals.length - 1];
          const actCF = num(latest.cashFlow);
          if (projCF > 0) {
            const diff = ((actCF - projCF) / projCF) * 100;
            if (diff >= 15) {
              alerts.push({ tone: "ok", text: `${property.name} outperformed its projection by ${pct(diff, 0)} in ${latest.year}.` });
            } else if (diff <= -15) {
              alerts.push({ tone: "warn", text: `${property.name} underperformed its projection by ${pct(Math.abs(diff), 0)} in ${latest.year}.` });
            }
          }
        }
      });

      // portfolio ROE trend
      const snaps = App.store.data.netWorthSnapshots;
      if (snaps.length >= 2) {
        const first = snaps[0];
        const eqFirst = num(first.realEstateEquity);
        const cfFirst = num(first.cashFlowAnnual);
        const roeFirst = eqFirst > 0 ? (cfFirst / eqFirst) * 100 : 0;
        const roeNow = port.roe;
        if (roeFirst > 0 && roeNow < roeFirst - 1) {
          alerts.push({ tone: "warn", text: `Portfolio ROE has declined from ${pct(roeFirst)} to ${pct(roeNow)} as equity has grown.` });
        }
      }

      if (!alerts.length) return "";
      return `
        ${ui.sectionTitle("Alerts")}
        <div class="alerts">
          ${alerts
            .map(
              (a) => `<div class="alert alert--${a.tone}">
                <span class="alert__dot"></span>${App.util.esc(a.text)}
              </div>`
            )
            .join("")}
        </div>`;
    },
  };
})();
