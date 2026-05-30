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

        <div class="card">
          <h3>Cash Flow Breakdown <span class="pill">auto</span></h3>
          ${m.annualRent || m.annualExpenses || m.annualDebtService ? `
          <div class="cf">
            <div class="cf__row"><span>Gross Rent</span><b>${money(m.annualRent)}<small>/yr</small></b></div>
            <div class="cf__row"><span>− Operating Expenses</span><b class="neg">${money(m.annualExpenses)}<small>/yr</small></b></div>
            <div class="cf__row cf__row--sub"><span>= Net Operating Income (NOI)</span><b>${money(m.annualNOI)}<small>/yr</small></b></div>
            <div class="cf__row"><span>− Mortgage Payments (P&I)</span><b class="neg">${money(m.annualDebtService)}<small>/yr</small></b></div>
            <div class="cf__row cf__row--total"><span>= Annual Cash Flow <em>(net profit)</em></span><b class="${signClass(m.annualCashFlow)}">${money(m.annualCashFlow)}<small>/yr</small></b></div>
          </div>
          <p class="muted small cf__foot">≈ ${money(m.monthlyCashFlow)}/mo · Cash-on-cash ${pct(m.cashOnCash)} on ${money(m.cashInvested)} invested · Return on equity ${pct(m.roe)} on ${money(m.equity)} equity</p>
          ` : `<p class="muted">Add monthly rent and operating expenses (via <a href="#" id="editIncomeLink">Edit</a>) to calculate cash flow, cash-on-cash, and ROE.</p>`}
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
            <h3>Expected vs Actual</h3>
            <button class="link-btn" id="addActualBtn">+ Add actual year</button>
          </div>
          ${this.expectedVsActual(p)}
        </div>
      `;

      // bindings
      const upd = () => this.openValueForm(p);
      App.util.$("#updateValueBtn", root).addEventListener("click", upd);
      const upd2 = App.util.$("#updateValueBtn2", root);
      if (upd2) upd2.addEventListener("click", upd);
      App.util.$("#editPropBtn", root).addEventListener("click", () => this.openEditForm(p));
      App.util.$("#addActualBtn", root).addEventListener("click", () => this.openActualForm(p, null));
      const addLoan = App.util.$("#addLoanLink", root);
      if (addLoan) addLoan.addEventListener("click", (e) => { e.preventDefault(); this.openEditForm(p); });
      const editIncome = App.util.$("#editIncomeLink", root);
      if (editIncome) editIncome.addEventListener("click", (e) => { e.preventDefault(); this.openEditForm(p); });

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

    expectedVsActual(p) {
      const actuals = (p.actuals || []).slice().sort((a, b) => num(a.year) - num(b.year));

      if (!actuals.length) {
        return ui.emptyState(
          "See how reality compares to expectations. Your expected returns are calculated from the inputs above; add a year's actual rent & expenses (from your P&L, tax return, Stessa, or QuickBooks) and we'll compute the actual cash flow, cash-on-cash, and ROE — and the variance."
        );
      }

      // Expected (pro-forma) column is calculated from the property inputs.
      const m = App.finance.propertyMetrics(p);
      const expected = {
        rent: m.annualRent,
        expenses: m.annualExpenses,
        cashFlow: m.annualCashFlow,
        cashOnCash: m.cashOnCash,
        roe: m.roe,
      };
      // Compute each actual year's metrics with the same formulas.
      const actualCalcs = actuals.map((a) => ({ a, calc: App.finance.actualMetrics(p, a) }));

      const cmpRow = (label, expVal, key, fmt) => {
        const cells = actualCalcs
          .map(({ calc }) => {
            const v = calc[key];
            let delta = "";
            if (num(expVal) && (v || v === 0)) {
              const d = ((num(v) - num(expVal)) / Math.abs(num(expVal))) * 100;
              delta = `<span class="delta ${signClass(d)}">${d >= 0 ? "+" : ""}${pct(d, 0)}</span>`;
            }
            return `<td class="num">${v || v === 0 ? fmt(v) : "—"} ${delta}</td>`;
          })
          .join("");
        return `<tr><th>${esc(label)}</th><td class="num proj">${num(expVal) || expVal === 0 ? fmt(expVal) : "—"}</td>${cells}</tr>`;
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
            <thead><tr><th></th><th class="num">Expected <span class="src">calculated</span></th>${yearHeaders}</tr></thead>
            <tbody>
              ${cmpRow("Annual Rent", expected.rent, "annualRent", (v) => money(v))}
              ${cmpRow("Annual Expenses", expected.expenses, "annualExpenses", (v) => money(v))}
              ${cmpRow("Annual Cash Flow", expected.cashFlow, "annualCashFlow", (v) => money(v))}
              ${cmpRow("Cash-on-Cash", expected.cashOnCash, "cashOnCash", (v) => pct(v))}
              ${cmpRow("Return on Equity", expected.roe, "roe", (v) => pct(v))}
            </tbody>
          </table>
        </div>
        <p class="muted small">"Expected" is calculated from your current inputs. Click a year to edit it. Deltas compare actual vs expected.</p>`;
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
          { name: "rent", label: "Actual Annual Rent", type: "money", hint: "Total rent actually collected that year" },
          { name: "expenses", label: "Actual Annual Operating Expenses", type: "money", hint: "Excludes the mortgage — we add debt service automatically" },
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
      const termYears = App.util.num(loan.termMonths) > 0 ? +(App.util.num(loan.termMonths) / 12).toFixed(2) : "";
      ui.openForm({
        title: "Edit Property",
        submitLabel: "Save changes",
        values: {
          name: p.name,
          type: p.type,
          purchaseDate: p.purchaseDate,
          purchasePrice: p.purchasePrice,
          currentValue: p.currentValue,
          downPayment: p.downPayment,
          rehabCosts: p.rehabCosts,
          estimatedRent: p.estimatedRent,
          monthlyExpenses: p.monthlyExpenses,
          originalBalance: loan.originalBalance,
          interestRate: loan.interestRate,
          termYears: termYears,
          loanStartDate: loan.startDate || p.purchaseDate,
          currentBalanceOverride: loan.currentBalanceOverride,
        },
        fields: [
          { name: "name", label: "Property Name", required: true, wide: true },
          { name: "type", label: "Property Type", type: "select", options: V.portfolio.PROPERTY_TYPES.map((t) => ({ value: t, label: t })) },
          { name: "purchaseDate", label: "Purchase Date", type: "date" },
          { name: "purchasePrice", label: "Purchase Price", type: "money" },
          { name: "currentValue", label: "Current Est. Value", type: "money", hint: "Or use 'Update Value' to log it with a date" },

          { name: "_incomeSep", label: "Income & expenses", type: "heading", hint: "Used to calculate cash flow (net profit)", wide: true },
          { name: "estimatedRent", label: "Monthly Rent", type: "money" },
          { name: "monthlyExpenses", label: "Monthly Operating Expenses", type: "money", hint: "Taxes, insurance, mgmt, maintenance — NOT the mortgage" },

          { name: "_cashSep", label: "Cash invested", type: "heading", hint: "Used to calculate cash-on-cash return", wide: true },
          { name: "downPayment", label: "Down Payment", type: "money" },
          { name: "rehabCosts", label: "Rehab + Closing Costs", type: "money" },

          { name: "_loanSep", label: "Loan", type: "heading", hint: "Drives the amortization schedule and mortgage payment", wide: true },
          { name: "originalBalance", label: "Original Loan Amount", type: "money", hint: "Usually purchase price − down payment" },
          { name: "interestRate", label: "Interest Rate", type: "percent" },
          { name: "termYears", label: "Loan Term (years)", type: "number", placeholder: "30" },
          { name: "loanStartDate", label: "Loan Start Date", type: "date" },
          { name: "currentBalanceOverride", label: "Pin Current Balance (optional)", type: "money", hint: "Advanced — only after a refinance or to override the calculated balance" },
        ],
        onSubmit: (v) => {
          const termMonths = App.util.num(v.termYears) > 0 ? Math.round(App.util.num(v.termYears) * 12) : "";
          Object.assign(p, {
            name: v.name,
            type: v.type,
            purchaseDate: v.purchaseDate,
            purchasePrice: v.purchasePrice,
            currentValue: v.currentValue || v.purchasePrice,
            downPayment: v.downPayment,
            rehabCosts: v.rehabCosts,
            estimatedRent: v.estimatedRent,
            monthlyExpenses: v.monthlyExpenses,
          });
          p.loan = {
            originalBalance: v.originalBalance,
            interestRate: v.interestRate,
            termMonths: termMonths,
            startDate: v.loanStartDate || v.purchaseDate,
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
