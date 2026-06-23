const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/balance/anchors', (req, res) => {
  res.json(db.prepare('SELECT * FROM balance_anchors ORDER BY date ASC').all());
});

router.post('/balance/anchors', (req, res) => {
  const { date, balance, type = 'checkpoint', source = 'manual', note } = req.body;
  if (!date || balance == null) {
    return res.status(400).json({ error: 'date and balance required' });
  }
  if (type === 'start') {
    const existingStart = db.prepare("SELECT id FROM balance_anchors WHERE type = 'start'").get();
    if (existingStart) {
      return res.status(409).json({ error: 'a start anchor already exists' });
    }
  }
  const info = db
    .prepare('INSERT INTO balance_anchors (date, balance, type, source, note) VALUES (?, ?, ?, ?, ?)')
    .run(date, balance, type, source, note || null);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/balance/anchors/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM balance_anchors WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...existing, ...req.body };
  if (!merged.date || merged.balance == null) {
    return res.status(400).json({ error: 'date and balance required' });
  }
  if (merged.type === 'start') {
    const otherStart = db
      .prepare("SELECT id FROM balance_anchors WHERE type = 'start' AND id != ?")
      .get(req.params.id);
    if (otherStart) {
      return res.status(409).json({ error: 'a start anchor already exists' });
    }
  }
  db.prepare('UPDATE balance_anchors SET date = ?, balance = ?, type = ?, note = ? WHERE id = ?').run(
    merged.date,
    merged.balance,
    merged.type,
    merged.note || null,
    req.params.id
  );
  res.json(merged);
});

router.get('/balance/series', (req, res) => {
  const { from, to } = req.query;
  const start = db
    .prepare("SELECT * FROM balance_anchors WHERE type = 'start' ORDER BY date ASC LIMIT 1")
    .get();
  if (!start) {
    return res.json({ start: null, series: [], checkpoints: [], forecastRates: { total: 0, recurring: 0 } });
  }

  const transactions = db
    .prepare(
      `SELECT t.date, t.amount, c.mode AS category_mode
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.date >= ?
       ORDER BY t.date ASC`
    )
    .all(start.date);

  let running = start.balance;
  const byDate = new Map();
  byDate.set(start.date, start.balance);
  for (const tx of transactions) {
    running += tx.amount;
    byDate.set(tx.date, running);
  }

  let series = Array.from(byDate.entries()).map(([date, balance]) => ({ date, balance }));
  if (from) series = series.filter((p) => p.date >= from);
  if (to) series = series.filter((p) => p.date <= to);

  const checkpointAnchors = db
    .prepare("SELECT * FROM balance_anchors WHERE type IN ('checkpoint', 'month_end') ORDER BY date ASC")
    .all();

  // Diff wird immer gegen den vorherigen Anker (eingetragener Saldo) ermittelt,
  // nicht gegen die kumulierte Summe seit dem Start-Anker. So bleibt die
  // Abweichung an jedem Stützpunkt nachvollziehbar und alte Korrekturen
  // schlagen nicht dauerhaft auf spätere Diffs durch.
  let prevAnchor = start;
  const checkpoints = checkpointAnchors.map((a) => {
    const sinceLastAnchor = transactions
      .filter((tx) => tx.date > prevAnchor.date && tx.date <= a.date)
      .reduce((sum, tx) => sum + tx.amount, 0);
    const computed = Math.round((prevAnchor.balance + sinceLastAnchor) * 100) / 100;
    const diff = Math.round((a.balance - computed) * 100) / 100;
    prevAnchor = a;
    return { ...a, computed, diff };
  });

  const filteredCheckpoints = checkpoints.filter(
    (a) => (!from || a.date >= from) && (!to || a.date <= to)
  );

  // Forecast-Raten basieren bewusst auf der vollen Historie (nicht auf dem
  // from/to-Anzeigefilter), damit der Trend nicht von einer kurz gewählten
  // Anzeigespanne verzerrt wird.
  const lastDate = transactions.length ? transactions[transactions.length - 1].date : start.date;
  const totalDays = Math.max(1, (new Date(lastDate) - new Date(start.date)) / 86400000);
  const totalChange = transactions.reduce((sum, t) => sum + t.amount, 0);
  const recurringChange = transactions
    .filter((t) => t.category_mode === 'recurring')
    .reduce((sum, t) => sum + t.amount, 0);

  res.json({
    start,
    series,
    checkpoints: filteredCheckpoints,
    forecastRates: {
      total: totalChange / totalDays,
      recurring: recurringChange / totalDays,
    },
  });
});

module.exports = router;
