const express = require('express');
const multer = require('multer');
const db = require('../db');
const { parseCsv, normalizeRows } = require('../import');
const { categorize } = require('../rules/categorize');
const { findLatestBalanceRow } = require('../lib/csvCheckpoint');
const { log, logError } = require('../log');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

// Nur Anker mit source='csv' werden hier automatisch verwaltet — ein manuell
// gesetzter Anker (source='manual') am selben Datum hat Vorrang und wird nie
// überschrieben. Ohne Saldo-Spalte im Profil (findLatestBalanceRow -> null)
// passiert nichts.
function upsertCsvCheckpoint(rows) {
  const latest = findLatestBalanceRow(rows);
  if (!latest) return null;

  const manualAtDate = db
    .prepare("SELECT id FROM balance_anchors WHERE date = ? AND source != 'csv'")
    .get(latest.date);
  if (manualAtDate) return null;

  const existingCsv = db
    .prepare("SELECT id FROM balance_anchors WHERE date = ? AND source = 'csv'")
    .get(latest.date);
  if (existingCsv) {
    db.prepare('UPDATE balance_anchors SET balance = ? WHERE id = ?').run(latest.balance, existingCsv.id);
    return { date: latest.date, balance: latest.balance, created: false };
  }

  db.prepare(
    `INSERT INTO balance_anchors (date, balance, type, source, note)
     VALUES (?, ?, 'checkpoint', 'csv', 'Automatisch aus CSV-Import')`
  ).run(latest.date, latest.balance);
  return { date: latest.date, balance: latest.balance, created: true };
}

router.post('/import', upload.single('file'), (req, res) => {
  const profileId = Number(req.body.profile_id);
  if (!req.file || !profileId) {
    return res.status(400).json({ error: 'file and profile_id required' });
  }

  const profile = db.prepare('SELECT * FROM import_profiles WHERE id = ?').get(profileId);
  if (!profile) return res.status(404).json({ error: 'profile not found' });

  let rawRows, rows;
  try {
    rawRows = parseCsv(req.file.buffer, profile);
    rows = normalizeRows(rawRows, profile);
  } catch (err) {
    logError(
      `Import failed for profile "${profile.name}" (file "${req.file.originalname}"):`,
      err.stack || err
    );
    return res.status(400).json({ error: `CSV konnte nicht gelesen werden: ${err.message}` });
  }

  if (rawRows.length > 0 && rows.length === 0) {
    logError(
      `Import for profile "${profile.name}" (file "${req.file.originalname}"): ${rawRows.length} Zeile(n) gelesen, aber 0 davon gueltig normalisiert. Vermutlich falsche Spaltennamen oder skip_rows im Profil.`
    );
  }

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
      (date, value_date, amount, type, counterparty, purpose, category_id, category_src, source_file, import_batch, hash)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const existsStmt = db.prepare('SELECT id, value_date FROM transactions WHERE hash = ?');
  const fillValueDateStmt = db.prepare('UPDATE transactions SET value_date = ? WHERE id = ?');

  let inserted = 0;
  let skipped = 0;
  let valueDateFilled = 0;

  const run = db.transaction(() => {
    for (const row of rows) {
      const existing = existsStmt.get(row.hash);
      if (existing) {
        skipped += 1;
        // Dublettenerkennung hasht nur date/amount/counterparty/purpose, nicht
        // value_date. Ein erneuter Import (z.B. nach Korrektur des Profils)
        // soll daher fehlende Wertstellung an bereits vorhandenen Buchungen
        // nachtragen, statt sie endlos NULL zu lassen.
        if (existing.value_date == null && row.value_date != null) {
          fillValueDateStmt.run(row.value_date, existing.id);
          valueDateFilled += 1;
        }
        continue;
      }
      const { category_id, category_src } = categorize(row);
      insertTx.run(
        row.date,
        row.value_date,
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

  const csvCheckpoint = upsertCsvCheckpoint(rows);

  log(
    `Import done: profile "${profile.name}", file "${req.file.originalname}" -> ${inserted} neu, ${skipped} Dubletten` +
      (valueDateFilled ? `, ${valueDateFilled} Wertstellung(en) nachgetragen` : '') +
      (csvCheckpoint ? `, Checkpoint ${csvCheckpoint.date} = ${csvCheckpoint.balance} aus CSV-Saldo` : '') +
      ` (von ${rows.length} Zeilen)`
  );

  res.json({
    batch_id: batchId,
    row_count: rows.length,
    inserted,
    skipped,
    value_date_filled: valueDateFilled,
    csv_checkpoint: csvCheckpoint,
  });
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
