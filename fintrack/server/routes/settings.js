const express = require('express');
const db = require('../db');

const router = express.Router();

router.get('/settings', (req, res) => {
  res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get());
});

router.put('/settings', (req, res) => {
  const { buffer } = req.body;
  if (buffer == null || Number.isNaN(Number(buffer))) {
    return res.status(400).json({ error: 'buffer required' });
  }
  db.prepare('UPDATE settings SET buffer = ? WHERE id = 1').run(Number(buffer));
  res.json(db.prepare('SELECT * FROM settings WHERE id = 1').get());
});

module.exports = router;
