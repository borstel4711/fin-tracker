const test = require('node:test');
const assert = require('node:assert/strict');
const { dateColumn, shiftMonth, monthsBetween, pctChange } = require('../lib/dates');

test('dateColumn: value_date fällt auf date zurück', () => {
  assert.equal(dateColumn('value_date'), 'COALESCE(value_date, date)');
  assert.equal(dateColumn('value_date', 't'), 'COALESCE(t.value_date, t.date)');
});

test('dateColumn: andere Felder unverändert (mit/ohne Alias)', () => {
  assert.equal(dateColumn('date'), 'date');
  assert.equal(dateColumn('date', 't'), 't.date');
});

test('shiftMonth: Monatsarithmetik mit Jahreswechsel', () => {
  assert.equal(shiftMonth('2024-01', 1), '2024-02');
  assert.equal(shiftMonth('2024-12', 1), '2025-01');
  assert.equal(shiftMonth('2024-01', -1), '2023-12');
  assert.equal(shiftMonth('2024-06', -12), '2023-06');
});

test('monthsBetween: inklusive Grenzen', () => {
  assert.deepEqual(monthsBetween('2024-01', '2024-03'), ['2024-01', '2024-02', '2024-03']);
  assert.deepEqual(monthsBetween('2024-12', '2025-02'), ['2024-12', '2025-01', '2025-02']);
  assert.deepEqual(monthsBetween('2024-05', '2024-05'), ['2024-05']);
});

test('pctChange: prozentuale Veränderung auf 1 Stelle gerundet', () => {
  assert.equal(pctChange(150, 100), 50);
  assert.equal(pctChange(50, 100), -50);
  assert.equal(pctChange(100, 100), 0);
});

test('pctChange: Division durch 0 abgefangen', () => {
  assert.equal(pctChange(0, 0), 0);
  assert.equal(pctChange(100, 0), 100);
});
