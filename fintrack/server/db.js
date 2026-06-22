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
  color     TEXT,
  kind      TEXT NOT NULL DEFAULT 'variable'
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

module.exports = db;
