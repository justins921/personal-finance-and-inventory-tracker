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

## 🔒 Accounts, sync & your data

The app runs in one of two modes depending on whether a backend is configured:

- **Local mode (default, zero setup):** no account, no server — everything is
  stored in your browser (`localStorage`). Great for trying it instantly or
  running fully private/offline.
- **Cloud mode (logins + cross-device sync):** sign in with email + password
  and your data syncs to a database, so it follows you to any device. Powered
  by [Supabase](https://supabase.com) (free tier).

In both modes every value is **editable inline and saves automatically**, and
you can always **Settings → Export / Import** a `.json` backup. You own your data.

### Enabling logins & cross-device sync (≈5 minutes)

1. Create a free project at [supabase.com](https://supabase.com).
2. In the project's **SQL Editor**, paste and run
   [`supabase-setup.sql`](supabase-setup.sql). This creates a per-user table
   locked down with Row Level Security (each account can only touch its own data).
3. In **Project Settings → API**, copy the **Project URL** and the
   **anon / public** key.
4. Paste both into [`js/config.js`](js/config.js):
   ```js
   window.APP_CONFIG = {
     SUPABASE_URL: "https://YOUR-PROJECT.supabase.co",
     SUPABASE_ANON_KEY: "YOUR-ANON-PUBLIC-KEY",
     REQUIRE_LOGIN: false, // set true to require sign-in
   };
   ```
5. (Optional) For instant logins, turn **off** "Confirm email" under
   **Authentication → Providers → Email**. Leave it on to verify addresses.

That's it — deploy and your users can sign up and sync.

> **Is it safe to commit the anon key?** Yes. The anon/public key is *designed*
> to ship in client code; access is enforced server-side by Row Level Security
> (set up by the SQL above), so one account can never read another's data.

> Users who used the app in local mode before signing up have their existing
> local data automatically adopted into their new account on first login.

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

### Deploy live (free)

It's a static site, so any static host works. **Vercel** is the simplest:

1. Push this repo to GitHub.
2. Go to [vercel.com](https://vercel.com) → **Add New… → Project** → import the repo.
3. Framework preset: **Other**. Leave **Build Command** empty and **Output
   Directory** as `.` (the included [`vercel.json`](vercel.json) already sets
   this — no build step). Click **Deploy**.
4. You'll get a live `https://your-app.vercel.app` URL. Done.

> **Railway** also works but is meant for apps that run a server process; for a
> static site like this, Vercel / Netlify / Cloudflare Pages / GitHub Pages are
> the natural (and free) fit.

**If you enabled cloud sync (Supabase):** after deploying, add your live URL in
Supabase under **Authentication → URL Configuration** (Site URL + redirect
URLs) so login and email-confirmation links work on the deployed domain. Your
Supabase keys live in `js/config.js` and deploy with the site — the anon key is
public-safe (see the note above).

## 🧭 First run

On first load you'll be offered a **sample portfolio** so you can explore. Wipe
it anytime in **Settings → Erase all my data** and start entering your own.

## 🗂️ Project structure

```
index.html            # app shell + nav
supabase-setup.sql    # one-time DB + Row Level Security setup for cloud sync
css/styles.css        # styling
js/
  config.js           # deployment config (Supabase URL/key, or blank = local)
  util.js             # formatting, dates, DOM helpers
  finance.js          # calculation engine (amortization, ROE, CoC, net worth)
  charts.js           # Chart.js wrapper (degrades gracefully)
  store.js            # state + namespaced localStorage cache + remote-save hook
  demo.js             # sample portfolio
  ui.js               # reusable cards, modal forms, toasts
  auth.js             # Supabase email/password auth + login screen
  cloud.js            # cloud sync (pull on login, debounced push on change)
  app.js              # hash router + auth/sync bootstrap
  views/              # dashboard, statement, portfolio, property, trends, settings
```

## 🛠️ How the math works

The philosophy: enter the **minimum** inputs (rent, operating expenses, loan
terms, cash invested, value) and everything else is **calculated** — nothing is
hand-entered that the app can derive.

- **Amortization** uses the standard remaining-balance formula. Months elapsed
  are counted from the loan start date to today; the monthly P&I payment is
  computed from the loan amount, rate, and term.
- **Monthly P&I (debt service)** = computed from the amortization
- **NOI** (Net Operating Income) = (monthly rent − monthly operating expenses) × 12
- **Annual Cash Flow** (net profit) = NOI − annual debt service (P&I)
- **Equity** = estimated value − current loan balance
- **LTV** = loan balance ÷ value
- **Cash-on-Cash** = annual cash flow ÷ cash invested (down payment + rehab/closing)
- **ROE** = annual cash flow ÷ current equity
- **Expected vs Actual**: "Expected" is the pro-forma calculated from your
  inputs; log a year's actual rent & expenses and the app computes that year's
  actual cash flow / CoC / ROE the same way, then shows the variance.
- **Net worth** = total assets − total liabilities (real estate value & mortgage
  balances flow in automatically from the portfolio)

## 🔭 Roadmap (future ideas)

Refinance calculator · Sell-vs-hold · 1031 exchange analysis · retirement &
financial-freedom forecasting · market benchmarking · AI portfolio analysis ·
real-time multi-device sync (Supabase Realtime) · social / Google login.

## 📄 License

[MIT](LICENSE) — free to use, modify, and share.
