const { round2 } = require('./amortization');

// Sparquote = Netto / Einnahmen. Ohne Einnahmen in einem Monat gibt es keine
// sinnvolle Quote (null statt 0 oder unendlich). Die gleitenden 3-/6-Monats-
// Schnitte glätten einmalige Ausreißer (z. B. eine Jahressonderzahlung),
// ohne monatslose Werte künstlich als 0 mitzuzählen.
function computeSavingsRates(monthlyTotals) {
  const rates = monthlyTotals.map((t) => (t.income > 0 ? round2((t.net / t.income) * 100) : null));

  const rollingAvg = (windowSize) =>
    rates.map((_, i) => {
      const window = rates.slice(Math.max(0, i - windowSize + 1), i + 1).filter((r) => r != null);
      if (!window.length) return null;
      return round2(window.reduce((sum, r) => sum + r, 0) / window.length);
    });

  const rate3m = rollingAvg(3);
  const rate6m = rollingAvg(6);

  return monthlyTotals.map((t, i) => ({
    month: t.month,
    income: t.income,
    expense: t.expense,
    net: t.net,
    rate: rates[i],
    rate3m: rate3m[i],
    rate6m: rate6m[i],
  }));
}

module.exports = { computeSavingsRates };
