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
    return res.json({ start: null, series: [], checkpoints: [] });
  }

  const transactions = db
    .prepare('SELECT date, amount FROM transactions WHERE date >= ? ORDER BY date ASC')
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

  const computedAt = (date) => {
    let total = start.balance;
    for (const tx of transactions) {
      if (tx.date <= date) total += tx.amount;
      else break;
    }
    return total;
  };

  const checkpoints = checkpointAnchors
    .filter((a) => (!from || a.date >= from) && (!to || a.date <= to))
    .map((a) => {
      const computed = computedAt(a.date);
      return { ...a, computed, diff: Math.round((a.balance - computed) * 100) / 100 };
    });

  res.json({ start, series, checkpoints });
});

module.exports = router;
