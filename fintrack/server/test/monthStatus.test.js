const test = require('node:test');
const assert = require('node:assert/strict');
const { computeExpectedRemaining, computeRemainingBudget } = require('../lib/monthStatus');

test('computeExpectedRemaining: Einnahmen und Ausgaben getrennt, MTD angerechnet', () => {
  const result = computeExpectedRemaining([
    { avg: 3000, mtd: 0 }, // Gehalt noch nicht eingegangen
    { avg: -1200, mtd: -1200 }, // Miete schon abgebucht
    { avg: -400, mtd: -150 }, // Lebensmittel teilweise ausgegeben
  ]);
  assert.equal(result.income, 3000);
  assert.equal(result.expense, 250);
});

test('computeExpectedRemaining: Überschreitung des Ø zählt als 0, nicht negativ', () => {
  const result = computeExpectedRemaining([
    { avg: -400, mtd: -900 }, // Kategorie schon weit über Schnitt
    { avg: 3000, mtd: 3500 }, // mehr Einnahmen als üblich
  ]);
  assert.equal(result.income, 0);
  assert.equal(result.expense, 0);
});

test('computeExpectedRemaining: gegenläufiges MTD-Vorzeichen wird nicht gutgeschrieben', () => {
  // Erstattung (positives MTD) in einer Ausgaben-Kategorie darf die noch
  // erwarteten Ausgaben nicht über den Ø hinaus erhöhen.
  const result = computeExpectedRemaining([{ avg: -400, mtd: 50 }]);
  assert.equal(result.expense, 400);

  // Negative Buchung in einer Einnahmen-Kategorie analog.
  const income = computeExpectedRemaining([{ avg: 3000, mtd: -100 }]);
  assert.equal(income.income, 3000);
});

test('computeExpectedRemaining: leere Liste -> 0/0', () => {
  assert.deepEqual(computeExpectedRemaining([]), { income: 0, expense: 0 });
});

test('computeRemainingBudget: Formel Kontostand + Rest-Einnahmen - Rest-Ausgaben - Puffer', () => {
  const budget = computeRemainingBudget({
    currentBalance: 2500,
    buffer: 1000,
    expectedRemainingIncome: 3000,
    expectedRemainingExpense: 1800,
  });
  assert.equal(budget, 2700);
});

test('computeRemainingBudget: ohne Kontostand (kein Start-Anker) -> null', () => {
  const budget = computeRemainingBudget({
    currentBalance: null,
    buffer: 0,
    expectedRemainingIncome: 100,
    expectedRemainingExpense: 100,
  });
  assert.equal(budget, null);
});

test('computeRemainingBudget: kann negativ werden', () => {
  const budget = computeRemainingBudget({
    currentBalance: 500,
    buffer: 1000,
    expectedRemainingIncome: 0,
    expectedRemainingExpense: 200,
  });
  assert.equal(budget, -700);
});
