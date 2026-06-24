const express = require('express');
const db = require('../db');
const { COICOP_CODES } = require('../services/eurostat');

const router = express.Router();

router.get('/categories', (req, res) => {
  res.json(db.prepare('SELECT * FROM categories ORDER BY name ASC').all());
});

function isValidCoicop(coicop_code) {
  return coicop_code === null || coicop_code === undefined || COICOP_CODES.includes(coicop_code);
}

router.post('/categories', (req, res) => {
  const { name, parent_id = null, color = null, icon = null, mode = 'recurring', coicop_code = null } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  if (!isValidCoicop(coicop_code)) return res.status(400).json({ error: 'invalid coicop_code' });
  const info = db
    .prepare('INSERT INTO categories (name, parent_id, color, icon, mode, coicop_code) VALUES (?, ?, ?, ?, ?, ?)')
    .run(name, parent_id, color, icon, mode, coicop_code);
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/categories/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM categories WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  if (!isValidCoicop(req.body.coicop_code)) return res.status(400).json({ error: 'invalid coicop_code' });
  const merged = { ...existing, ...req.body };
  db.prepare(
    'UPDATE categories SET name = ?, parent_id = ?, color = ?, icon = ?, mode = ?, coicop_code = ? WHERE id = ?'
  ).run(merged.name, merged.parent_id, merged.color, merged.icon, merged.mode, merged.coicop_code, req.params.id);
  res.json(merged);
});

const deleteCategoryCascade = db.transaction((id) => {
  db.prepare('UPDATE transactions SET category_id = NULL, category_src = NULL WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM rules WHERE category_id = ?').run(id);
  db.prepare('DELETE FROM learned_map WHERE category_id = ?').run(id);
  db.prepare('UPDATE categories SET parent_id = NULL WHERE parent_id = ?').run(id);
  db.prepare('DELETE FROM categories WHERE id = ?').run(id);
});

router.delete('/categories/:id', (req, res) => {
  deleteCategoryCascade(req.params.id);
  res.status(204).end();
});

module.exports = router;
