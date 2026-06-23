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

function byCategoryTotals(from, to) {
  let query = `
    SELECT c.id AS category_id, c.name, c.color,
           SUM(-t.amount) AS total
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.amount < 0
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
  query += ' GROUP BY t.category_id ORDER BY total DESC';

  return db
    .prepare(query)
    .all(...params)
    .map((r) => ({
      category_id: r.category_id,
      name: r.name || 'Nicht kategorisiert',
      color: r.color,
      total: r.total || 0,
    }));
}

router.get('/reports/by-category', (req, res) => {
  res.json(byCategoryTotals(req.query.from, req.query.to));
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

function lastNMonths(n) {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(shiftMonth(current, -i));
  }
  return months;
}

function pctChange(recentAbs, olderAbs) {
  if (olderAbs === 0) return recentAbs === 0 ? 0 : 100;
  return Math.round(((recentAbs - olderAbs) / olderAbs) * 1000) / 10;
}

function categorySummary() {
  const months = lastNMonths(12);
  const earliestMonth = months[0];
  const currentMonth = months[months.length - 1];
  const currentYear = currentMonth.slice(0, 4);

  const allTimeRows = db
    .prepare(
      `SELECT c.id AS category_id, c.name, c.color, c.icon, SUM(t.amount) AS total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       GROUP BY c.id`
    )
    .all();

  const yearRows = db
    .prepare(
      `SELECT category_id, SUM(amount) AS total
       FROM transactions
       WHERE category_id IS NOT NULL AND substr(date, 1, 4) = ?
       GROUP BY category_id`
    )
    .all(currentYear);

  const monthlyRows = db
    .prepare(
      `SELECT substr(date, 1, 7) AS month, category_id, SUM(amount) AS total
       FROM transactions
       WHERE category_id IS NOT NULL AND date >= ? AND substr(date, 1, 7) <= ?
       GROUP BY month, category_id`
    )
    .all(`${earliestMonth}-01`, currentMonth);

  const monthlyByCategory = new Map();
  for (const row of monthlyRows) {
    if (!monthlyByCategory.has(row.category_id)) monthlyByCategory.set(row.category_id, new Map());
    monthlyByCategory.get(row.category_id).set(row.month, row.total || 0);
  }
  const yearByCategory = new Map(yearRows.map((r) => [r.category_id, r.total || 0]));

  function trendPct(monthlyMap, windowSize) {
    const half = windowSize / 2;
    const windowMonths = months.slice(months.length - windowSize);
    const sumAbs = (monthList) => monthList.reduce((acc, m) => acc + Math.abs(monthlyMap.get(m) || 0), 0);
    const olderAbs = sumAbs(windowMonths.slice(0, half));
    const recentAbs = sumAbs(windowMonths.slice(half));
    return pctChange(recentAbs, olderAbs);
  }

  const categories = allTimeRows.map((r) => {
    const monthlyMap = monthlyByCategory.get(r.category_id) || new Map();
    const monthly = months.map((m) => Math.round((monthlyMap.get(m) || 0) * 100) / 100);
    const sumLast12 = monthly.reduce((acc, v) => acc + v, 0);

    return {
      category_id: r.category_id,
      name: r.name,
      color: r.color,
      icon: r.icon,
      total_all_time: Math.round((r.total || 0) * 100) / 100,
      total_year: Math.round((yearByCategory.get(r.category_id) || 0) * 100) / 100,
      total_month: monthly[monthly.length - 1],
      avg_per_month: Math.round((sumLast12 / 12) * 100) / 100,
      trend_6m_pct: trendPct(monthlyMap, 6),
      trend_12m_pct: trendPct(monthlyMap, 12),
      monthly,
    };
  });

  return { months, categories };
}

router.get('/reports/category-summary', (req, res) => {
  res.json(categorySummary());
});

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
