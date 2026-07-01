const express = require('express');
const db = require('../db');
const { dateColumn, shiftMonth, lastNMonths, pctChange } = require('../lib/dates');
const { computeExpectedRemaining, computeRemainingBudget } = require('../lib/monthStatus');
const { findAnomalies } = require('../lib/anomalies');
const { computeSavingsRates } = require('../lib/savingsRate');
const { findRecurringPayments } = require('../lib/subscriptions');

const router = express.Router();

function monthlyTotals(from, to, field) {
  const dateCol = dateColumn(field);
  let query = `
    SELECT substr(${dateCol}, 1, 7) AS month,
           SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
           SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense
    FROM transactions
  `;
  const params = [];
  const where = [];
  if (from) {
    where.push(`${dateCol} >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`${dateCol} <= ?`);
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
  res.json(monthlyTotals(req.query.from, req.query.to, req.query.field));
});

router.get('/reports/savings-rate', (req, res) => {
  const totals = monthlyTotals(req.query.from, req.query.to, req.query.field);
  res.json(computeSavingsRates(totals));
});

// Größte Einzelbuchungen im Zeitraum (Standard: Ausgaben), sortiert nach
// Betragshöhe. Kein eigenes lib-Modul nötig — reine Sortier-/Filterabfrage
// ohne Berechnungslogik, wie auch die übrigen einfachen Report-Endpunkte.
router.get('/reports/top-transactions', (req, res) => {
  const { from, to, field, type = 'expense', limit } = req.query;
  const dateCol = dateColumn(field, 't');
  const parsedLimit = Number(limit);
  const n = Math.min(50, Math.max(1, Number.isInteger(parsedLimit) ? parsedLimit : 10));

  let query = `SELECT t.id, t.date, t.amount, t.counterparty, t.purpose, t.category_id FROM transactions t`;
  const where = [];
  const params = [];
  if (type === 'expense') where.push('t.amount < 0');
  else if (type === 'income') where.push('t.amount > 0');
  if (from) {
    where.push(`${dateCol} >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`${dateCol} <= ?`);
    params.push(to);
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ` ORDER BY ABS(t.amount) DESC LIMIT ${n}`;

  res.json(db.prepare(query).all(...params));
});

