const { normalizeCounterparty } = require('../rules/categorize');

// Gruppiert Ausgaben nach normalisiertem Empfänger + exaktem Betrag und
// erkennt monatlich wiederkehrende Zahlungen (Abos, Daueraufträge) am
// Abstand zwischen aufeinanderfolgenden Buchungen. minDays/maxDays
// toleriert Kalender-Jitter (Wochenenden, unterschiedlich lange Monate); nur
// die Hälfte der Abstände muss "monatlich" sein, damit ein paar verpasste
// oder verschobene Zahlungen den Abo-Charakter nicht sofort zunichtemachen.
// Preisänderungen (z. B. Abo-Erhöhung) reißen eine Gruppe bewusst
// auseinander — das ist eine bekannte Grenze dieser einfachen Heuristik.
function findRecurringPayments(txs, { minOccurrences = 3, minDays = 25, maxDays = 35 } = {}) {
  const groups = new Map();
  for (const t of txs) {
    if (t.amount >= 0) continue;
    const key = `${normalizeCounterparty(t.counterparty)}|${t.amount}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  }

  const result = [];
  for (const groupTxs of groups.values()) {
    if (groupTxs.length < minOccurrences) continue;
    const sorted = [...groupTxs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const gaps = [];
    for (let i = 1; i < sorted.length; i++) {
      gaps.push((new Date(sorted[i].date) - new Date(sorted[i - 1].date)) / 86400000);
    }
    const regularGaps = gaps.filter((g) => g >= minDays && g <= maxDays);
    if (regularGaps.length === 0 || regularGaps.length < gaps.length / 2) continue;

    const avgRegularGap = regularGaps.reduce((sum, g) => sum + g, 0) / regularGaps.length;
    const last = sorted[sorted.length - 1];
    result.push({
      counterparty: last.counterparty,
      amount: last.amount,
      occurrences: sorted.length,
      firstDate: sorted[0].date,
      lastDate: last.date,
      avgIntervalDays: Math.round(avgRegularGap),
      category_id: last.category_id ?? null,
    });
  }
  return result.sort((a, b) => a.amount - b.amount);
}

module.exports = { findRecurringPayments };
