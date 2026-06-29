// normalizeCounterparty ist rein, aber das Modul lädt beim Require ../db und
// öffnet damit eine SQLite-DB. Für den isolierten Test deshalb auf eine
// In-Memory-DB umlenken, bevor das Modul geladen wird.
process.env.DB_PATH = ':memory:';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeCounterparty } = require('../rules/categorize');

test('normalizeCounterparty: Großschreibung, Trim, Sonderzeichen', () => {
  assert.equal(normalizeCounterparty('Aldi Süd GmbH'), 'ALDI SUD GMBH');
  assert.equal(normalizeCounterparty('  REWE   Markt  '), 'REWE MARKT');
});

test('normalizeCounterparty: Diakritika werden entfernt', () => {
  assert.equal(normalizeCounterparty('Café Müller'), 'CAFE MULLER');
  assert.equal(normalizeCounterparty('Édeka'), 'EDEKA');
});

test('normalizeCounterparty: Satzzeichen werden zu Trennern', () => {
  assert.equal(normalizeCounterparty('PayPal (Europe) S.à.r.l.'), 'PAYPAL EUROPE S A R L');
  assert.equal(normalizeCounterparty('Amazon.de*1A2B3'), 'AMAZON DE 1A2B3');
});

test('normalizeCounterparty: leere/null Eingaben', () => {
  assert.equal(normalizeCounterparty(''), '');
  assert.equal(normalizeCounterparty(null), '');
  assert.equal(normalizeCounterparty('   '), '');
});
