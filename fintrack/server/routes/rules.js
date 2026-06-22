const express = require('express');
const db = require('../db');
const { categorize } = require('../rules/categorize');

const router = express.Router();

router.get('/rules', (req, res) => {
  res.json(db.prepare('SELECT * FROM rules ORDER BY priority ASC, id ASC').all());
});

router.post('/rules', (req, res) => {
  const {
    match_field = 'counterparty',
    match_type = 'contains',
    pattern,
    category_id,
    priority = 100,
    enabled = 1,
  } = req.body;
  if (!pattern || !category_id) {
    return res.status(400).json({ error: 'pattern and category_id required' });
  }
  const info = db
    .prepare(
      `INSERT INTO rules (match_field, match_type, pattern, category_id, priority, enabled)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(match_field, match_type, pattern, category_id, priority, enabled ? 1 : 0);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/rules/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM rules WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE rules SET match_field = ?, match_type = ?, pattern = ?, category_id = ?, priority = ?, enabled = ?
     WHERE id = ?`
  ).run(
    merged.match_field,
    merged.match_type,
    merged.pattern,
    merged.category_id,
    merged.priority,
    merged.enabled ? 1 : 0,
    req.params.id
  );
  res.json(merged);
});

router.delete('/rules/:id', (req, res) => {
  db.prepare('DELETE FROM rules WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

router.post('/recategorize', (req, res) => {
  const rows = db.prepare('SELECT * FROM transactions').all();
  const update = db.prepare('UPDATE transactions SET category_id = ?, category_src = ? WHERE id = ?');
  let updated = 0;
  const run = db.transaction(() => {
    for (const tx of rows) {
      if (tx.category_src === 'manual') continue;
      const { category_id, category_src } = categorize(tx);
      if (category_id != null) {
        update.run(category_id, category_src, tx.id);
        updated += 1;
      }
    }
  });
  run();
  res.json({ updated });
});

module.exports = router;
