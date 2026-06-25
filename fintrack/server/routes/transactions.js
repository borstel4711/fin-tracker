const crypto = require('crypto');
const express = require('express');
const db = require('../db');
const { learn } = require('../rules/categorize');

const router = express.Router();

router.get('/transactions', (req, res) => {
  const { from, to, category, uncategorized, q, loan, unassigned_loan } = req.query;
  const where = [];
  const params = [];
  if (from) {
    where.push('date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('date <= ?');
    params.push(to);
  }
  if (uncategorized === 'true') {
    where.push('category_id IS NULL');
  } else if (category) {
    where.push('category_id = ?');
    params.push(Number(category));
  }
  if (unassigned_loan === 'true') {
    where.push('loan_id IS NULL');
  } else if (loan) {
    where.push('loan_id = ?');
    params.push(Number(loan));
  }
  if (q) {
    where.push('(counterparty LIKE ? OR purpose LIKE ?)');
    const term = `%${q}%`;
    params.push(term, term);
  }

  let query = 'SELECT * FROM transactions';
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY date DESC, id DESC';

  res.json(db.prepare(query).all(...params));
});

function validateLoanLink(body) {
  const hasLoanId = body.loan_id != null;
  const hasPaymentType = body.loan_payment_type != null;
  if (hasLoanId !== hasPaymentType) return 'loan_id and loan_payment_type must be set together';
  if (hasPaymentType && body.loan_payment_type !== 'rate' && body.loan_payment_type !== 'sondertilgung') {
    return "loan_payment_type must be 'rate' or 'sondertilgung'";
  }
  return null;
}

router.post('/transactions', (req, res) => {
  const { date, value_date = null, amount, counterparty = null, purpose = null, category_id = null } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  if (amount == null || Number.isNaN(Number(amount))) return res.status(400).json({ error: 'amount must be a number' });
  const loanError = validateLoanLink(req.body);
  if (loanError) return res.status(400).json({ error: loanError });
  const { loan_id = null, loan_payment_type = null } = req.body;

  const numericAmount = Number(amount);
  const type = numericAmount >= 0 ? 'in' : 'out';
  const hash = `manual-${crypto.randomUUID()}`;

  const info = db
    .prepare(
      `INSERT INTO transactions
         (date, value_date, amount, type, counterparty, purpose, category_id, category_src, source_file, import_batch, hash, loan_id, loan_payment_type)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?, ?, ?)`
    )
    .run(
      date,
      value_date,
      numericAmount,
      type,
      counterparty,
      purpose,
      category_id,
      category_id != null ? 'manual' : null,
      hash,
      loan_id,
      loan_payment_type
    );

  if (category_id != null) {
    learn(counterparty, category_id);
  }

  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/transactions/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });

  const merged = { ...existing, ...req.body };
  if (!merged.date) return res.status(400).json({ error: 'date required' });
  if (merged.amount == null || Number.isNaN(Number(merged.amount))) {
    return res.status(400).json({ error: 'amount must be a number' });
  }
  const loanError = validateLoanLink(merged);
  if (loanError) return res.status(400).json({ error: loanError });

  const numericAmount = Number(merged.amount);
  const type = numericAmount >= 0 ? 'in' : 'out';
  const categorySrc = 'category_id' in req.body ? (merged.category_id != null ? 'manual' : null) : merged.category_src;

  db.prepare(
    `UPDATE transactions
     SET date = ?, value_date = ?, amount = ?, type = ?, counterparty = ?, purpose = ?,
         category_id = ?, category_src = ?, loan_id = ?, loan_payment_type = ?
     WHERE id = ?`
  ).run(
    merged.date,
    merged.value_date,
    numericAmount,
    type,
    merged.counterparty,
    merged.purpose,
    merged.category_id,
    categorySrc,
    merged.loan_id,
    merged.loan_payment_type,
    req.params.id
  );

  if ('category_id' in req.body && merged.category_id != null) {
    learn(merged.counterparty, merged.category_id);
  }

  res.json({ ...merged, amount: numericAmount, type, category_src: categorySrc });
});

router.delete('/transactions/:id', (req, res) => {
  db.prepare('DELETE FROM transactions WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