// Kategorisierte Buchungen werden netto je Kategorie verrechnet (Erstattungen
// mindern die Ausgaben), damit die Beträge mit der Kategorien-Tabelle
// (category-summary, vorzeichenbehaftete Summen) übereinstimmen. Nur "Nicht
// kategorisiert" bleibt vorzeichen-gesplittet, weil dort unabhängige Einnahmen
// und Ausgaben zusammenfallen und sich nicht sinnvoll saldieren lassen.
function byCategoryTotals(from, to, field) {
  const dateCol = dateColumn(field, 't');
  let query = `
    SELECT c.id AS category_id, c.name, c.color,
           SUM(t.amount) AS net,
           SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) AS gross_expense
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
  `;
  const params = [];
  const where = [];
  if (from) {
    where.push(`${dateCol} >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`${dateCol} <= ?`);
    params.push(to);
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' GROUP BY t.category_id';

  return db
    .prepare(query)
    .all(...params)
    .map((r) => ({
      category_id: r.category_id,
      name: r.name || 'Nicht kategorisiert',
      color: r.color,
      total: r.category_id == null ? r.gross_expense || 0 : -(r.net || 0),
    }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total);
}

router.get('/reports/by-category', (req, res) => {
  res.json(byCategoryTotals(req.query.from, req.query.to, req.query.field));
});

// Gleiche Netto-Semantik wie byCategoryTotals: eine Kategorie zählt in dem
// Monat als Ausgabe (bzw. Einnahme), in dem ihr Monats-Netto negativ (bzw.
// positiv) ist; Erstattungen mindern also den Ausgabenbalken statt als
// separate Einnahme aufzutauchen.
function categoryMonthlyTotals(type, from, to, field) {
  const dateCol = dateColumn(field, 't');

  let query = `
    SELECT substr(${dateCol}, 1, 7) AS month, c.id AS category_id, c.name, c.color,
           SUM(t.amount) AS net,
           SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END) AS gross_income,
           SUM(CASE WHEN t.amount < 0 THEN -t.amount ELSE 0 END) AS gross_expense
    FROM transactions t
    LEFT JOIN categories c ON c.id = t.category_id
  `;
  const params = [];
  const where = [];
  if (from) {
    where.push(`${dateCol} >= ?`);
    params.push(from);
  }
  if (to) {
    where.push(`${dateCol} <= ?`);
    params.push(to);
  }
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' GROUP BY month, t.category_id ORDER BY month ASC';

  const sign = type === 'income' ? 1 : -1;
  return db
    .prepare(query)
    .all(...params)
    .map((r) => ({
      month: r.month,
      category_id: r.category_id,
      name: r.name || 'Nicht kategorisiert',
      color: r.color,
      total:
        r.category_id == null
          ? (type === 'income' ? r.gross_income : r.gross_expense) || 0
          : sign * (r.net || 0),
    }))
    .filter((r) => r.total > 0);
}

router.get('/reports/by-category-monthly', (req, res) => {
  const { type, from, to, field } = req.query;
  if (type !== 'income' && type !== 'expense') {
    return res.status(400).json({ error: 'type must be "income" or "expense"' });
  }
  res.json(categoryMonthlyTotals(type, from, to, field));
});

function categorySummary(rollup, field) {
  const months = lastNMonths(12);
  const months24 = lastNMonths(24);
  const currentMonth = months[months.length - 1];
  const currentYear = currentMonth.slice(0, 4);
  const prevYearMonth = shiftMonth(currentMonth, -12);
  const dateCol = dateColumn(field);

  const allTimeRows = db
    .prepare(
      `SELECT c.id AS category_id, c.name, c.parent_id, c.color, c.icon, c.mode, SUM(t.amount) AS total
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       GROUP BY c.id`
    )
    .all();

  const yearRows = db
    .prepare(
      `SELECT category_id, SUM(amount) AS total
       FROM transactions
       WHERE category_id IS NOT NULL AND substr(${dateCol}, 1, 4) = ?
       GROUP BY category_id`
    )
    .all(currentYear);

  const prevYearMonthRows = db
    .prepare(
      `SELECT category_id, SUM(amount) AS total
       FROM transactions
       WHERE category_id IS NOT NULL AND substr(${dateCol}, 1, 7) = ?
       GROUP BY category_id`
    )
    .all(prevYearMonth);

  const monthlyRows = db
    .prepare(
      `SELECT substr(${dateCol}, 1, 7) AS month, category_id, SUM(amount) AS total
       FROM transactions
       WHERE category_id IS NOT NULL AND ${dateCol} >= ? AND substr(${dateCol}, 1, 7) <= ?
       GROUP BY month, category_id`
    )
    .all(`${months24[0]}-01`, currentMonth);

  const monthlyByCategory = new Map();
  for (const row of monthlyRows) {
    if (!monthlyByCategory.has(row.category_id)) monthlyByCategory.set(row.category_id, new Map());
    monthlyByCategory.get(row.category_id).set(row.month, row.total || 0);
  }
  const yearByCategory = new Map(yearRows.map((r) => [r.category_id, r.total || 0]));
  const prevYearMonthByCategory = new Map(prevYearMonthRows.map((r) => [r.category_id, r.total || 0]));

  // Nur wenn der Rollup-Filter aktiv ist, Unterkategorie-Beträge zusätzlich
  // auf ihre Top-Kategorie umlegen (Verschachtelung ist max. 1 Ebene tief).
  let rolledMonthlyByCategory = new Map();
  let rolledYearByCategory = new Map();
  let rolledPrevYearMonthByCategory = new Map();
  if (rollup) {
    const parentByCategory = new Map(allTimeRows.map((r) => [r.category_id, r.parent_id]));
    const topIdOf = (categoryId) => parentByCategory.get(categoryId) ?? categoryId;

    for (const row of monthlyRows) {
      const topId = topIdOf(row.category_id);
      if (!rolledMonthlyByCategory.has(topId)) rolledMonthlyByCategory.set(topId, new Map());
      const rolledMonths = rolledMonthlyByCategory.get(topId);
      rolledMonths.set(row.month, (rolledMonths.get(row.month) || 0) + (row.total || 0));
    }

    const rollUpTotals = (rows) => {
      const rolled = new Map();
      for (const r of rows) {
        const topId = topIdOf(r.category_id);
        rolled.set(topId, (rolled.get(topId) || 0) + (r.total || 0));
      }
      return rolled;
    };
    rolledYearByCategory = rollUpTotals(yearRows);
    rolledPrevYearMonthByCategory = rollUpTotals(prevYearMonthRows);
  }

  function trendPct(monthlyMap, monthList, windowSize) {
    if (windowSize < 2) return 0;
    const half = windowSize / 2;
    const windowMonths = monthList.slice(monthList.length - windowSize);
    const sumAbs = (monthListSlice) => monthListSlice.reduce((acc, m) => acc + Math.abs(monthlyMap.get(m) || 0), 0);
    const olderAbs = sumAbs(windowMonths.slice(0, half));
    const recentAbs = sumAbs(windowMonths.slice(half));
    return pctChange(recentAbs, olderAbs);
  }

  // Die Buchungshistorie reicht oft (noch) nicht 24 Monate zurück; dann zählt
  // einfach das Maximum verfügbarer Monate (auf eine gerade Zahl abgerundet,
  // damit beide Vergleichshälften gleich groß bleiben), statt fehlende
  // Monate als 0 in den Trend einzurechnen.
  const earliestTx = db.prepare(`SELECT MIN(${dateCol}) AS d FROM transactions`).get();
  const earliestDataMonth = earliestTx.d ? earliestTx.d.slice(0, 7) : currentMonth;
  let availableMonths = 0;
  for (let m = currentMonth; m >= earliestDataMonth && availableMonths < 24; m = shiftMonth(m, -1)) {
    availableMonths++;
  }
  const trend24Window = availableMonths - (availableMonths % 2);

  const categories = allTimeRows.map((r) => {
    const useRollup = rollup && r.parent_id == null;
    const sources = useRollup
      ? { monthly: rolledMonthlyByCategory, year: rolledYearByCategory, prevYearMonth: rolledPrevYearMonthByCategory }
      : { monthly: monthlyByCategory, year: yearByCategory, prevYearMonth: prevYearMonthByCategory };
    const monthlyMap = sources.monthly.get(r.category_id) || new Map();
    const yearTotal = sources.year.get(r.category_id);
    const prevYearMonthTotal = sources.prevYearMonth.get(r.category_id);

    const monthly = months.map((m) => Math.round((monthlyMap.get(m) || 0) * 100) / 100);
    const monthly24 = months24.map((m) => Math.round((monthlyMap.get(m) || 0) * 100) / 100);
    const sumLast12 = monthly.reduce((acc, v) => acc + v, 0);
    // Ø nur über tatsächlich vorhandene Monate: bei kürzerer Historie würde
    // ein fixer 12er-Teiler den Durchschnitt systematisch unterschätzen
    // (betrifft auch Investitions-Prognose und Restbudget).
    const avgWindow = Math.min(12, Math.max(1, availableMonths));

    return {
      category_id: r.category_id,
      name: r.name,
      parent_id: r.parent_id,
      color: r.color,
      icon: r.icon,
      mode: r.mode,
      total_prev_year_month: Math.round((prevYearMonthTotal || 0) * 100) / 100,
      total_year: Math.round((yearTotal || 0) * 100) / 100,
      total_prev_month: monthly[monthly.length - 2],
      total_month: monthly[monthly.length - 1],
      avg_per_month: Math.round((sumLast12 / avgWindow) * 100) / 100,
      trend_1m_pct: trendPct(monthlyMap, months, 2),
      trend_6m_pct: trendPct(monthlyMap, months, 6),
      trend_12m_pct: trendPct(monthlyMap, months, 12),
      trend_24m_pct: trendPct(monthlyMap, months24, trend24Window),
      monthly,
      monthly24,
    };
  });

  return { months, categories };
}

router.get('/reports/category-summary', (req, res) => {
  const rollup = req.query.rollup === '1' || req.query.rollup === 'true';
  res.json(categorySummary(rollup, req.query.field));
});

// KPI-Daten für den laufenden Monat. Prognosebasiert: wiederkehrende
// Kategorien werden mit ihrem Ø vergangener vollständiger Monate in den
// Restmonat fortgeschrieben, der Puffer (Settings) wird abgezogen.
router.get('/reports/month-status', (req, res) => {
  const month = lastNMonths(1)[0];
  const prevMonth = shiftMonth(month, -1);

  const start = db
    .prepare("SELECT * FROM balance_anchors WHERE type = 'start' ORDER BY date ASC LIMIT 1")
    .get();
  const currentBalance = start
    ? Math.round(
        (start.balance +
          db.prepare('SELECT COALESCE(SUM(amount), 0) AS total FROM transactions WHERE date >= ?').get(start.date)
            .total) *
          100
      ) / 100
    : null;

  const buffer = db.prepare('SELECT buffer FROM settings WHERE id = 1').get()?.buffer ?? 0;

  // Ø nur über vollständige Monate (max. 12): der angebrochene laufende Monat
  // würde den Durchschnitt sonst systematisch nach unten ziehen.
  const earliestMonth = db.prepare('SELECT MIN(substr(date, 1, 7)) AS m FROM transactions').get().m;
  let completeMonths = 0;
  if (earliestMonth && earliestMonth <= prevMonth) {
    for (let m = prevMonth; m >= earliestMonth && completeMonths < 12; m = shiftMonth(m, -1)) {
      completeMonths++;
    }
  }

  const recurringCategories = [];
  if (completeMonths > 0) {
    const fromMonth = shiftMonth(month, -completeMonths);
    const avgRows = db
      .prepare(
        `SELECT t.category_id, SUM(t.amount) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE c.mode = 'recurring' AND substr(t.date, 1, 7) >= ? AND substr(t.date, 1, 7) <= ?
         GROUP BY t.category_id`
      )
      .all(fromMonth, prevMonth);
    const mtdRows = db
      .prepare(
        `SELECT t.category_id, SUM(t.amount) AS total
         FROM transactions t
         JOIN categories c ON c.id = t.category_id
         WHERE c.mode = 'recurring' AND substr(t.date, 1, 7) = ?
         GROUP BY t.category_id`
      )
      .all(month);
    const mtdByCategory = new Map(mtdRows.map((r) => [r.category_id, r.total || 0]));
    for (const r of avgRows) {
      recurringCategories.push({
        avg: (r.total || 0) / completeMonths,
        mtd: mtdByCategory.get(r.category_id) || 0,
      });
    }
  }

  const expected = computeExpectedRemaining(recurringCategories);

  const mtd = db
    .prepare(
      `SELECT SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) AS income,
              SUM(CASE WHEN amount < 0 THEN -amount ELSE 0 END) AS expense
       FROM transactions WHERE substr(date, 1, 7) = ?`
    )
    .get(month);

  const uncategorizedCount = db
    .prepare('SELECT COUNT(*) AS n FROM transactions WHERE category_id IS NULL')
    .get().n;

  res.json({
    month,
    currentBalance,
    buffer,
    expectedRemainingIncome: expected.income,
    expectedRemainingExpense: expected.expense,
    remainingBudget: computeRemainingBudget({
      currentBalance,
      buffer,
      expectedRemainingIncome: expected.income,
      expectedRemainingExpense: expected.expense,
    }),
    mtdIncome: Math.round((mtd.income || 0) * 100) / 100,
    mtdExpense: Math.round((mtd.expense || 0) * 100) / 100,
    uncategorizedCount,
  });
});

// Buchungen, die deutlich über dem Kategorie-Ø liegen (siehe lib/anomalies.js).
// Fenster standardmäßig 12 Monate, deckungsgleich mit avg_per_month, damit
// "Ø" in der App überall dieselbe Zeitspanne meint.
router.get('/reports/anomalies', (req, res) => {
  const months = Number(req.query.months) || 12;
  const threshold = Number(req.query.threshold) || 2;
  const fromMonth = lastNMonths(months)[0];

  const rows = db
    .prepare(
      `SELECT id, date, amount, counterparty, purpose, category_id
       FROM transactions
       WHERE category_id IS NOT NULL AND substr(date, 1, 7) >= ?`
    )
    .all(fromMonth);

  res.json(findAnomalies(rows, { threshold }));
});

// Erkannte Abos/Daueraufträge (siehe lib/subscriptions.js). Fenster
// standardmäßig 12 Monate, wie bei anomalies/avg_per_month.
router.get('/reports/subscriptions', (req, res) => {
  const months = Number(req.query.months) || 12;
  const fromMonth = lastNMonths(months)[0];

  const rows = db
    .prepare(`SELECT id, date, amount, counterparty, category_id FROM transactions WHERE substr(date, 1, 7) >= ?`)
    .all(fromMonth);

  res.json(findRecurringPayments(rows));
});

router.get('/reports/compare', (req, res) => {
  const { month, field } = req.query;
  if (!month) return res.status(400).json({ error: 'month required (YYYY-MM)' });

  const previousMonth = shiftMonth(month, -1);
  const previousYear = shiftMonth(month, -12);

  const totals = monthlyTotals(previousYear, month, field).reduce((acc, r) => {
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
