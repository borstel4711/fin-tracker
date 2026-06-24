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

function earliestRecurringExpenseMonth() {
  const row = db
    .prepare(
      `SELECT MIN(t.date) AS d
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.amount < 0 AND c.mode = 'recurring'`
    )
    .get();
  return row.d ? row.d.slice(0, 7) : null;
}

function earliestExpenseMonthByCoicop() {
  const rows = db
    .prepare(
      `SELECT c.coicop_code AS coicop, MIN(t.date) AS d
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.amount < 0 AND c.mode = 'recurring' AND c.coicop_code IS NOT NULL
       GROUP BY coicop`
    )
    .all();
  return new Map(rows.map((r) => [r.coicop, r.d.slice(0, 7)]));
}

// Rollierende 12-Monats-Summe statt Einzelmonat-YoY, um unregelmäßige
// wiederkehrende Zahlungen (z. B. jährliche Versicherungsbeiträge) zu glätten.
// Liefert null, wenn das Vorjahresfenster nicht vollständig von echten
// Buchungsdaten abgedeckt ist — sonst zählen fehlende Monate als 0 € und die
// Rate explodiert künstlich (z. B. 12 Monate echte Ausgaben gegen 1 Monat
// echte Ausgaben ergibt ~1100 % statt einer sinnvollen Aussage).
function personalRateSeries(monthsOut) {
  const lastMonth = monthsOut[monthsOut.length - 1];
  const rangeFrom = shiftMonth(monthsOut[0], -24);
  const monthlyMap = personalMonthlySpend(rangeFrom, lastMonth);
  const earliestMonth = earliestRecurringExpenseMonth();

  return monthsOut.map((m) => {
    const priorStart = shiftMonth(m, -23);
    if (!earliestMonth || priorStart < earliestMonth) {
      return { month: m, personalRateYoy: null };
    }
    const recent = rollingSum(monthlyMap, monthsBetween(shiftMonth(m, -11), m));
    const prior = rollingSum(monthlyMap, monthsBetween(priorStart, shiftMonth(m, -12)));
    return { month: m, personalRateYoy: pctChange(recent, prior) };
  });
}

// Snapshot statt Zeitreihe: aktuelle 12 vs. vorherige 12 Monate je COICOP-Gruppe.
// Beträge mehrerer Kategorien mit demselben Code werden in der SQL-Gruppierung
// bereits summiert, bevor hier die Rate berechnet wird (nie Raten mitteln).
// Gruppen ohne ausreichende Historie werden ausgelassen, die Route liefert
// dafür dann null (gleicher Grund wie bei personalRateSeries oben).
function personalRateByCoicop(currentMonth) {
  const priorStart = shiftMonth(currentMonth, -23);
  const earliestByCoicop = earliestExpenseMonthByCoicop();
  const byCoicop = personalMonthlySpendByCoicop(priorStart, currentMonth);
  const recentMonths = monthsBetween(shiftMonth(currentMonth, -11), currentMonth);
  const priorMonths = monthsBetween(priorStart, shiftMonth(currentMonth, -12));

  const result = new Map();
  for (const [coicop, monthlyMap] of byCoicop) {
    const earliestMonth = earliestByCoicop.get(coicop);
    if (!earliestMonth || priorStart < earliestMonth) continue;
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
