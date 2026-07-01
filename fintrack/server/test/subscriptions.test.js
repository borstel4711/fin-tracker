const test = require('node:test');
const assert = require('node:assert/strict');
const { findRecurringPayments } = require('../lib/subscriptions');

function tx(id, date, amount, counterparty = 'Netflix') {
  return { id, date, amount, counterparty, category_id: 1 };
}

test('findRecurringPayments: erkennt monatliches Abo mit stabilem Betrag', () => {
  const txs = [tx(1, '2026-01-15', -9.99), tx(2, '2026-02-15', -9.99), tx(3, '2026-03-16', -9.99)];
  const result = findRecurringPayments(txs);
  assert.equal(result.length, 1);
  assert.equal(result[0].occurrences, 3);
  assert.equal(result[0].amount, -9.99);
});

test('findRecurringPayments: zu wenige Vorkommen -> keine Erkennung', () => {
  const txs = [tx(1, '2026-01-15', -9.99), tx(2, '2026-02-15', -9.99)];
  assert.deepEqual(findRecurringPayments(txs), []);
});

test('findRecurringPayments: unregelmäßiger Abstand -> keine Erkennung', () => {
  const txs = [tx(1, '2026-01-15', -9.99), tx(2, '2026-01-20', -9.99), tx(3, '2026-06-01', -9.99)];
  assert.deepEqual(findRecurringPayments(txs), []);
});

test('findRecurringPayments: unterschiedliche Beträge trennen die Gruppe (bekannte Grenze)', () => {
  const txs = [tx(1, '2026-01-15', -9.99), tx(2, '2026-02-15', -12.99), tx(3, '2026-03-15', -12.99)];
  assert.deepEqual(findRecurringPayments(txs), []);
});

test('findRecurringPayments: ein ausgelassener Monat wird toleriert, solange die Mehrheit der Abstände regelmäßig ist', () => {
  // Gaps: Jan->Feb 31 Tage (regulär), Feb->Apr 59 Tage (März übersprungen,
  // unregelmäßig), Apr->Mai 30 Tage (regulär) -> 2 von 3 Abständen regulär.
  const txs = [
    tx(1, '2026-01-15', -9.99),
    tx(2, '2026-02-15', -9.99),
    tx(3, '2026-04-15', -9.99),
    tx(4, '2026-05-15', -9.99),
  ];
  const result = findRecurringPayments(txs);
  assert.equal(result.length, 1);
  assert.equal(result[0].occurrences, 4);
});

test('findRecurringPayments: positive Buchungen (Einnahmen) werden ignoriert', () => {
  const txs = [tx(1, '2026-01-15', 9.99), tx(2, '2026-02-15', 9.99), tx(3, '2026-03-15', 9.99)];
  assert.deepEqual(findRecurringPayments(txs), []);
});

test('findRecurringPayments: mehrere unabhängige Abos werden alle erkannt', () => {
  const txs = [
    tx(1, '2026-01-15', -9.99, 'Netflix'),
    tx(2, '2026-02-15', -9.99, 'Netflix'),
    tx(3, '2026-03-15', -9.99, 'Netflix'),
    tx(4, '2026-01-01', -29.99, 'Fitnessstudio'),
    tx(5, '2026-02-01', -29.99, 'Fitnessstudio'),
    tx(6, '2026-03-01', -29.99, 'Fitnessstudio'),
  ];
  const result = findRecurringPayments(txs);
  assert.equal(result.length, 2);
});

test('findRecurringPayments: Ergebnis nach Betrag aufsteigend (größte Ausgabe zuerst)', () => {
  const txs = [
    tx(1, '2026-01-15', -9.99, 'Netflix'),
    tx(2, '2026-02-15', -9.99, 'Netflix'),
    tx(3, '2026-03-15', -9.99, 'Netflix'),
    tx(4, '2026-01-01', -29.99, 'Fitnessstudio'),
    tx(5, '2026-02-01', -29.99, 'Fitnessstudio'),
    tx(6, '2026-03-01', -29.99, 'Fitnessstudio'),
  ];
  const result = findRecurringPayments(txs);
  assert.equal(result[0].counterparty, 'Fitnessstudio');
});
