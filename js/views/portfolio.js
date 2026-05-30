/* ============================================================================
 * views/portfolio.js — the real estate scoreboard: overview, rankings, list.
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const { money, pct, esc } = App.util;
  const ui = App.ui;

  const PROPERTY_TYPES = [
    "Single-Family",
    "Multi-Family",
    "Condo / Townhome",
    "Short-Term Rental",
    "Commercial",
    "Land",
    "Other",
  ];

  V.portfolio = {
    render(root) {
      const data = App.store.data;
      const port = App.finance.portfolioSummary(data.properties);

      root.innerHTML = `
        <div class="view-head">
          <div>
            <h1>Real Estate Portfolio</h1>
            <p class="muted">Your real estate scoreboard.</p>
          </div>
          <button class="btn btn--primary" id="addPropBtn">+ Add Property</button>
        </div>

        <div class="stat-grid">
          ${ui.statCard({ label: "Total Properties", value: port.count })}
          ${ui.statCard({ label: "Total Value", value: money(port.value) })}
          ${ui.statCard({ label: "Total Loan Balances", value: money(port.debt), tone: "neg" })}
          ${ui.statCard({ label: "Total Equity", value: money(port.equity), tone: "pos" })}
          ${ui.statCard({ label: "Annual Cash Flow", value: money(port.annualCashFlow) })}
          ${ui.statCard({ label: "Portfolio LTV", value: pct(port.ltv) })}
          ${ui.statCard({ label: "Portfolio ROE", value: pct(port.roe) })}
          ${ui.statCard({ label: "Cash-on-Cash", value: pct(port.cashOnCash) })}
        </div>

        ${port.count ? this.rankings(port) : ""}

        ${ui.sectionTitle("Properties")}
        ${port.count ? this.propertyTable(port) : ui.emptyState(
          "No properties yet. Add your first property to start tracking equity, cash flow, and loan paydown automatically.",
          `<button class="btn btn--primary" id="emptyAddBtn">+ Add Property</button>`
        )}
      `;

      const addBtn = App.util.$("#addPropBtn", root);
      addBtn.addEventListener("click", () => this.openPropertyForm());
      const emptyBtn = App.util.$("#emptyAddBtn", root);
      if (emptyBtn) emptyBtn.addEventListener("click", () => this.openPropertyForm());

      App.util.$$("[data-prop]", root).forEach((row) => {
        row.addEventListener("click", () => {
          location.hash = "#/property/" + row.getAttribute("data-prop");
        });
      });
    },

    propertyTable(port) {
      const rows = port.properties
        .map(({ property, metrics }) => {
          return `
          <tr data-prop="${esc(property.id)}">
            <td>
              <div class="prop-name">${esc(property.name)}</div>
              <div class="prop-sub">${esc(property.type || "")}</div>
            </td>
            <td class="num">${money(metrics.value)}</td>
            <td class="num">${money(metrics.loanBalance)}</td>
            <td class="num">${money(metrics.equity)}</td>
            <td class="num">${money(metrics.annualCashFlow)}</td>
            <td class="num">${pct(metrics.ltv)}</td>
            <td class="num"><strong>${pct(metrics.roe)}</strong></td>
            <td class="num chev">›</td>
          </tr>`;
        })
        .join("");
      return `
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                <th>Property</th><th class="num">Value</th><th class="num">Loan</th>
                <th class="num">Equity</th><th class="num">Annual CF</th>
                <th class="num">LTV</th><th class="num">ROE</th><th></th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
    },

    rankings(port) {
      const props = port.properties;
      if (props.length < 2) return "";

      const byRoe = props.slice().sort((a, b) => b.metrics.roe - a.metrics.roe);
      const byCash = props.slice().sort((a, b) => b.metrics.annualCashFlow - a.metrics.annualCashFlow);
      const byEquity = props.slice().sort((a, b) => b.metrics.equity - a.metrics.equity);
      const byAppr = props.slice().sort((a, b) => b.metrics.appreciationPct - a.metrics.appreciationPct);

      const list = (arr, fmt) =>
        arr
          .slice(0, 3)
          .map(
            (x, i) =>
              `<li><span class="rank">${i + 1}</span>
                 <a href="#/property/${esc(x.property.id)}">${esc(x.property.name)}</a>
                 <span class="rank-val">${fmt(x.metrics)}</span></li>`
          )
          .join("");

      return `
        ${ui.sectionTitle("Portfolio Rankings")}
        <div class="rankings">
          <div class="rank-card"><h4>Highest ROE</h4><ol>${list(byRoe, (m) => pct(m.roe))}</ol></div>
          <div class="rank-card"><h4>Highest Cash Flow</h4><ol>${list(byCash, (m) => money(m.annualCashFlow))}</ol></div>
          <div class="rank-card"><h4>Most Equity</h4><ol>${list(byEquity, (m) => money(m.equity))}</ol></div>
          <div class="rank-card"><h4>Best Appreciation</h4><ol>${list(byAppr, (m) => pct(m.appreciationPct))}</ol></div>
        </div>`;
    },

    openPropertyForm() {
      ui.openForm({
        title: "Add Property",
        submitLabel: "Create property",
        values: { purchaseDate: App.util.today() },
        fields: [
          { name: "name", label: "Property Name", required: true, placeholder: "123 Maple St", wide: true },
          { name: "type", label: "Property Type", type: "select", options: PROPERTY_TYPES.map((t) => ({ value: t, label: t })) },
          { name: "purchaseDate", label: "Purchase Date", type: "date", required: true },
          { name: "purchasePrice", label: "Purchase Price", type: "money", required: true },
          { name: "currentValue", label: "Current Est. Value", type: "money", hint: "Leave blank to use purchase price" },

          { name: "_incomeSep", label: "Income & expenses", type: "heading", hint: "Used to calculate your monthly & annual cash flow (net profit)", wide: true },
          { name: "estimatedRent", label: "Monthly Rent", type: "money", hint: "Total gross rent collected per month" },
          { name: "monthlyExpenses", label: "Monthly Operating Expenses", type: "money", hint: "Taxes, insurance, mgmt, maintenance, etc. — NOT the mortgage" },

          { name: "_cashSep", label: "Cash invested", type: "heading", hint: "Used to calculate your cash-on-cash return", wide: true },
          { name: "downPayment", label: "Down Payment", type: "money" },
          { name: "rehabCosts", label: "Rehab + Closing Costs", type: "money" },

          { name: "_loanSep", label: "Loan", type: "heading", hint: "Used to build your amortization schedule and mortgage payment automatically", wide: true },
          { name: "originalBalance", label: "Original Loan Amount", type: "money", hint: "Usually purchase price − down payment" },
          { name: "interestRate", label: "Interest Rate", type: "percent" },
          { name: "termYears", label: "Loan Term (years)", type: "number", placeholder: "30", hint: "30-year loan = 30" },
          { name: "loanStartDate", label: "Loan Start Date", type: "date", hint: "Leave blank to use the purchase date" },
          { name: "currentBalanceOverride", label: "Pin Current Balance (optional)", type: "money", hint: "Advanced — only if you refinanced or want to override the calculated balance" },
        ],
        onSubmit: (v) => {
          const termMonths = App.util.num(v.termYears) > 0 ? Math.round(App.util.num(v.termYears) * 12) : "";
          const prop = {
            name: v.name,
            type: v.type,
            purchaseDate: v.purchaseDate,
            purchasePrice: v.purchasePrice,
            currentValue: v.currentValue || v.purchasePrice,
            downPayment: v.downPayment,
            rehabCosts: v.rehabCosts,
            estimatedRent: v.estimatedRent,
            monthlyExpenses: v.monthlyExpenses,
            loan: {
              originalBalance: v.originalBalance,
              interestRate: v.interestRate,
              termMonths: termMonths,
              startDate: v.loanStartDate || v.purchaseDate,
              currentBalanceOverride: v.currentBalanceOverride,
            },
            valueHistory: [],
            actuals: [],
          };
          if (App.util.num(prop.currentValue) > 0) {
            prop.valueHistory.push({
              id: App.util.uid(),
              date: v.purchaseDate,
              value: App.util.num(prop.purchasePrice),
              method: "purchase",
            });
          }
          const created = App.store.addProperty(prop);
          ui.toast("Property added.", "ok");
          location.hash = "#/property/" + created.id;
        },
      });
    },
  };

  V.portfolio.PROPERTY_TYPES = PROPERTY_TYPES;
})();
