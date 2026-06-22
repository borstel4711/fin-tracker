const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/profiles', (req, res) => {
  res.json(db.prepare('SELECT * FROM import_profiles ORDER BY name ASC').all());
});

router.post('/profiles', (req, res) => {
  const p = req.body;
  if (!p.name || !p.col_date) {
    return res.status(400).json({ error: 'name and col_date required' });
  }
  const info = db
    .prepare(
      `INSERT INTO import_profiles
        (name, delimiter, encoding, date_format, decimal_comma, skip_rows,
         col_date, col_amount, col_debit, col_credit, col_counterparty, col_purpose, col_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      p.name,
      p.delimiter || ';',
      p.encoding || 'latin1',
      p.date_format || 'DD.MM.YYYY',
      p.decimal_comma ?? 1,
      p.skip_rows ?? 0,
      p.col_date,
      p.col_amount || null,
      p.col_debit || null,
      p.col_credit || null,
      p.col_counterparty || null,
      p.col_purpose || null,
      p.col_balance || null
    );
  res.status(201).json({ id: info.lastInsertRowid });
});

router.patch('/profiles/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM import_profiles WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'not found' });
  const merged = { ...existing, ...req.body };
  db.prepare(
    `UPDATE import_profiles SET
       name = ?, delimiter = ?, encoding = ?, date_format = ?, decimal_comma = ?, skip_rows = ?,
       col_date = ?, col_amount = ?, col_debit = ?, col_credit = ?, col_counterparty = ?, col_purpose = ?, col_balance = ?
     WHERE id = ?`
  ).run(
    merged.name,
    merged.delimiter,
    merged.encoding,
    merged.date_format,
    merged.decimal_comma,
    merged.skip_rows,
    merged.col_date,
    merged.col_amount,
    merged.col_debit,
    merged.col_credit,
    merged.col_counterparty,
    merged.col_purpose,
    merged.col_balance,
    req.params.id
  );
  res.json(merged);
});

router.delete('/profiles/:id', (req, res) => {
  db.prepare('DELETE FROM import_profiles WHERE id = ?').run(req.params.id);
  res.status(204).end();
});

module.exports = router;
