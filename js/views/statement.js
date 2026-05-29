/* ============================================================================
 * views/statement.js — the Personal Financial Statement.
 * Every line item is add / edit / delete-able; totals update instantly.
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const V = (App.views = App.views || {});
  const { money, num, esc } = App.util;
  const ui = App.ui;

  // Asset categories backed by simple {name, balance} lists.
  const ASSET_CATS = [
    { path: "accounts.cash", label: "Cash" },
    { path: "accounts.checking", label: "Checking Accounts" },
    { path: "accounts.savings", label: "Savings Accounts" },
    { path: "accounts.stocks", label: "Stock / Brokerage Accounts" },
    { path: "accounts.retirement", label: "Retirement Accounts" },
    { path: "accounts.other", label: "Other Assets" },
  ];

  const LIABILITY_CATS = [
    { path: "liabilities.personalLoans", label: "Personal Loans" },
    { path: "liabilities.businessLoans", label: "Business Loans" },
    { path: "liabilities.creditCards", label: "Credit Cards" },
    { path: "liabilities.otherDebts", label: "Other Debts" },
  ];

  function sumList(path, key) {
    return App.store.collection(path).reduce((s, x) => s + num(x[key]), 0);
  }

  // Render a simple {name, balance} category card.
  function simpleCard(cat, valueKey) {
    valueKey = valueKey || "balance";
    const items = App.store.collection(cat.path);
    const total = items.reduce((s, x) => s + num(x[valueKey]), 0);
    const rows = items.length
      ? items
          .map(
            (it) => `
        <div class="line" data-edit="${esc(cat.path)}" data-id="${esc(it.id)}" role="button" tabindex="0">
          <span class="line__name">${esc(it.name || "Untitled")}</span>
          <span class="line__val">${money(it[valueKey])}</span>
        </div>`
          )
          .join("")
      : `<div class="line line--empty">No items yet</div>`;
    return `
      <div class="cat-card">
        <div class="cat-card__head">
          <h4>${esc(cat.label)}</h4>
          <span class="cat-card__total">${money(total)}</span>
        </div>
        <div class="cat-card__rows">${rows}</div>
        <button class="link-btn" data-add="${esc(cat.path)}" data-label="${esc(cat.label)}" data-valkey="${valueKey}">+ Add</button>
      </div>`;
  }

  V.statement = {
    render(root) {
      const data = App.store.data;
      const nw = App.finance.netWorth(data);

      const realEstateValue = nw.portfolio.value;
      const vehicleVal = sumList("vehicles", "value");
      const businessVal = sumList("businesses", "value");

      root.innerHTML = `
        <div class="view-head">
          <div>
            <h1>Personal Financial Statement</h1>
            <p class="muted">A live balance sheet of everything you own and owe.</p>
          </div>
        </div>

        <div class="pfs-summary">
          <div class="pfs-summary__item">
            <span>Total Assets</span><strong class="pos">${money(nw.totalAssets)}</strong>
          </div>
          <div class="pfs-summary__op">−</div>
          <div class="pfs-summary__item">
            <span>Total Liabilities</span><strong class="neg">${money(nw.totalLiabilities)}</strong>
          </div>
          <div class="pfs-summary__op">=</div>
          <div class="pfs-summary__item pfs-summary__item--nw">
            <span>Net Worth</span><strong>${money(nw.netWorth)}</strong>
          </div>
        </div>

        <div class="pfs-columns">
          <div class="pfs-col">
            <h2 class="pfs-col__title pfs-col__title--assets">Assets · ${money(nw.totalAssets)}</h2>
            ${ASSET_CATS.map((c) => simpleCard(c)).join("")}

            <div class="cat-card cat-card--readonly">
              <div class="cat-card__head">
                <h4>Real Estate <span class="pill">auto</span></h4>
                <span class="cat-card__total">${money(realEstateValue)}</span>
              </div>
              <p class="cat-card__note">Managed in the <a href="#/portfolio">Real Estate</a> tab.</p>
            </div>

            <div class="cat-card">
              <div class="cat-card__head">
                <h4>Vehicles</h4>
                <span class="cat-card__total">${money(vehicleVal)}</span>
              </div>
              <div class="cat-card__rows">
                ${this.assetRowsWithLoan("vehicles", data.vehicles)}
              </div>
              <button class="link-btn" data-add-vehicle>+ Add vehicle</button>
            </div>

            <div class="cat-card">
              <div class="cat-card__head">
                <h4>Businesses</h4>
                <span class="cat-card__total">${money(businessVal)}</span>
              </div>
              <div class="cat-card__rows">
                ${this.assetRowsWithLoan("businesses", data.businesses, "debt")}
              </div>
              <button class="link-btn" data-add-business>+ Add business</button>
            </div>
          </div>

          <div class="pfs-col">
            <h2 class="pfs-col__title pfs-col__title--liab">Liabilities · ${money(nw.totalLiabilities)}</h2>

            <div class="cat-card cat-card--readonly">
              <div class="cat-card__head">
                <h4>Mortgages <span class="pill">auto</span></h4>
                <span class="cat-card__total">${money(nw.liabilities.mortgages)}</span>
              </div>
              <p class="cat-card__note">Auto-calculated from your loan amortization in the <a href="#/portfolio">Real Estate</a> tab.</p>
            </div>

            <div class="cat-card cat-card--readonly">
              <div class="cat-card__head">
                <h4>Vehicle Loans <span class="pill">auto</span></h4>
                <span class="cat-card__total">${money(nw.liabilities.vehicleLoans)}</span>
              </div>
              <p class="cat-card__note">Edited alongside each vehicle.</p>
            </div>

            ${LIABILITY_CATS.map((c) => simpleCard(c)).join("")}

            <div class="cat-card cat-card--readonly">
              <div class="cat-card__head">
                <h4>Business Debt <span class="pill">auto</span></h4>
                <span class="cat-card__total">${money(nw.liabilities.businessDebt)}</span>
              </div>
              <p class="cat-card__note">Edited alongside each business.</p>
            </div>
          </div>

          <div class="pfs-col pfs-col--chart">
            <div class="card">
              <h3>Asset Allocation</h3>
              <div class="chart-wrap chart-wrap--donut"><canvas id="allocChart"></canvas></div>
            </div>
          </div>
        </div>
      `;

      this.bind(root);

      const a = nw.assets;
      const C = App.charts.COLORS;
      App.charts.donut("allocChart", [
        { label: "Cash & Savings", value: nw.cashTotal, color: C.green },
        { label: "Stocks/Retirement", value: nw.investmentsTotal, color: C.blue },
        { label: "Real Estate", value: a.realEstate, color: C.amber },
        { label: "Vehicles", value: a.vehicles, color: "#9b7bd6" },
        { label: "Businesses", value: a.businesses, color: "#5fb0c9" },
        { label: "Other", value: a.other, color: "#c9956a" },
      ]);
    },

    assetRowsWithLoan(path, items, loanKey) {
      loanKey = loanKey || "loanBalance";
      if (!items.length) return `<div class="line line--empty">No items yet</div>`;
      return items
        .map((it) => {
          const equity = num(it.value) - num(it[loanKey]);
          return `<div class="line line--two" data-edit-asset="${esc(path)}" data-id="${esc(it.id)}" role="button" tabindex="0">
            <span class="line__name">${esc(it.name || "Untitled")}</span>
            <span class="line__meta">${money(it.value)} value · ${money(it[loanKey])} debt</span>
            <span class="line__val">${money(equity)} equity</span>
          </div>`;
        })
        .join("");
    },

    bind(root) {
      // simple add
      App.util.$$("[data-add]", root).forEach((btn) => {
        btn.addEventListener("click", () => {
          const path = btn.getAttribute("data-add");
          const label = btn.getAttribute("data-label");
          const valKey = btn.getAttribute("data-valkey") || "balance";
          this.openSimpleForm(path, label, valKey, null);
        });
      });

      // simple edit (click row)
      App.util.$$("[data-edit]", root).forEach((row) => {
        const open = () => {
          const path = row.getAttribute("data-edit");
          const id = row.getAttribute("data-id");
          const item = App.store.collection(path).find((x) => x.id === id);
          const cat = [...ASSET_CATS, ...LIABILITY_CATS].find((c) => c.path === path);
          this.openSimpleForm(path, cat ? cat.label : "Item", "balance", item);
        };
        row.addEventListener("click", open);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter") open();
        });
      });

      // vehicles / businesses
      const addV = App.util.$("[data-add-vehicle]", root);
      if (addV) addV.addEventListener("click", () => this.openAssetForm("vehicles", null));
      const addB = App.util.$("[data-add-business]", root);
      if (addB) addB.addEventListener("click", () => this.openAssetForm("businesses", null));

      App.util.$$("[data-edit-asset]", root).forEach((row) => {
        const open = () => {
          const path = row.getAttribute("data-edit-asset");
          const id = row.getAttribute("data-id");
          const item = App.store.collection(path).find((x) => x.id === id);
          this.openAssetForm(path, item);
        };
        row.addEventListener("click", open);
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter") open();
        });
      });
    },

    openSimpleForm(path, label, valKey, existing) {
      ui.openForm({
        title: (existing ? "Edit " : "Add ") + label,
        submitLabel: existing ? "Save" : "Add",
        values: existing || {},
        fields: [
          { name: "name", label: "Name / Description", required: true, placeholder: "e.g. Chase Checking" },
          { name: valKey, label: "Balance", type: "money", required: true },
        ],
        onSubmit: (vals) => {
          if (existing) App.store.updateItem(path, existing.id, vals);
          else App.store.addItem(path, vals);
          ui.toast("Saved.", "ok");
          App.router.refresh();
        },
        onDelete: existing
          ? () => {
              App.store.removeItem(path, existing.id);
              ui.toast("Deleted.");
              App.router.refresh();
            }
          : null,
      });
    },

    openAssetForm(path, existing) {
      const isVehicle = path === "vehicles";
      const loanKey = isVehicle ? "loanBalance" : "debt";
      ui.openForm({
        title: (existing ? "Edit " : "Add ") + (isVehicle ? "Vehicle" : "Business"),
        submitLabel: existing ? "Save" : "Add",
        values: existing || {},
        fields: [
          { name: "name", label: "Name", required: true, placeholder: isVehicle ? "e.g. Suburban" : "e.g. Rental LLC" },
          { name: "value", label: isVehicle ? "Estimated Value" : "Estimated Business Value", type: "money", required: true },
          { name: loanKey, label: isVehicle ? "Loan Balance" : "Business Debt", type: "money" },
        ],
        onSubmit: (vals) => {
          if (existing) App.store.updateItem(path, existing.id, vals);
          else App.store.addItem(path, vals);
          ui.toast("Saved.", "ok");
          App.router.refresh();
        },
        onDelete: existing
          ? () => {
              App.store.removeItem(path, existing.id);
              ui.toast("Deleted.");
              App.router.refresh();
            }
          : null,
      });
    },
  };
})();
