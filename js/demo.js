/* ============================================================================
 * demo.js — sample portfolio so first-time users can explore immediately.
 * Attaches to window.App.demoData
 * ==========================================================================*/
(function () {
  "use strict";
  const App = (window.App = window.App || {});
  const uid = App.util.uid;

  App.demoData = function demoData() {
    return {
      schemaVersion: 1,
      profile: { name: "Sample Investor", baseCurrency: "USD", created: "2019-01-01" },
      accounts: {
        cash: [{ id: uid(), name: "Wallet & cash on hand", balance: 4000 }],
        checking: [{ id: uid(), name: "Operating Checking", balance: 28500 }],
        savings: [{ id: uid(), name: "Emergency Reserve", balance: 65000 }],
        stocks: [{ id: uid(), name: "Brokerage", balance: 142000 }],
        retirement: [
          { id: uid(), name: "401(k)", balance: 215000 },
          { id: uid(), name: "Roth IRA", balance: 58000 },
        ],
        other: [{ id: uid(), name: "Crypto", balance: 12000 }],
      },
      properties: [
        {
          id: uid(),
          name: "123 Maple St — Duplex",
          type: "Multi-Family",
          purchaseDate: "2019-06-01",
          purchasePrice: 285000,
          downPayment: 57000,
          rehabCosts: 18000,
          estimatedRent: 2850,
          monthlyExpenses: 950,
          expectedCashFlow: 720,
          currentValue: 430000,
          loan: {
            originalBalance: 228000,
            interestRate: 4.25,
            termMonths: 360,
            startDate: "2019-06-01",
            monthlyPayment: 0,
          },
          projected: { rent: 2400, expenses: 850, cashFlow: 9000, cashOnCash: 12 },
          valueHistory: [
            { id: uid(), date: "2019-06-01", value: 285000, method: "purchase" },
            { id: uid(), date: "2022-01-01", value: 365000, method: "comparable" },
            { id: uid(), date: "2024-01-01", value: 405000, method: "appraisal" },
            { id: uid(), date: "2026-01-01", value: 430000, method: "manual" },
          ],
          actuals: [
            { id: uid(), year: 2023, rent: 31200, expenses: 12100, cashFlow: 7800, cashOnCash: 10.4, source: "Stessa" },
            { id: uid(), year: 2024, rent: 33600, expenses: 13400, cashFlow: 8400, cashOnCash: 11.2, source: "Tax return" },
          ],
        },
        {
          id: uid(),
          name: "88 Oak Ave — SFR",
          type: "Single-Family",
          purchaseDate: "2021-09-15",
          purchasePrice: 410000,
          downPayment: 102500,
          rehabCosts: 9000,
          estimatedRent: 3100,
          monthlyExpenses: 1100,
          expectedCashFlow: 250,
          currentValue: 495000,
          loan: {
            originalBalance: 307500,
            interestRate: 3.1,
            termMonths: 360,
            startDate: "2021-09-15",
            monthlyPayment: 0,
          },
          projected: { rent: 2900, expenses: 1000, cashFlow: 6000, cashOnCash: 5.4 },
          valueHistory: [
            { id: uid(), date: "2021-09-15", value: 410000, method: "purchase" },
            { id: uid(), date: "2024-01-01", value: 470000, method: "comparable" },
            { id: uid(), date: "2026-01-01", value: 495000, method: "manual" },
          ],
          actuals: [
            { id: uid(), year: 2024, rent: 36000, expenses: 14800, cashFlow: 2200, cashOnCash: 2.0, source: "QuickBooks" },
          ],
        },
        {
          id: uid(),
          name: "500 Pine Rd — Triplex",
          type: "Multi-Family",
          purchaseDate: "2017-03-01",
          purchasePrice: 320000,
          downPayment: 80000,
          rehabCosts: 45000,
          estimatedRent: 4200,
          monthlyExpenses: 1400,
          expectedCashFlow: 1100,
          currentValue: 610000,
          loan: {
            originalBalance: 240000,
            interestRate: 4.75,
            termMonths: 300,
            startDate: "2017-03-01",
            monthlyPayment: 0,
          },
          projected: { rent: 3600, expenses: 1300, cashFlow: 13200, cashOnCash: 10.6 },
          valueHistory: [
            { id: uid(), date: "2017-03-01", value: 320000, method: "purchase" },
            { id: uid(), date: "2021-01-01", value: 480000, method: "comparable" },
            { id: uid(), date: "2026-01-01", value: 610000, method: "appraisal" },
          ],
          actuals: [
            { id: uid(), year: 2024, rent: 49200, expenses: 17600, cashFlow: 13800, cashOnCash: 11.0, source: "Stessa" },
          ],
        },
      ],
      vehicles: [
        { id: uid(), name: "Suburban", value: 38000, loanBalance: 14500 },
        { id: uid(), name: "Porsche 911", value: 92000, loanBalance: 0 },
      ],
      businesses: [
        { id: uid(), name: "Property Management LLC", value: 120000, debt: 15000 },
        { id: uid(), name: "YouTube Channel", value: 45000, debt: 0 },
      ],
      liabilities: {
        personalLoans: [],
        businessLoans: [{ id: uid(), name: "Equipment Loan", balance: 8200 }],
        creditCards: [{ id: uid(), name: "Amex (statement balance)", balance: 3400 }],
        otherDebts: [],
      },
      netWorthSnapshots: [
        { id: uid(), date: "2021-01-01", netWorth: 612000, totalAssets: 1480000, totalLiabilities: 868000, realEstateEquity: 340000, portfolioValue: 1010000, portfolioDebt: 670000, cashFlowAnnual: 18000 },
        { id: uid(), date: "2022-01-01", netWorth: 742000, totalAssets: 1660000, totalLiabilities: 918000, realEstateEquity: 430000, portfolioValue: 1180000, portfolioDebt: 750000, cashFlowAnnual: 21000 },
        { id: uid(), date: "2023-01-01", netWorth: 868000, totalAssets: 1820000, totalLiabilities: 952000, realEstateEquity: 540000, portfolioValue: 1320000, portfolioDebt: 780000, cashFlowAnnual: 24000 },
        { id: uid(), date: "2024-01-01", netWorth: 1010000, totalAssets: 1990000, totalLiabilities: 980000, realEstateEquity: 660000, portfolioValue: 1450000, portfolioDebt: 790000, cashFlowAnnual: 26000 },
        { id: uid(), date: "2025-01-01", netWorth: 1145000, totalAssets: 2140000, totalLiabilities: 995000, realEstateEquity: 790000, portfolioValue: 1535000, portfolioDebt: 745000, cashFlowAnnual: 27000 },
      ],
      settings: { lastView: "dashboard" },
    };
  };
})();
