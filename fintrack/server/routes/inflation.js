const express = require('express');
const db = require('../db');
const { shiftMonth, lastNMonths, monthsBetween, pctChange } = require('../lib/dates');
const { COICOP_CODES, COICOP_LABELS, getOfficialRates } = require('../services/eurostat');

const router = express.Router();

function personalMonthlySpend(fromMonth, toMonth) {
  const rows = db
    .prepare(
      `SELECT substr(t.date, 1, 7) AS month, SUM(-t.amount) AS total
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.amount < 0 AND c.mode = 'recurring'
         AND substr(t.date, 1, 7) >= ? AND substr(t.date, 1, 7) <= ?
       GROUP BY month`
    )
    .all(fromMonth, toMonth);
  return new Map(rows.map((r) => [r.month, r.total || 0]));
}

function personalMonthlySpendByCoicop(fromMonth, toMonth) {
  const rows = db
    .prepare(
      `SELECT substr(t.date, 1, 7) AS month, c.coicop_code AS coicop, SUM(-t.amount) AS total
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.amount < 0 AND c.mode = 'recurring' AND c.coicop_code IS NOT NULL
         AND substr(t.date, 1, 7) >= ? AND substr(t.date, 1, 7) <= ?
       GROUP BY month, coicop`
    )
    .all(fromMonth, toMonth);
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.coicop)) result.set(row.coicop, new Map());
    result.get(row.coicop).set(row.month, row.total || 0);
  }
  return result;
}

function categoryNamesByCoicop() {
  const rows = db
    .prepare("SELECT coicop_code, name FROM categories WHERE coicop_code IS NOT NULL ORDER BY name ASC")
    .all();
  const result = new Map();
  for (const row of rows) {
    if (!result.has(row.coicop_code)) result.set(row.coicop_code, []);
    result.get(row.coicop_code).push(row.name);
  }
  return result;
}

function rollingSum(monthlyMap, months) {
  return months.reduce((acc, m) => acc + (monthlyMap.get(m) || 0), 0);
}

// Rollierende 12-Monats-Summe statt Einzelmonat-YoY, um unregelmäßige
// wiederkehrende Zahlungen (z. B. jährliche Versicherungsbeiträge) zu glätten.
function personalRateSeries(monthsOut) {
  const lastMonth = monthsOut[monthsOut.length - 1];
  const rangeFrom = shiftMonth(monthsOut[0], -24);
  const monthlyMap = personalMonthlySpend(rangeFrom, lastMonth);

  return monthsOut.map((m) => {
    const recent = rollingSum(monthlyMap, monthsBetween(shiftMonth(m, -11), m));
    const prior = rollingSum(monthlyMap, monthsBetween(shiftMonth(m, -23), shiftMonth(m, -12)));
    return { month: m, personalRateYoy: pctChange(recent, prior) };
  });
}

// Snapshot statt Zeitreihe: aktuelle 12 vs. vorherige 12 Monate je COICOP-Gruppe.
// Beträge mehrerer Kategorien mit demselben Code werden in der SQL-Gruppierung
// bereits summiert, bevor hier die Rate berechnet wird (nie Raten mitteln).
function personalRateByCoicop(currentMonth) {
  const rangeFrom = shiftMonth(currentMonth, -23);
  const byCoicop = personalMonthlySpendByCoicop(rangeFrom, currentMonth);
  const recentMonths = monthsBetween(shiftMonth(currentMonth, -11), currentMonth);
  const priorMonths = monthsBetween(shiftMonth(currentMonth, -23), shiftMonth(currentMonth, -12));

  const result = new Map();
  for (const [coicop, monthlyMap] of byCoicop) {
    const recent = rollingSum(monthlyMap, recentMonths);
    const prior = rollingSum(monthlyMap, priorMonths);
    result.set(coicop, pctChange(recent, prior));
  }
  return result;
}

router.get('/inflation/headline', async (req, res, next) => {
  try {
    const months = Number(req.query.months) || 24;
    const monthsOut = lastNMonths(months);
    const personal = personalRateSeries(monthsOut);
    const official = await getOfficialRates(['CP00'], monthsOut);
    const officialMap = official.get('CP00') || new Map();

    res.json(
      personal.map((p) => ({
        month: p.month,
        personalRateYoy: p.personalRateYoy,
        officialRateYoy: officialMap.has(p.month) ? officialMap.get(p.month) : null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/inflation/breakdown', async (req, res, next) => {
  try {
    const namesByCoicop = categoryNamesByCoicop();
    const codes = [...namesByCoicop.keys()];
    if (!codes.length) return res.json([]);

    const currentMonth = lastNMonths(1)[0];
    const personalByCoicop = personalRateByCoicop(currentMonth);
    const official = await getOfficialRates(codes, [currentMonth]);

    res.json(
      codes.map((coicop) => ({
        coicop,
        label: COICOP_LABELS[coicop] || coicop,
        categoryNames: namesByCoicop.get(coicop) || [],
        personalRateYoy: personalByCoicop.has(coicop) ? personalByCoicop.get(coicop) : null,
        officialRateYoy: official.get(coicop)?.get(currentMonth) ?? null,
      }))
    );
  } catch (err) {
    next(err);
  }
});

router.get('/inflation/meta', (req, res) => {
  res.json({ codes: COICOP_CODES.map((code) => ({ code, label: COICOP_LABELS[code] })) });
});

module.exports = router;
