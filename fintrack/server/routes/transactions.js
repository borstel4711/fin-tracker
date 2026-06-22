const express = require('express');
const db = require('../db');
const { learn } = require('../rules/categorize');

const router = express.Router();

router.get('/transactions', (req, res) => {
  const { from, to, category, uncategorized } = req.query;
  const where = [];
  const params = [];
  if (from) {
    where.push('date >= ?');
    params.push(from);
  }
  if (to) {
    where.push('date <= ?');
    params.push(to);
  }
  if (uncategorized === 'true') {
    where.push('category_id IS NULL');
  } else if (category) {
    where.push('category_id = ?');
    params.push(Number(category));
  }

  let query = 'SELECT * FROM transactions';
  if (where.length) query += ' WHERE ' + where.join(' AND ');
  query += ' ORDER BY date DESC, id DESC';

  res.json(db.prepare(query).all(...params));
});

router.patch('/transactions/:id', (req, res) => {
  const { category_id } = req.body;
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(req.params.id);
  if (!tx) return res.status(404).json({ error: 'not found' });

  db.prepare("UPDATE transactions SET category_id = ?, category_src = 'manual' WHERE id = ?").run(
    category_id,
    req.params.id
  );

  if (category_id != null) {
    learn(tx.counterparty, category_id);
  }

  res.json({ ...tx, category_id, category_src: 'manual' });
});

module.exports = router;
