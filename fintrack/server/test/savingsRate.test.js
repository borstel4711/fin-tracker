const test = require('node:test');
const assert = require('node:assert/strict');
const { computeSavingsRates } = require('../lib/savingsRate');

function month(m, income, expense) {
  return { month: m, income, expense, net: income - expense };
}

test('computeSavingsRates: Quote = Netto / Einnahmen in Prozent', () => {
  const result = computeSavingsRates([month('2026-01', 3000, 2400)]);
  assert.equal(result[0].rate, 20);
});

test('computeSavingsRates: keine Einnahmen -> Quote ist null, nicht 0', () => {
  const result = computeSavingsRates([month('2026-01', 0, 100)]);
  assert.equal(result[0].rate, null);
});

test('computeSavingsRates: negative Quote bei Netto-Minus', () => {
  const result = computeSavingsRates([month('2026-01', 1000, 1500)]);
  assert.equal(result[0].rate, -50);
});

test('computeSavingsRates: 3-Monats-Schnitt mittelt über die letzten 3 Monate', () => {
  const result = computeSavingsRates([month('2026-01', 1000, 500), month('2026-02', 1000, 800), month('2026-03', 1000, 700)]);
  // Quoten: 50, 20, 30 -> Schnitt der letzten 3 = 33.33
  assert.equal(result[2].rate3m, 33.33);
});

test('computeSavingsRates: gleitender Schnitt ignoriert Monate ohne Einnahmen', () => {
  const result = computeSavingsRates([month('2026-01', 0, 100), month('2026-02', 1000, 500)]);
  // Monat 1 hat keine gültige Quote -> 3M-Schnitt bei Monat 2 basiert nur auf Monat 2 (50)
  assert.equal(result[1].rate3m, 50);
});

test('computeSavingsRates: leere Monatsliste -> leeres Ergebnis', () => {
  assert.deepEqual(computeSavingsRates([]), []);
});
