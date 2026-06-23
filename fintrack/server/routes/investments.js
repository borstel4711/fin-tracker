const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/investments', (req, res) => {
  res.json(db.prepare('SELECT * FROM investments ORDER BY priority ASC, id ASC').all());
});

router.post('/investments', (req, res) => {
  const { name, amount, priority = 100 } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (amount == null || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  const info = db
    .prepare('INSERT INTO investments (name, amount, priority) VALUES (?, ?, ?)')
    .run(name, Number(amount), Number(priority));
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/investments/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM investments WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...existing, ...req.body };
  if (!merged.name) return res.status(400).json({ error: 'name required' });
  if (merged.amount == null || Number.isNaN(Number(merged.amount)) || Number(merged.amount) <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number' });
  }
  db.prepare('UPDATE investments SET name = ?, amount = ?, priority = ? WHERE id = ?').run(
    merged.name,
    Number(merged.amount),
    Number(merged.priority),
    req.params.id
  );
  res.json(merged);
});

router.delete('/investments/:id', (req, res) => {
  db.prepare('DELETE FROM investments WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
