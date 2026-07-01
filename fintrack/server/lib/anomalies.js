const { round2 } = require('./amortization');

// Buchungen, deren Betrag deutlich über dem Kategorie-Ø liegt (z. B. Strom-
// abschlag plötzlich doppelt so hoch). Der Referenzwert je Kategorie wird
// ohne die Kandidaten-Buchung selbst berechnet, damit ein einzelner
// Ausreißer nicht seinen eigenen Maßstab nach oben zieht. minSamples/minAvg
// verhindern Alarm-Rauschen bei Kategorien mit zu wenig bzw. zu kleiner
// Historie (ein Sprung von 1 € auf 3 € wäre sonst "200% über Ø").
function findAnomalies(txs, { threshold = 2, minSamples = 4, minAvg = 20 } = {}) {
  const byCategory = new Map();
  for (const t of txs) {
    if (t.category_id == null) continue;
    if (!byCategory.has(t.category_id)) byCategory.set(t.category_id, []);
    byCategory.get(t.category_id).push(t);
  }

  const anomalies = [];
  for (const categoryTxs of byCategory.values()) {
    if (categoryTxs.length < minSamples) continue;
    const sumAbs = categoryTxs.reduce((sum, t) => sum + Math.abs(t.amount), 0);
    for (const t of categoryTxs) {
      const meanExclSelf = (sumAbs - Math.abs(t.amount)) / (categoryTxs.length - 1);
      if (meanExclSelf < minAvg) continue;
      const ratio = Math.abs(t.amount) / meanExclSelf;
      if (ratio >= threshold) {
        anomalies.push({ ...t, categoryAvg: round2(meanExclSelf), ratio: round2(ratio) });
      }
    }
  }
  return anomalies.sort((a, b) => b.ratio - a.ratio);
}

module.exports = { findAnomalies };
