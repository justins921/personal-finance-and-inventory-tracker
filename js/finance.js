/* ============================================================================
 * finance.js — the calculation engine
 *
 * Pure functions: amortization, property metrics, and portfolio / net-worth
 * roll-ups. No DOM, no storage. Everything here is testable in isolation.
 * Attaches to window.App.finance
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const num = App.util.num;

  /* ---- Amortization -------------------------------------------------------*/

  /**
   * Standard fully-amortizing monthly payment.
   * P = principal, annualRate in percent (e.g. 6.5), n = number of payments.
   */
  function monthlyPayment(P, annualRate, n) {
    P = num(P);
    n = num(n);
    const r = num(annualRate) / 100 / 12;
    if (n <= 0) return 0;
    if (r === 0) return P / n;
    return (P * r) / (1 - Math.pow(1 + r, -n));
  }

  /**
   * Loan balance after `k` payments given an original principal, rate, and
   * scheduled payment. Uses the closed-form remaining-balance formula and
   * never returns a negative balance.
   */
  function balanceAfter(P, annualRate, payment, k) {
    P = num(P);
    k = Math.max(0, Math.floor(num(k)));
    const r = num(annualRate) / 100 / 12;
    payment = num(payment);
    if (k === 0) return P;
    let bal;
    if (r === 0) {
      bal = P - payment * k;
    } else {
      const growth = Math.pow(1 + r, k);
      bal = P * growth - payment * ((growth - 1) / r);
    }
    return Math.max(0, bal);
  }

  /**
   * Compute the live state of a loan as of `asOf` (Date).
   *
   * loan = {
   *   originalBalance, interestRate, termMonths, monthlyPayment?,
   *   startDate (YYYY-MM-DD), currentBalanceOverride?
   * }
   *
   * Returns derived figures: current balance, principal/interest paid,
   * payments made/remaining, payoff date, etc.
   */
  function loanStatus(loan, asOf) {
    loan = loan || {};
    asOf = asOf || new Date();
    const original = num(loan.originalBalance);
    const rate = num(loan.interestRate);
    const term = Math.round(num(loan.termMonths));
    const start = App.util.parseDate(loan.startDate);

    const payment =
      num(loan.monthlyPayment) > 0
        ? num(loan.monthlyPayment)
        : monthlyPayment(original, rate, term);

    let paymentsMade = 0;
    if (start && term > 0) {
      paymentsMade = App.util.clamp(App.util.monthsBetween(start, asOf), 0, term);
    }

    // A user can pin an exact current balance (e.g. from a statement).
    const hasOverride =
      loan.currentBalanceOverride !== undefined &&
      loan.currentBalanceOverride !== null &&
      loan.currentBalanceOverride !== "";

    let currentBalance = hasOverride
      ? Math.max(0, num(loan.currentBalanceOverride))
      : balanceAfter(original, rate, payment, paymentsMade);

    const principalPaid = Math.max(0, original - currentBalance);
    const interestPaid = Math.max(0, payment * paymentsMade - principalPaid);
    const paymentsRemaining = Math.max(0, term - paymentsMade);

    let payoffDate = null;
    if (start && term > 0) {
      payoffDate = App.util.addMonths(start, term);
    }

    return {
      original,
      rate,
      term,
      payment,
      paymentsMade,
      paymentsRemaining,
      currentBalance,
      principalPaid,
      interestPaid,
      payoffDate,
      paidOff: term > 0 && currentBalance <= 0.5,
    };
  }

  /* ---- Property metrics ---------------------------------------------------*/

  /**
   * Derived figures for a single property as of `asOf`.
   */
  function propertyMetrics(p, asOf) {
    p = p || {};
    asOf = asOf || new Date();

    const loan = loanStatus(p.loan || {}, asOf);
    const value = num(p.currentValue) || num(p.purchasePrice);
    const loanBalance = loan.currentBalance;
    const equity = value - loanBalance;

    // Monthly cash flow: prefer an explicit figure, else rent minus payment
    // minus monthly operating expenses.
    let monthlyCashFlow;
    if (p.expectedCashFlow !== undefined && p.expectedCashFlow !== null && p.expectedCashFlow !== "") {
      monthlyCashFlow = num(p.expectedCashFlow);
    } else {
      monthlyCashFlow = num(p.estimatedRent) - loan.payment - num(p.monthlyExpenses);
    }
    const annualCashFlow = monthlyCashFlow * 12;

    const cashInvested = num(p.downPayment) + num(p.rehabCosts);
    const ltv = value > 0 ? (loanBalance / value) * 100 : 0;
    const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;
    const roe = equity > 0 ? (annualCashFlow / equity) * 100 : 0;

    // Appreciation since purchase.
    const purchase = num(p.purchasePrice);
    const appreciation = value - purchase;
    const appreciationPct = purchase > 0 ? (appreciation / purchase) * 100 : 0;

    return {
      value,
      loanBalance,
      equity,
      monthlyCashFlow,
      annualCashFlow,
      cashInvested,
      ltv,
      cashOnCash,
      roe,
      appreciation,
      appreciationPct,
      loan,
    };
  }

  /* ---- Portfolio roll-up --------------------------------------------------*/

  function portfolioSummary(properties, asOf) {
    properties = properties || [];
    let value = 0,
      debt = 0,
      equity = 0,
      monthlyCashFlow = 0,
      cashInvested = 0;

    const enriched = properties.map((p) => {
      const m = propertyMetrics(p, asOf);
      value += m.value;
      debt += m.loanBalance;
      equity += m.equity;
      monthlyCashFlow += m.monthlyCashFlow;
      cashInvested += m.cashInvested;
      return { property: p, metrics: m };
    });

    const annualCashFlow = monthlyCashFlow * 12;
    const ltv = value > 0 ? (debt / value) * 100 : 0;
    const roe = equity > 0 ? (annualCashFlow / equity) * 100 : 0;
    const cashOnCash = cashInvested > 0 ? (annualCashFlow / cashInvested) * 100 : 0;

    return {
      count: properties.length,
      value,
      debt,
      equity,
      monthlyCashFlow,
      annualCashFlow,
      cashInvested,
      ltv,
      roe,
      cashOnCash,
      properties: enriched,
    };
  }

  /* ---- Net worth ----------------------------------------------------------*/

  /**
   * Compute total assets, total liabilities and net worth from the full data
   * object, as of `asOf`. Returns a breakdown by category for the statement.
   */
  function netWorth(data, asOf) {
    data = data || {};
    asOf = asOf || new Date();
    const sumBalances = (arr, key) =>
      (arr || []).reduce((s, x) => s + num(x[key]), 0);

    const a = data.accounts || {};
    const cash = sumBalances(a.cash, "balance");
    const checking = sumBalances(a.checking, "balance");
    const savings = sumBalances(a.savings, "balance");
    const stocks = sumBalances(a.stocks, "balance");
    const retirement = sumBalances(a.retirement, "balance");
    const otherAssets = sumBalances(a.other, "balance");

    const port = portfolioSummary(data.properties, asOf);
    const realEstateValue = port.value;
    const mortgageDebt = port.debt;

    const vehicles = data.vehicles || [];
    const vehicleValue = sumBalances(vehicles, "value");
    const vehicleLoans = sumBalances(vehicles, "loanBalance");

    const businesses = data.businesses || [];
    const businessValue = sumBalances(businesses, "value");
    const businessDebtFromAssets = sumBalances(businesses, "debt");

    const l = data.liabilities || {};
    const personalLoans = sumBalances(l.personalLoans, "balance");
    const businessLoans = sumBalances(l.businessLoans, "balance");
    const creditCards = sumBalances(l.creditCards, "balance");
    const otherDebts = sumBalances(l.otherDebts, "balance");

    const assets = {
      cash,
      checking,
      savings,
      stocks,
      retirement,
      realEstate: realEstateValue,
      vehicles: vehicleValue,
      businesses: businessValue,
      other: otherAssets,
    };
    const liabilities = {
      mortgages: mortgageDebt,
      vehicleLoans,
      personalLoans,
      businessLoans,
      creditCards,
      otherDebts,
      businessDebt: businessDebtFromAssets,
    };

    const totalAssets = Object.values(assets).reduce((s, v) => s + v, 0);
    const totalLiabilities = Object.values(liabilities).reduce((s, v) => s + v, 0);

    return {
      assets,
      liabilities,
      totalAssets,
      totalLiabilities,
      netWorth: totalAssets - totalLiabilities,
      realEstateEquity: port.equity,
      portfolio: port,
      // convenience groupings
      cashTotal: cash + checking + savings,
      investmentsTotal: stocks + retirement,
    };
  }

  App.finance = {
    monthlyPayment,
    balanceAfter,
    loanStatus,
    propertyMetrics,
    portfolioSummary,
    netWorth,
  };
})();
