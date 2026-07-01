const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAmount, parseDate, hashRow, normalizeRow, dedupeSameDayHashes } = require('../import/normalize');

test('parseAmount: deutsches Format mit Dezimalkomma', () => {
  assert.equal(parseAmount('1.234,56', 1), 1234.56);
  assert.equal(parseAmount('-1.234,56', 1), -1234.56);
  assert.equal(parseAmount('0,00', 1), 0);
  assert.equal(parseAmount('12,5', 1), 12.5);
});

test('parseAmount: englisches Format ohne Dezimalkomma', () => {
  assert.equal(parseAmount('1,234.56', 0), 1234.56);
  assert.equal(parseAmount('-50.00', 0), -50);
});

test('parseAmount: Währungssymbole/Whitespace werden entfernt', () => {
  assert.equal(parseAmount(' 1.234,56 €', 1), 1234.56);
  assert.equal(parseAmount('EUR 99,99', 1), 99.99);
});

test('parseAmount: leere/ungültige Werte ergeben null', () => {
  assert.equal(parseAmount('', 1), null);
  assert.equal(parseAmount(null, 1), null);
  assert.equal(parseAmount('   ', 1), null);
  assert.equal(parseAmount('abc', 1), null);
});

test('parseDate: DD.MM.YYYY -> ISO', () => {
  assert.equal(parseDate('01.02.2024', 'DD.MM.YYYY'), '2024-02-01');
  assert.equal(parseDate('9.3.2024', 'DD.MM.YYYY'), '2024-03-09');
});

test('parseDate: zweistelliges Jahr wird zu 20xx', () => {
  assert.equal(parseDate('01.02.24', 'DD.MM.YYYY'), '2024-02-01');
});

test('parseDate: ISO-Format wird durchgereicht/validiert', () => {
  assert.equal(parseDate('2024-02-01', 'YYYY-MM-DD'), '2024-02-01');
  assert.equal(parseDate('01.02.2024', 'YYYY-MM-DD'), null);
});

test('parseDate: ungültige Eingaben ergeben null', () => {
  assert.equal(parseDate('', 'DD.MM.YYYY'), null);
  assert.equal(parseDate('not a date', 'DD.MM.YYYY'), null);
  assert.equal(parseDate(null, 'DD.MM.YYYY'), null);
});

test('hashRow: stabil und dedup-sensitiv', () => {
  const a = hashRow({ date: '2024-01-01', amount: -10, counterparty: 'X', purpose: 'Y' });
  const b = hashRow({ date: '2024-01-01', amount: -10, counterparty: 'X', purpose: 'Y' });
  assert.equal(a, b);
  const c = hashRow({ date: '2024-01-01', amount: -11, counterparty: 'X', purpose: 'Y' });
  assert.notEqual(a, c);
});

test('hashRow: fehlende Felder unterscheiden sich nicht von leeren Strings', () => {
  const withNull = hashRow({ date: '2024-01-01', amount: 5, counterparty: null, purpose: null });
  const withEmpty = hashRow({ date: '2024-01-01', amount: 5, counterparty: '', purpose: '' });
  assert.equal(withNull, withEmpty);
});

test('normalizeRow: Einzelbetragsfeld, type aus Vorzeichen', () => {
  const profile = {
    col_date: 'Buchung',
    date_format: 'DD.MM.YYYY',
    decimal_comma: 1,
    col_amount: 'Betrag',
    col_counterparty: 'Empf',
    col_purpose: 'Zweck',
  };
  const out = normalizeRow(
    { Buchung: '01.02.2024', Betrag: '-12,50', Empf: ' Aldi ', Zweck: 'Einkauf' },
    profile
  );
  assert.equal(out.date, '2024-02-01');
  assert.equal(out.amount, -12.5);
  assert.equal(out.type, 'out');
  assert.equal(out.counterparty, 'Aldi');
  assert.equal(out.purpose, 'Einkauf');
  assert.ok(out.hash);
});

test('normalizeRow: getrennte Soll/Haben-Spalten -> Vorzeichen', () => {
  const profile = {
    col_date: 'Datum',
    date_format: 'DD.MM.YYYY',
    decimal_comma: 1,
    col_debit: 'Soll',
    col_credit: 'Haben',
  };
  const debitRow = normalizeRow({ Datum: '01.01.2024', Soll: '50,00', Haben: '' }, profile);
  assert.equal(debitRow.amount, -50);
  assert.equal(debitRow.type, 'out');

  const creditRow = normalizeRow({ Datum: '01.01.2024', Soll: '', Haben: '200,00' }, profile);
  assert.equal(creditRow.amount, 200);
  assert.equal(creditRow.type, 'in');
});

test('dedupeSameDayHashes: erste Wiederholung behält Hash, zweite bekommt Suffix', () => {
  const rows = [
    { hash: 'abc', amount: -20 },
    { hash: 'abc', amount: -20 },
    { hash: 'xyz', amount: -5 },
  ];
  const result = dedupeSameDayHashes(rows);
  assert.equal(result[0].hash, 'abc');
  assert.equal(result[1].hash, 'abc#1');
  assert.equal(result[2].hash, 'xyz');
});

test('dedupeSameDayHashes: dritte Wiederholung bekommt eigenen Suffix', () => {
  const rows = [{ hash: 'abc' }, { hash: 'abc' }, { hash: 'abc' }];
  const result = dedupeSameDayHashes(rows);
  assert.deepEqual(
    result.map((r) => r.hash),
    ['abc', 'abc#1', 'abc#2']
  );
});

test('dedupeSameDayHashes: erneuter Lauf mit identischer Reihenfolge reproduziert dieselben Hashes (Idempotenz)', () => {
  const rows = [{ hash: 'abc' }, { hash: 'abc' }, { hash: 'def' }];
  const first = dedupeSameDayHashes(rows).map((r) => r.hash);
  const second = dedupeSameDayHashes(rows).map((r) => r.hash);
  assert.deepEqual(first, second);
});

test('normalizeRow: Soll und Haben beide leer -> null (Zeile verworfen)', () => {
  const profile = {
    col_date: 'Datum',
    date_format: 'DD.MM.YYYY',
    decimal_comma: 1,
    col_debit: 'Soll',
    col_credit: 'Haben',
  };
  assert.equal(normalizeRow({ Datum: '01.01.2024', Soll: '', Haben: '' }, profile), null);
});

test('normalizeRow: ungültiges Datum oder Betrag -> null (Zeile verworfen)', () => {
  const profile = { col_date: 'd', date_format: 'DD.MM.YYYY', decimal_comma: 1, col_amount: 'a' };
  assert.equal(normalizeRow({ d: 'xx', a: '10,00' }, profile), null);
  assert.equal(normalizeRow({ d: '01.01.2024', a: 'xx' }, profile), null);
});
