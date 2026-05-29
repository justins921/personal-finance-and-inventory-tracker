# 📊 Financial Command Center

**A free Personal Financial Statement & Real Estate Portfolio tracker.**

Give yourself a real-time view of your **net worth, equity, debt, cash flow, and
portfolio performance** — while loan paydown is tracked automatically. No more
rebuilding amortization schedules or personal financial statements by hand.

> This is **not** accounting software and **not** property-management software.
> It's a personal financial *command center* for investors.

---

## ✨ What it does

- **Personal Financial Statement** — every asset and liability in one live
  balance sheet (cash, checking, savings, stocks, retirement, real estate,
  vehicles, businesses, mortgages, loans, credit cards). Totals and net worth
  update instantly.
- **Real Estate Portfolio dashboard** — total value, debt, equity, cash flow,
  portfolio LTV and ROE. Your real estate scoreboard.
- **Automatic amortization** — enter a loan once; the app computes current
  balance, principal/interest paid, remaining payments, and payoff date as of
  today. (You can also pin an exact balance from a statement.)
- **Per-property metrics** — equity, monthly/annual cash flow, LTV,
  cash-on-cash, and return on equity.
- **Property value history** — log manual estimates, comparable sales, or
  appraisals over time and see the trend.
- **Projected vs. Actual** — record what you underwrote at purchase, then add
  actual results each year (from Stessa, QuickBooks, a P&L, or your tax return)
  and see the variance. Become a better underwriter.
- **Portfolio rankings & alerts** — surface your best and worst performers and
  flag trapped equity or declining ROE.
- **Net worth tracking over time** — capture dated snapshots and watch net
  worth, assets, liabilities, equity, and cash flow trend across the years.

## 🔒 Your data, your device

There is **no account and no server**. Everything you enter is stored locally
in your browser (`localStorage`), so it's there when you come back.

**To update your numbers:** just open the app and edit them — every value is
editable inline and saves automatically.

**To back up or move to another device:** go to **Settings → Export** to
download a `.json` backup, and **Import** it anywhere. You own your data.

## 🚀 Use it

**Option A — just open it.** Download/clone this repo and open `index.html` in
any modern browser. That's it.

**Option B — host it free.** It's a static site, so it runs for free on
GitHub Pages, Netlify, Cloudflare Pages, etc.

To publish with **GitHub Pages**: push to GitHub → repo **Settings → Pages** →
deploy from your branch's root. Your tracker will be live at
`https://<user>.github.io/<repo>/`.

> Charts use [Chart.js](https://www.chartjs.org/) via CDN. The app still works
> fully offline; only the charts need a connection to render.

## 🧭 First run

On first load you'll be offered a **sample portfolio** so you can explore. Wipe
it anytime in **Settings → Erase all my data** and start entering your own.

## 🗂️ Project structure

```
index.html            # app shell + nav
css/styles.css        # styling
js/
  util.js             # formatting, dates, DOM helpers
  finance.js          # calculation engine (amortization, ROE, CoC, net worth)
  charts.js           # Chart.js wrapper (degrades gracefully)
  store.js            # state + localStorage persistence + import/export
  demo.js             # sample portfolio
  ui.js               # reusable cards, modal forms, toasts
  app.js              # hash router + bootstrap
  views/              # dashboard, statement, portfolio, property, trends, settings
```

## 🛠️ How the math works

- **Amortization** uses the standard remaining-balance formula. Months elapsed
  are counted from the loan start date to today; payment is computed if you
  don't supply one.
- **Equity** = estimated value − current loan balance
- **LTV** = loan balance ÷ value
- **Cash-on-Cash** = annual cash flow ÷ (down payment + rehab)
- **ROE** = annual cash flow ÷ current equity
- **Net worth** = total assets − total liabilities (real estate value & mortgage
  balances flow in automatically from the portfolio)

## 🔭 Roadmap (future ideas)

Refinance calculator · Sell-vs-hold · 1031 exchange analysis · retirement &
financial-freedom forecasting · market benchmarking · AI portfolio analysis ·
optional cloud sync for multi-device access.

## 📄 License

[MIT](LICENSE) — free to use, modify, and share.
