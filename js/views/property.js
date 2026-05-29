/* ============================================================================
 * views/property.js — single property command center.
 * Live metrics, automatic amortization, value history, projected vs actual.
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const { money, pct, num, esc, signClass } = App.util;
  const ui = App.ui;

  V.property = {
    render(root, params) {
      const p = App.store.getProperty(params.id);
      if (!p) {
        root.innerHTML = `<div class="view-head"><h1>Property not found</h1></div>
          <p><a href="#/portfolio">← Back to portfolio</a></p>`;
        return;
      }
      const m = App.finance.propertyMetrics(p);
      const loan = m.loan;

      root.innerHTML = `
        <div class="breadcrumb"><a href="#/portfolio">Real Estate</a> › <span>${esc(p.name)}</span></div>
        <div class="view-head">
          <div>
            <h1>${esc(p.name)}</h1>
            <p class="muted">${esc(p.type || "Property")} · purchased ${App.util.niceDate(p.purchaseDate)} for ${money(p.purchasePrice)}</p>
          </div>
          <div class="head-actions">
            <button class="btn btn--ghost" id="updateValueBtn">Update Value</button>
            <button class="btn btn--ghost" id="editPropBtn">Edit</button>
          </div>
        </div>

        <div class="stat-grid">
          ${ui.statCard({ label: "Estimated Value", value: money(m.value) })}
          ${ui.statCard({ label: "Loan Balance", value: money(m.loanBalance), tone: "neg" })}
          ${ui.statCard({ label: "Equity", value: money(m.equity), tone: "pos", big: false })}
          ${ui.statCard({ label: "Monthly Cash Flow", value: money(m.monthlyCashFlow), tone: signClass(m.monthlyCashFlow) })}
          ${ui.statCard({ label: "Annual Cash Flow", value: money(m.annualCashFlow), tone: signClass(m.annualCashFlow) })}
          ${ui.statCard({ label: "Loan-to-Value", value: pct(m.ltv) })}
          ${ui.statCard({ label: "Cash-on-Cash", value: pct(m.cashOnCash) })}
          ${ui.statCard({ label: "Return on Equity", value: pct(m.roe) })}
        </div>

        <div class="two-col">
          <div class="card">
            <h3>Loan & Amortization <span class="pill">auto</span></h3>
            ${loan.original > 0 || m.loanBalance > 0 ? `
            <div class="kv">
              <div><span>Original Loan</span><b>${money(loan.original)}</b></div>
              <div><span>Interest Rate</span><b>${pct(loan.rate, 3)}</b></div>
              <div><span>Monthly Payment (P&I)</span><b>${money(loan.payment, { cents: true })}</b></div>
              <div><span>Current Balance</span><b>${money(loan.currentBalance)}</b></div>
              <div><span>Principal Paid</span><b class="pos">${money(loan.principalPaid)}</b></div>
              <div><span>Interest Paid</span><b class="neg">${money(loan.interestPaid)}</b></div>
              <div><span>Payments Made</span><b>${loan.paymentsMade} of ${loan.term}</b></div>
              <div><span>Payments Remaining</span><b>${loan.paymentsRemaining}</b></div>
              <div><span>Payoff Date</span><b>${loan.payoffDate ? App.util.niceDate(App.util.toISODate(loan.payoffDate)) : "—"}</b></div>
              ${loan.term ? `<div class="kv__full">
                <span>Loan paid off</span>
                <div class="progress"><div class="progress__bar" style="width:${App.util.clamp((loan.paymentsMade / loan.term) * 100, 0, 100).toFixed(1)}%"></div></div>
                <small>${pct((loan.paymentsMade / loan.term) * 100, 0)} of payments made</small>
              </div>` : ""}
            </div>` : `<p class="muted">No loan on this property (owned free & clear). <a href="#" id="addLoanLink">Add loan details</a></p>`}
          </div>

          <div class="card">
            <div class="card__head-row">
              <h3>Value History</h3>
              <button class="link-btn" id="updateValueBtn2">+ Update value</button>
            </div>
            <div class="chart-wrap"><canvas id="valChart"></canvas></div>
            ${this.valueHistoryTable(p)}
          </div>
        </div>

        <div class="card">
          <div class="card__head-row">
            <h3>Projected vs Actual Returns</h3>
            <div>
              <button class="link-btn" id="editProjectedBtn">Edit projections</button>
              <button class="link-btn" id="addActualBtn">+ Add actual year</button>
            </div>
          </div>
          ${this.projectedVsActual(p)}
        </div>
      `;

      // bindings
      const upd = () => this.openValueForm(p);
      App.util.$("#updateValueBtn", root).addEventListener("click", upd);
      const upd2 = App.util.$("#updateValueBtn2", root);
      if (upd2) upd2.addEventListener("click", upd);
      App.util.$("#editPropBtn", root).addEventListener("click", () => this.openEditForm(p));
      App.util.$("#editProjectedBtn", root).addEventListener("click", () => this.openProjectedForm(p));
      App.util.$("#addActualBtn", root).addEventListener("click", () => this.openActualForm(p, null));
      const addLoan = App.util.$("#addLoanLink", root);
      if (addLoan) addLoan.addEventListener("click", (e) => { e.preventDefault(); this.openEditForm(p); });

      App.util.$$("[data-actual]", root).forEach((row) => {
        row.addEventListener("click", () => {
          const year = row.getAttribute("data-actual");
          const a = (p.actuals || []).find((x) => String(x.year) === String(year));
          this.openActualForm(p, a);
        });
      });
      App.util.$$("[data-delval]", root).forEach((btn) => {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          const id = btn.getAttribute("data-delval");
          p.valueHistory = (p.valueHistory || []).filter((v) => v.id !== id);
          const last = p.valueHistory[p.valueHistory.length - 1];
          if (last) p.currentValue = last.value;
          App.store.commit();
          App.router.refresh();
        });
      });

      App.charts.valueHistoryLine("valChart", p.valueHistory || []);
    },

    valueHistoryTable(p) {
      const hist = (p.valueHistory || []).slice().sort((a, b) => (a.date > b.date ? -1 : 1));
      if (!hist.length) return `<p class="muted">No value updates recorded yet.</p>`;
      return `<table class="mini-table">
        <thead><tr><th>Date</th><th>Value</th><th>Method</th><th></th></tr></thead>
        <tbody>
        ${hist
          .map(
            (h) => `<tr>
              <td>${App.util.niceDate(h.date)}</td>
              <td class="num">${money(h.value)}</td>
              <td>${esc(h.method || "manual")}</td>
              <td class="num"><button class="icon-btn icon-btn--sm" data-delval="${esc(h.id)}" title="Remove">✕</button></td>
            </tr>`
          )
          .join("")}
        </tbody></table>`;
    },

    projectedVsActual(p) {
      const proj = p.projected || {};
      const actuals = (p.actuals || []).slice().sort((a, b) => num(a.year) - num(b.year));
      const hasProj = num(proj.rent) || num(proj.cashFlow) || num(proj.cashOnCash);

      if (!hasProj && !actuals.length) {
        return ui.emptyState(
          "Track how reality compares to your underwriting. Enter the returns you projected at purchase, then add actual results each year from your P&L, tax return, Stessa, or QuickBooks."
        );
      }

      const cmpRow = (label, projVal, fmt) => {
        const cells = actuals
          .map((a) => {
            const v = a[label.key];
            let delta = "";
            if (num(projVal) && (v || v === 0)) {
              const d = ((num(v) - num(projVal)) / num(projVal)) * 100;
              delta = `<span class="delta ${signClass(d)}">${d >= 0 ? "+" : ""}${pct(d, 0)}</span>`;
            }
            return `<td class="num">${v || v === 0 ? fmt(v) : "—"} ${delta}</td>`;
          })
          .join("");
        return `<tr><th>${esc(label.label)}</th><td class="num proj">${num(projVal) || projVal === 0 ? fmt(projVal) : "—"}</td>${cells}</tr>`;
      };

      const yearHeaders = actuals
        .map(
          (a) =>
            `<th class="num" data-actual="${esc(a.year)}" role="button" tabindex="0" title="Edit ${esc(a.year)}">${esc(a.year)} <span class="src">${esc(a.source || "")}</span></th>`
        )
        .join("");

      return `
        <div class="table-wrap">
          <table class="data-table pva">
            <thead><tr><th></th><th class="num">Projected</th>${yearHeaders}</tr></thead>
            <tbody>
              ${cmpRow({ label: "Annual Rent", key: "rent" }, proj.rent, (v) => money(v))}
              ${cmpRow({ label: "Annual Expenses", key: "expenses" }, proj.expenses, (v) => money(v))}
              ${cmpRow({ label: "Annual Cash Flow", key: "cashFlow" }, proj.cashFlow, (v) => money(v))}
              ${cmpRow({ label: "Cash-on-Cash", key: "cashOnCash" }, proj.cashOnCash, (v) => pct(v))}
            </tbody>
          </table>
        </div>
        <p class="muted small">Click a year column header to edit it. Deltas compare actual to projected.</p>`;
    },

    /* ---- forms ----------------------------------------------------------*/

    openValueForm(p) {
      ui.openForm({
        title: "Update Estimated Value",
        submitLabel: "Save value",
        values: { date: App.util.today(), value: p.currentValue, method: "manual" },
        fields: [
          { name: "value", label: "Estimated Market Value", type: "money", required: true },
          { name: "date", label: "As of Date", type: "date", required: true },
          {
            name: "method",
            label: "Method",
            type: "select",
            options: [
              { value: "manual", label: "Manual estimate" },
              { value: "comparable", label: "Comparable sales" },
              { value: "appraisal", label: "Appraisal" },
            ],
          },
        ],
        onSubmit: (v) => {
          App.store.addValueObservation(p.id, v.value, v.date, v.method);
          ui.toast("Value updated.", "ok");
          App.router.refresh();
        },
      });
    },

    openProjectedForm(p) {
      const proj = p.projected || {};
      ui.openForm({
        title: "Projected Returns (at purchase)",
        submitLabel: "Save projections",
        values: proj,
        fields: [
          { name: "rent", label: "Projected Annual Rent", type: "money" },
          { name: "expenses", label: "Projected Annual Expenses", type: "money" },
          { name: "cashFlow", label: "Projected Annual Cash Flow", type: "money" },
          { name: "cashOnCash", label: "Projected Cash-on-Cash", type: "percent" },
        ],
        onSubmit: (v) => {
          p.projected = v;
          App.store.commit();
          ui.toast("Projections saved.", "ok");
          App.router.refresh();
        },
      });
    },

    openActualForm(p, existing) {
      ui.openForm({
        title: existing ? `Actual Results · ${existing.year}` : "Add Actual Year",
        submitLabel: "Save",
        values: existing || { year: new Date().getFullYear() - 1 },
        fields: [
          { name: "year", label: "Year", type: "number", step: "1", required: true },
          { name: "source", label: "Source", type: "select", options: [
            { value: "Stessa", label: "Stessa" },
            { value: "QuickBooks", label: "QuickBooks" },
            { value: "Tax return", label: "Tax return / Schedule E" },
            { value: "Annual P&L", label: "Annual P&L" },
            { value: "Other", label: "Other" },
          ] },
          { name: "rent", label: "Actual Annual Rent", type: "money" },
          { name: "expenses", label: "Actual Annual Expenses", type: "money" },
          { name: "cashFlow", label: "Actual Annual Cash Flow", type: "money" },
          { name: "cashOnCash", label: "Actual Cash-on-Cash", type: "percent" },
        ],
        onSubmit: (v) => {
          App.store.addActual(p.id, v);
          ui.toast("Actuals saved.", "ok");
          App.router.refresh();
        },
        onDelete: existing
          ? () => {
              p.actuals = (p.actuals || []).filter((a) => a.id !== existing.id);
              App.store.commit();
              ui.toast("Deleted.");
              App.router.refresh();
            }
          : null,
      });
    },

    openEditForm(p) {
      const loan = p.loan || {};
      ui.openForm({
        title: "Edit Property",
        submitLabel: "Save changes",
        values: {
          name: p.name,
          type: p.type,
          purchaseDate: p.purchaseDate,
          purchasePrice: p.purchasePrice,
          downPayment: p.downPayment,
          rehabCosts: p.rehabCosts,
          estimatedRent: p.estimatedRent,
          monthlyExpenses: p.monthlyExpenses,
          expectedCashFlow: p.expectedCashFlow,
          originalBalance: loan.originalBalance,
          interestRate: loan.interestRate,
          termMonths: loan.termMonths,
          monthlyPayment: loan.monthlyPayment,
          startDate: loan.startDate || p.purchaseDate,
          currentBalanceOverride: loan.currentBalanceOverride,
        },
        fields: [
          { name: "name", label: "Property Name", required: true, wide: true },
          { name: "type", label: "Property Type", type: "select", options: V.portfolio.PROPERTY_TYPES.map((t) => ({ value: t, label: t })) },
          { name: "purchaseDate", label: "Purchase Date", type: "date" },
          { name: "purchasePrice", label: "Purchase Price", type: "money" },
          { name: "downPayment", label: "Down Payment", type: "money" },
          { name: "rehabCosts", label: "Rehab Costs", type: "money" },
          { name: "estimatedRent", label: "Monthly Rent", type: "money" },
          { name: "monthlyExpenses", label: "Monthly Operating Expenses", type: "money" },
          { name: "expectedCashFlow", label: "Expected Monthly Cash Flow", type: "money", hint: "Blank = auto-calc" },
          { name: "originalBalance", label: "Original Loan Amount", type: "money" },
          { name: "interestRate", label: "Interest Rate", type: "percent" },
          { name: "termMonths", label: "Loan Term (months)", type: "number" },
          { name: "monthlyPayment", label: "Monthly P&I Payment", type: "money", hint: "Blank = auto-calc" },
          { name: "startDate", label: "Loan Start Date", type: "date" },
          { name: "currentBalanceOverride", label: "Known Current Balance", type: "money", hint: "Optional — pins exact balance" },
        ],
        onSubmit: (v) => {
          Object.assign(p, {
            name: v.name,
            type: v.type,
            purchaseDate: v.purchaseDate,
            purchasePrice: v.purchasePrice,
            downPayment: v.downPayment,
            rehabCosts: v.rehabCosts,
            estimatedRent: v.estimatedRent,
            monthlyExpenses: v.monthlyExpenses,
            expectedCashFlow: v.expectedCashFlow,
          });
          p.loan = {
            originalBalance: v.originalBalance,
            interestRate: v.interestRate,
            termMonths: v.termMonths,
            monthlyPayment: v.monthlyPayment,
            startDate: v.startDate || v.purchaseDate,
            currentBalanceOverride: v.currentBalanceOverride,
          };
          App.store.commit();
          ui.toast("Property updated.", "ok");
          App.router.refresh();
        },
        onDelete: () => {
          App.store.removeItem("properties", p.id);
          ui.toast("Property deleted.");
          location.hash = "#/portfolio";
        },
      });
    },
  };
})();
