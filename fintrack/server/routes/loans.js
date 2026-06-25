const express = require('express');
const db = require('../db');
const {
  round2,
  buildHistory,
  projectForward,
  buildBaseline,
  computeSondertilgungSavings,
} = require('../lib/amortization');

const router = express.Router();

function linkedTransactions(loanId) {
  return db.prepare('SELECT * FROM transactions WHERE loan_id = ? ORDER BY date ASC, id ASC').all(loanId);
}

function summarize(loan) {
  const { entries, remainingBalance } = buildHistory(loan, linkedTransactions(loan.id));
  const lastDate = entries.length ? entries[entries.length - 1].date : loan.start_date;
  const projection = projectForward(remainingBalance, loan, lastDate);

  return {
    ...loan,
    remaining_balance: remainingBalance,
    paid_interest_total: round2(entries.reduce((s, e) => s + e.interest, 0)),
    paid_principal_total: round2(
      entries.filter((e) => e.payment_type === 'rate').reduce((s, e) => s + e.principal, 0)
    ),
    paid_sondertilgung_total: round2(
      entries.filter((e) => e.payment_type === 'sondertilgung').reduce((s, e) => s + e.principal, 0)
    ),
    remaining_term_months: projection.months,
    payoff_date: projection.payoffDate,
  };
}

function findSuggestions(loan) {
  const unlinked = db
    .prepare("SELECT * FROM transactions WHERE loan_id IS NULL AND type = 'out' ORDER BY date DESC")
    .all();

  if (loan.match_pattern) {
    const pattern = loan.match_pattern.toLowerCase();
    return unlinked
      .filter(
        (tx) =>
          (tx.counterparty || '').toLowerCase().includes(pattern) ||
          (tx.purpose || '').toLowerCase().includes(pattern)
      )
      .slice(0, 50);
  }

  const tolerance = Math.max(10, loan.monthly_payment * 0.05);
  return unlinked.filter((tx) => Math.abs(Math.abs(tx.amount) - loan.monthly_payment) <= tolerance).slice(0, 50);
}

function validateLoanInput(body) {
  if (!body.name) return 'name required';
  if (body.principal_amount == null || Number.isNaN(Number(body.principal_amount)) || Number(body.principal_amount) <= 0) {
    return 'principal_amount must be a positive number';
  }
  if (
    body.interest_rate_annual == null ||
    Number.isNaN(Number(body.interest_rate_annual)) ||
    Number(body.interest_rate_annual) < 0
  ) {
    return 'interest_rate_annual must be a non-negative number';
  }
  if (body.monthly_payment == null || Number.isNaN(Number(body.monthly_payment)) || Number(body.monthly_payment) <= 0) {
    return 'monthly_payment must be a positive number';
  }
  if (!body.start_date) return 'start_date required';
  return null;
}

router.get('/loans', (req, res) => {
  const loans = db.prepare('SELECT * FROM loans ORDER BY name ASC').all();
  res.json(loans.map(summarize));
});

router.post('/loans', (req, res) => {
  const error = validateLoanInput(req.body);
  if (error) return res.status(400).json({ error });
  const {
    name,
    principal_amount,
    interest_rate_annual,
    monthly_payment,
    start_date,
    match_pattern = null,
    notes = null,
  } = req.body;
  const info = db
    .prepare(
      `INSERT INTO loans (name, principal_amount, interest_rate_annual, monthly_payment, start_date, match_pattern, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      name,
      Number(principal_amount),
      Number(interest_rate_annual),
      Number(monthly_payment),
      start_date,
      match_pattern || null,
      notes || null
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/loans/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...existing, ...req.body };
  const error = validateLoanInput(merged);
  if (error) return res.status(400).json({ error });
  db.prepare(
    `UPDATE loans
     SET name = ?, principal_amount = ?, interest_rate_annual = ?, monthly_payment = ?, start_date = ?, match_pattern = ?, notes = ?
     WHERE id = ?`
  ).run(
    merged.name,
    Number(merged.principal_amount),
    Number(merged.interest_rate_annual),
    Number(merged.monthly_payment),
    merged.start_date,
    merged.match_pattern || null,
    merged.notes || null,
    req.params.id
  );
  res.json(merged);
});

const deleteLoanCascade = db.transaction((id) => {
  db.prepare('UPDATE transactions SET loan_id = NULL, loan_payment_type = NULL WHERE loan_id = ?').run(id);
  db.prepare('DELETE FROM loans WHERE id = ?').run(id);
});

router.delete('/loans/:id', (req, res) => {
  deleteLoanCascade(req.params.id);
  res.status(204).end();
});

router.get('/loans/:id', (req, res) => {
  const loan = db.prepare('SELECT * FROM loans WHERE id = ?').get(req.params.id);
  if (!loan) return res.status(404).json({ error: 'not found' });

  const linkedTx = linkedTransactions(loan.id);
  const { entries, remainingBalance } = buildHistory(loan, linkedTx);
  const lastDate = entries.length ? entries[entries.length - 1].date : loan.start_date;
  const projection = projectForward(remainingBalance, loan, lastDate);
  const baseline = buildBaseline(loan, linkedTx);
  const perSondertilgung = computeSondertilgungSavings(loan, entries);

  const paidInterest = round2(entries.reduce((s, e) => s + e.interest, 0));
  const paidPrincipal = round2(
    entries.filter((e) => e.payment_type === 'rate').reduce((s, e) => s + e.principal, 0)
  );
  const paidSondertilgung = round2(
    entries.filter((e) => e.payment_type === 'sondertilgung').reduce((s, e) => s + e.principal, 0)
  );

  const historyTotalInterest = projection.totalInterest === null ? null : round2(paidInterest + projection.totalInterest);
  const historyTotalMonths = projection.months === null ? null : entries.length + projection.months;
  const baselinePaidInterest = round2(baseline.entries.reduce((s, e) => s + e.interest, 0));
  const baselineTotalInterest =
    baseline.projection.totalInterest === null ? null : round2(baselinePaidInterest + baseline.projection.totalInterest);
  const baselineTotalMonths =
    baseline.projection.months === null ? null : baseline.entries.length + baseline.projection.months;

  const interestSavedTotal =
    historyTotalInterest === null || baselineTotalInterest === null
      ? null
      : round2(baselineTotalInterest - historyTotalInterest);
  const monthsSavedTotal =
    historyTotalMonths === null || baselineTotalMonths === null ? null : baselineTotalMonths - historyTotalMonths;

  res.json({
    loan: {
      ...loan,
      remaining_balance: remainingBalance,
      paid_interest_total: paidInterest,
      paid_principal_total: paidPrincipal,
      paid_sondertilgung_total: paidSondertilgung,
      remaining_term_months: projection.months,
      payoff_date: projection.payoffDate,
    },
    history: entries,
    projection: projection.series,
    baseline: [
      ...baseline.entries.map((e) => ({ date: e.date, balance: e.balance_after })),
      ...baseline.projection.series,
    ],
    savings: {
      interestSavedTotal,
      monthsSavedTotal,
      perSondertilgung,
    },
    suggestions: findSuggestions(loan),
  });
});

module.exports = router;
