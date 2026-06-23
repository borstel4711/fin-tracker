const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');
const { log } = require('./log');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data', 'fintrack.db');
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
log(`Opening database at ${DB_PATH}`);

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id        INTEGER PRIMARY KEY,
  name      TEXT NOT NULL,
  parent_id INTEGER REFERENCES categories(id),
  color     TEXT
);

CREATE TABLE IF NOT EXISTS import_profiles (
  id               INTEGER PRIMARY KEY,
  name             TEXT NOT NULL,
  delimiter        TEXT NOT NULL DEFAULT ';',
  encoding         TEXT NOT NULL DEFAULT 'latin1',
  date_format      TEXT NOT NULL DEFAULT 'DD.MM.YYYY',
  decimal_comma    INTEGER NOT NULL DEFAULT 1,
  skip_rows        INTEGER NOT NULL DEFAULT 0,
  col_date         TEXT NOT NULL,
  col_value_date   TEXT,
  col_amount       TEXT,
  col_debit        TEXT,
  col_credit       TEXT,
  col_counterparty TEXT,
  col_purpose      TEXT,
  col_balance      TEXT
);

CREATE TABLE IF NOT EXISTS rules (
  id          INTEGER PRIMARY KEY,
  match_field TEXT NOT NULL DEFAULT 'counterparty',
  match_type  TEXT NOT NULL DEFAULT 'contains',
  pattern     TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  priority    INTEGER NOT NULL DEFAULT 100,
  enabled     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS import_batches (
  id          INTEGER PRIMARY KEY,
  profile_id  INTEGER REFERENCES import_profiles(id),
  filename    TEXT,
  imported_at TEXT NOT NULL,
  row_count   INTEGER,
  inserted    INTEGER,
  skipped     INTEGER
);

CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY,
  date         TEXT NOT NULL,
  value_date   TEXT,
  amount       REAL NOT NULL,
  type         TEXT NOT NULL,
  counterparty TEXT,
  purpose      TEXT,
  category_id  INTEGER REFERENCES categories(id),
  category_src TEXT,
  source_file  TEXT,
  import_batch INTEGER REFERENCES import_batches(id),
  hash         TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS learned_map (
  id          INTEGER PRIMARY KEY,
  norm_key    TEXT NOT NULL UNIQUE,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  hits        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS balance_anchors (
  id      INTEGER PRIMARY KEY,
  date    TEXT NOT NULL,
  balance REAL NOT NULL,
  type    TEXT NOT NULL DEFAULT 'checkpoint',
  source  TEXT NOT NULL DEFAULT 'manual',
  note    TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id     INTEGER PRIMARY KEY CHECK (id = 1),
  buffer REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS investments (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  amount   REAL NOT NULL,
  priority INTEGER NOT NULL DEFAULT 100
);

CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
`);

function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    log(`Migration: adding column ${table}.${column}`);
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing('transactions', 'value_date', 'TEXT');
addColumnIfMissing('import_profiles', 'col_value_date', 'TEXT');
addColumnIfMissing('categories', 'icon', 'TEXT');
addColumnIfMissing('categories', 'mode', "TEXT NOT NULL DEFAULT 'recurring'");

function dropColumnIfExists(table, column) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (cols.some((c) => c.name === column)) {
    log(`Migration: dropping column ${table}.${column}`);
    db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}
dropColumnIfExists('categories', 'kind');

// Bestand-Installationen haben ihr "ING CSV"-Profil ggf. angelegt, bevor
// col_value_date existierte (seedImportProfile legt ein Profil nur einmalig
// an, ein Bestandsprofil wird dadurch nie nachträglich befüllt). Ohne dieses
// Backfill bleibt die Wertstellung dort dauerhaft NULL.
db.prepare(
  "UPDATE import_profiles SET col_value_date = 'Valuta' WHERE name = 'ING CSV' AND col_value_date IS NULL"
).run();

function seedImportProfile(profile) {
  const existing = db.prepare('SELECT id FROM import_profiles WHERE name = ?').get(profile.name);
  if (existing) return;
  log(`Seeding default import profile: ${profile.name}`);
  db.prepare(
    `INSERT INTO import_profiles
       (name, delimiter, encoding, date_format, decimal_comma, skip_rows,
        col_date, col_value_date, col_amount, col_debit, col_credit, col_counterparty, col_purpose, col_balance)
     VALUES (@name, @delimiter, @encoding, @date_format, @decimal_comma, @skip_rows,
        @col_date, @col_value_date, @col_amount, @col_debit, @col_credit, @col_counterparty, @col_purpose, @col_balance)`
  ).run(profile);
}

// Standard-Spaltennamen des ING-Girokonto-CSV-Exports: Header in Zeile 14
// (13 Metadatenzeilen davor), Saldo/Währung bewusst nicht gemappt.
seedImportProfile({
  name: 'ING CSV',
  delimiter: ';',
  encoding: 'latin1',
  date_format: 'DD.MM.YYYY',
  decimal_comma: 1,
  skip_rows: 13,
  col_date: 'Buchung',
  col_value_date: 'Valuta',
  col_amount: 'Betrag',
  col_debit: null,
  col_credit: null,
  col_counterparty: 'Auftraggeber/Empfänger',
  col_purpose: 'Verwendungszweck',
  col_balance: null,
});

db.prepare('INSERT INTO settings (id, buffer) SELECT 1, 0 WHERE NOT EXISTS (SELECT 1 FROM settings WHERE id = 1)').run();

module.exports = db;
