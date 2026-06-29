const test = require('node:test');
const assert = require('node:assert/strict');
const {
  round2,
  addMonths,
  splitPayment,
  buildHistory,
  projectForward,
  computeSondertilgungSavings,
} = require('../lib/amortization');

test('round2: auf 2 Stellen', () => {
  assert.equal(round2(2.344), 2.34);
  assert.equal(round2(2.346), 2.35);
  assert.equal(round2(-1.234), -1.23);
  assert.equal(round2(100), 100);
});

test('addMonths: einfache Addition', () => {
  assert.equal(addMonths('2024-01-15', 1), '2024-02-15');
  assert.equal(addMonths('2024-01-15', 12), '2025-01-15');
});

test('addMonths: Monatsende wird geklemmt statt überzulaufen', () => {
  // 31. Jan + 1 Monat -> 29. Feb (Schaltjahr), nicht 2. März
  assert.equal(addMonths('2024-01-31', 1), '2024-02-29');
  // 31. Jan + 1 Monat im Nicht-Schaltjahr -> 28. Feb
  assert.equal(addMonths('2023-01-31', 1), '2023-02-28');
});

test('splitPayment: reguläre Rate teilt in Zins und Tilgung', () => {
  // 10.000 Restschuld, 12% p.a. -> 1% pro Monat = 100 Zinsen
  const r = splitPayment(10000, 12, -500, false);
  assert.equal(r.interest, 100);
  assert.equal(r.principal, 400);
  assert.equal(r.remainingAfter, 9600);
});

test('splitPayment: Sondertilgung -> kein Zins, voll auf Tilgung', () => {
  const r = splitPayment(10000, 12, -1000, true);
  assert.equal(r.interest, 0);
  assert.equal(r.principal, 1000);
  assert.equal(r.remainingAfter, 9000);
});

test('splitPayment: Tilgung wird auf Restschuld begrenzt', () => {
  const r = splitPayment(300, 12, -1000, true);
  assert.equal(r.principal, 300);
  assert.equal(r.remainingAfter, 0);
});

test('buildHistory: laufender Saldo über mehrere Buchungen', () => {
  const loan = { principal_amount: 10000, interest_rate_annual: 12 };
  const tx = [
    { id: 1, date: '2024-02-01', amount: -500, loan_payment_type: 'rate' },
    { id: 2, date: '2024-03-01', amount: -2000, loan_payment_type: 'sondertilgung' },
  ];
  const { entries, remainingBalance } = buildHistory(loan, tx);
  assert.equal(entries.length, 2);
  assert.equal(entries[0].balance_after, 9600); // 10000 - 400 Tilgung
  assert.equal(entries[1].interest, 0); // Sondertilgung
  assert.equal(entries[1].balance_after, 7600); // 9600 - 2000
  assert.equal(remainingBalance, 7600);
});

test('projectForward: Restschuld 0 -> 0 Monate', () => {
  const loan = { interest_rate_annual: 12, monthly_payment: 500 };
  assert.deepEqual(projectForward(0, loan, '2024-01-01'), {
    months: 0,
    payoffDate: '2024-01-01',
    totalInterest: 0,
    series: [],
  });
});

test('projectForward: Rate deckt Zinsen nicht -> months null', () => {
  // 10.000 @ 12% -> 100/Monat Zins; Rate 100 tilgt nie
  const loan = { interest_rate_annual: 12, monthly_payment: 100 };
  const r = projectForward(10000, loan, '2024-01-01');
  assert.equal(r.months, null);
  assert.equal(r.payoffDate, null);
});

test('projectForward: amortisiert in endlicher Zeit', () => {
  const loan = { interest_rate_annual: 12, monthly_payment: 500 };
  const r = projectForward(10000, loan, '2024-01-01');
  assert.ok(r.months > 0 && r.months < 1200);
  assert.ok(r.payoffDate);
  assert.ok(r.totalInterest > 0);
});

test('computeSondertilgungSavings: nur Sondertilgungen, mit Ersparnis', () => {
  const loan = { principal_amount: 10000, interest_rate_annual: 12, monthly_payment: 500 };
  const { entries } = buildHistory(loan, [
    { id: 1, date: '2024-02-01', amount: -500, loan_payment_type: 'rate' },
    { id: 2, date: '2024-03-01', amount: -2000, loan_payment_type: 'sondertilgung' },
  ]);
  const savings = computeSondertilgungSavings(loan, entries);
  assert.equal(savings.length, 1);
  assert.equal(savings[0].transaction_id, 2);
  assert.ok(savings[0].interestSaved > 0);
  assert.ok(savings[0].monthsSaved > 0);
});
