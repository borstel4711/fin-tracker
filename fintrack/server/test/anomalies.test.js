const test = require('node:test');
const assert = require('node:assert/strict');
const { findAnomalies } = require('../lib/anomalies');

function tx(id, amount, category_id = 1) {
  return { id, amount, category_id, date: '2026-01-01' };
}

test('findAnomalies: markiert Buchung deutlich über Kategorie-Ø', () => {
  const txs = [tx(1, -50), tx(2, -55), tx(3, -48), tx(4, -52), tx(5, -200)];
  const result = findAnomalies(txs, { threshold: 2, minSamples: 4, minAvg: 20 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 5);
  assert.ok(result[0].ratio >= 2);
});

test('findAnomalies: Referenzwert schließt die Kandidaten-Buchung selbst aus', () => {
  // Ø aller 5 Buchungen wäre (50+55+48+52+200)/5 = 81; die 200er-Buchung
  // wäre dann "nur" 2.47x statt deutlich mehr, wenn sie sich selbst einrechnet.
  const txs = [tx(1, -50), tx(2, -55), tx(3, -48), tx(4, -52), tx(5, -200)];
  const result = findAnomalies(txs, { threshold: 2, minSamples: 4, minAvg: 20 });
  const avgOfOthers = (50 + 55 + 48 + 52) / 4;
  assert.equal(result[0].categoryAvg, avgOfOthers);
});

test('findAnomalies: zu wenig Buchungen in der Kategorie -> keine Anomalie', () => {
  const txs = [tx(1, -50), tx(2, -500)];
  const result = findAnomalies(txs, { threshold: 2, minSamples: 4, minAvg: 20 });
  assert.equal(result.length, 0);
});

test('findAnomalies: Kategorie-Ø unter minAvg wird ignoriert (Rauschunterdrückung)', () => {
  const txs = [tx(1, -1), tx(2, -1.2), tx(3, -0.9), tx(4, -1.1), tx(5, -3)];
  const result = findAnomalies(txs, { threshold: 2, minSamples: 4, minAvg: 20 });
  assert.equal(result.length, 0);
});

test('findAnomalies: unkategorisierte Buchungen werden ignoriert', () => {
  const txs = [
    { id: 1, amount: -50, category_id: null, date: '2026-01-01' },
    { id: 2, amount: -9999, category_id: null, date: '2026-01-01' },
  ];
  assert.deepEqual(findAnomalies(txs, {}), []);
});

test('findAnomalies: mehrere Kategorien werden unabhängig bewertet', () => {
  const txs = [
    tx(1, -50, 1),
    tx(2, -55, 1),
    tx(3, -48, 1),
    tx(4, -150, 1),
    tx(5, -100, 2),
    tx(6, -110, 2),
    tx(7, -95, 2),
    tx(8, -105, 2),
  ];
  const result = findAnomalies(txs, { threshold: 2, minSamples: 4, minAvg: 20 });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 4);
});

test('findAnomalies: Ergebnis nach Ratio absteigend sortiert', () => {
  const txs = [
    tx(1, -50, 1),
    tx(2, -55, 1),
    tx(3, -48, 1),
    tx(4, -300, 1),
    tx(5, -100, 2),
    tx(6, -110, 2),
    tx(7, -95, 2),
    tx(8, -500, 2),
  ];
  const result = findAnomalies(txs, { threshold: 2, minSamples: 4, minAvg: 20 });
  assert.equal(result.length, 2);
  assert.ok(result[0].ratio >= result[1].ratio);
});
