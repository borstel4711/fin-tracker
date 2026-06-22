const express = require('express');
const multer = require('multer');
const db = require('../db');
const { parseCsv, normalizeRows } = require('../import');
const { categorize } = require('../rules/categorize');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

router.post('/import', upload.single('file'), (req, res) => {
  const profileId = Number(req.body.profile_id);
  if (!req.file || !profileId) {
    return res.status(400).json({ error: 'file and profile_id required' });
  }

  const profile = db.prepare('SELECT * FROM import_profiles WHERE id = ?').get(profileId);
  if (!profile) return res.status(404).json({ error: 'profile not found' });

  const rawRows = parseCsv(req.file.buffer, profile);
  const rows = normalizeRows(rawRows, profile);

  const insertBatch = db.prepare(
    `INSERT INTO import_batches (profile_id, filename, imported_at, row_count, inserted, skipped)
     VALUES (?, ?, ?, ?, 0, 0)`
  );
  const batchInfo = insertBatch.run(
    profileId,
    req.file.originalname,
    new Date().toISOString(),
    rows.length
  );
  const batchId = batchInfo.lastInsertRowid;

  const insertTx = db.prepare(`
    INSERT INTO transactions
      (date, amount, type, counterparty, purpose, category_id, category_src, source_file, import_batch, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const existsStmt = db.prepare('SELECT 1 FROM transactions WHERE hash = ?');

  let inserted = 0;
  let skipped = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      if (existsStmt.get(row.hash)) {
        skipped += 1;
        continue;
      }
      const { category_id, category_src } = categorize(row);
      insertTx.run(
        row.date,
        row.amount,
        row.type,
        row.counterparty,
        row.purpose,
        category_id,
        category_src,
        req.file.originalname,
        batchId,
        row.hash
      );
      inserted += 1;
    }
  });
  run();

  db.prepare('UPDATE import_batches SET inserted = ?, skipped = ? WHERE id = ?').run(
    inserted,
    skipped,
    batchId
  );

  res.json({ batch_id: batchId, row_count: rows.length, inserted, skipped });
});

router.get('/import/batches', (req, res) => {
  const batches = db
    .prepare(
      `SELECT b.*, p.name AS profile_name FROM import_batches b
       LEFT JOIN import_profiles p ON p.id = b.profile_id
       ORDER BY b.imported_at DESC`
    )
    .all();
  res.json(batches);
});

module.exports = router;
