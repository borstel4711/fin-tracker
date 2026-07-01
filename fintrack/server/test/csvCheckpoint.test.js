const test = require('node:test');
const assert = require('node:assert/strict');
const { findLatestBalanceRow } = require('../lib/csvCheckpoint');

test('findLatestBalanceRow: wählt die Zeile mit dem spätesten Datum', () => {
  const rows = [
    { date: '2026-01-05', balance: 100 },
    { date: '2026-01-10', balance: 250 },
    { date: '2026-01-08', balance: 180 },
  ];
  assert.equal(findLatestBalanceRow(rows).balance, 250);
});

test('findLatestBalanceRow: Zeilen ohne Saldo werden ignoriert', () => {
  const rows = [
    { date: '2026-01-05', balance: 100 },
    { date: '2026-01-10', balance: null },
  ];
  assert.equal(findLatestBalanceRow(rows).date, '2026-01-05');
});

test('findLatestBalanceRow: keine Zeile mit Saldo -> null', () => {
  const rows = [{ date: '2026-01-05', balance: null }];
  assert.equal(findLatestBalanceRow(rows), null);
});

test('findLatestBalanceRow: leere Liste -> null', () => {
  assert.equal(findLatestBalanceRow([]), null);
});
