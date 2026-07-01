const crypto = require('crypto');

function parseAmount(raw, decimalComma) {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s) return null;
  s = s.replace(/[^\d,.\-+]/g, '');
  if (decimalComma) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  return Number.isNaN(n) ? null : n;
}

function parseDate(raw, format) {
  const s = String(raw || '').trim();
  if (!s) return null;
  if (format === 'YYYY-MM-DD') {
    return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  }
  const m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (!m) return null;
  let [, d, mo, y] = m;
  if (y.length === 2) y = `20${y}`;
  return `${y.padStart(4, '0')}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

function hashRow({ date, amount, counterparty, purpose }) {
  return crypto
    .createHash('sha256')
    .update(`${date}|${amount}|${counterparty || ''}|${purpose || ''}`)
    .digest('hex');
}

function normalizeRow(rawRow, profile) {
  const date = parseDate(rawRow[profile.col_date], profile.date_format);
  const valueDate = profile.col_value_date
    ? parseDate(rawRow[profile.col_value_date], profile.date_format)
    : null;

  let amount = null;
  if (profile.col_amount) {
    amount = parseAmount(rawRow[profile.col_amount], profile.decimal_comma);
  } else {
    const debit = parseAmount(rawRow[profile.col_debit], profile.decimal_comma);
    const credit = parseAmount(rawRow[profile.col_credit], profile.decimal_comma);
    // Beide Felder leer (z. B. Summen-/Infozeile) => keine Buchung, statt
    // eines 0-€-Eintrags.
    amount = debit == null && credit == null ? null : (credit || 0) - Math.abs(debit || 0);
  }

  const counterparty = profile.col_counterparty
    ? String(rawRow[profile.col_counterparty] || '').trim()
    : null;
  const purpose = profile.col_purpose
    ? String(rawRow[profile.col_purpose] || '').trim()
    : null;
  const balance = profile.col_balance
    ? parseAmount(rawRow[profile.col_balance], profile.decimal_comma)
    : null;

  if (date == null || amount == null) return null;

  return {
    date,
    value_date: valueDate,
    amount,
    type: amount >= 0 ? 'in' : 'out',
    counterparty,
    purpose,
    balance,
    hash: hashRow({ date, amount, counterparty, purpose }),
  };
}

// Zwei Buchungen mit identischem date|amount|counterparty|purpose (z. B. zwei
// gleich hohe Bargeldabhebungen am selben Tag) erzeugen sonst denselben Hash
// — die zweite würde beim Import fälschlich als Dublette des ersten
// verworfen. Die n-te Wiederholung derselben Kombination *innerhalb der
// Datei* bekommt daher einen Suffix; die erste Wiederholung behält ihren
// Hash unverändert, damit bereits importierte Bestandsdaten (ohne Suffix)
// weiterhin korrekt als Dubletten erkannt werden. Ein erneuter Import
// derselben Datei reproduziert dieselbe Reihenfolge und damit dieselben
// Suffix-Hashes, bleibt also idempotent.
function dedupeSameDayHashes(rows) {
  const seen = new Map();
  return rows.map((row) => {
    const count = seen.get(row.hash) || 0;
    seen.set(row.hash, count + 1);
    return count === 0 ? row : { ...row, hash: `${row.hash}#${count}` };
  });
}

module.exports = { parseAmount, parseDate, hashRow, normalizeRow, dedupeSameDayHashes };
