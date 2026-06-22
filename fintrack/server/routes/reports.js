const express = require('express');
const db = require('../db');

const router = express.Router();

function monthlyTotals(from, to) {
  let query = `
    SELECT substr(date, 1, 7) AS month,
           SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense
    FROM transactions
  `;
  const params = [];
  const where = [];
  if (from) {
    where.push('date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('date <= ?');
    params.push(to);
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' GROUP BY month ORDER BY month ASC';
  return db
    .prepare(query)
    .all(...params)
    .map((r) => ({
      month: r.month,
      income: r.income || 0,
      expense: r.expense || 0,
      net: (r.income || 0) - (r.expense || 0),
    }));
}

router.get('/reports/monthly', (req, res) => {
  res.json(monthlyTotals(req.query.from, req.query.to));
});

router.get('/reports/by-category', (req, res) => {
  const month = req.query.month;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

  const rows = db
    .prepare(
      `SELECT c.id AS category_id, c.name, c.color,
              SUM(-t.amount) AS total
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE substr(t.date, 1, 7) = ? AND t.amount < 0
       GROUP BY t.category_id
       ORDER BY total DESC`
    )
    .all(month);

  res.json(
    rows.map((r) => ({
      category_id: r.category_id,
      name: r.name || 'Nicht kategorisiert',
      color: r.color,
      total: r.total || 0,
    }))
  );
});

function categoryMonthlyTotals(type, from, to) {
  const amountExpr = type === 'income' ? 't.amount' : '-t.amount';
  const amountFilter = type === 'income' ? 't.amount > 0' : 't.amount < 0';

  let query = `
    SELECT substr(t.date, 1, 7) AS month, c.id AS category_id, c.name, c.color,
           SUM(${amountExpr}) AS total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE ${amountFilter}
  `;
  const params = [];
  if (from) {
    query += ' AND t.date >= ?';
    params.push(from);
  }
  if (to) {
    query += ' AND t.date <= ?';
    params.push(to);
  }
  query += ' GROUP BY month, t.category_id ORDER BY month ASC';

  return db
    .prepare(query)
    .all(...params)
    .map((r) => ({
      month: r.month,
      category_id: r.category_id,
      name: r.name || 'Nicht kategorisiert',
      color: r.color,
      total: r.total || 0,
    }));
}

router.get('/reports/by-category-monthly', (req, res) => {
  const { type, from, to } = req.query;
  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  res.json(categoryMonthlyTotals(type, from, to));
});

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

router.get('/reports/compare', (req, res) => {
  const month = req.query.month;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

  const previousMonth = shiftMonth(month, -1);
  const previousYear = shiftMonth(month, -12);

  const totals = monthlyTotals(previousYear, month).reduce((acc, r) => {
    acc[r.month] = r;
    return acc;
  }, {});

  res.json({
    month: totals[month] || { month, income: 0, expense: 0, net: 0 },
    previousMonth: totals[previousMonth] || { month: previousMonth, income: 0, expense: 0, net: 0 },
    previousYear: totals[previousYear] || { month: previousYear, income: 0, expense: 0, net: 0 },
  });
});

module.exports = router;
