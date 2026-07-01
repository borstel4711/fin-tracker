const { round2 } = require('./amortization');

// Erwartete restliche wiederkehrende Beträge im laufenden Monat: je Kategorie
// gilt der Ø vergangener Monate als Erwartung; was in diesem Monat bereits
// geflossen ist (MTD), wird angerechnet. Mehr als der Ø wird nie
// "zurückerwartet" — eine Kategorie, die ihren Schnitt schon überschritten
// hat, trägt schlicht 0 zum Rest bei.
// recurringCategories: [{ avg, mtd }] mit vorzeichenbehafteten Beträgen
// (avg > 0 = Einnahmen-Kategorie, avg < 0 = Ausgaben-Kategorie).
function computeExpectedRemaining(recurringCategories) {
  let income = 0;
  let expense = 0;
  for (const { avg, mtd } of recurringCategories) {
    if (avg > 0) income += Math.max(0, avg - Math.max(0, mtd));
    else if (avg < 0) expense += Math.max(0, -avg - Math.max(0, -mtd));
  }
  return { income: round2(income), expense: round2(expense) };
}

// Verfügbares Restbudget = Kontostand + noch erwartete wiederkehrende
// Einnahmen − noch erwartete wiederkehrende Ausgaben − Puffer. Ohne
// Start-Anker gibt es keinen Kontostand und damit kein Restbudget.
function computeRemainingBudget({ currentBalance, buffer, expectedRemainingIncome, expectedRemainingExpense }) {
  if (currentBalance == null) return null;
  return round2(currentBalance + expectedRemainingIncome - expectedRemainingExpense - buffer);
}

module.exports = { computeExpectedRemaining, computeRemainingBudget };
