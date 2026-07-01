const Papa = require('papaparse');
const { normalizeRow, dedupeSameDayHashes } = require('./normalize');

function decodeBuffer(buffer, encoding) {
  const enc = encoding === 'utf8' ? 'utf8' : 'latin1';
  return buffer.toString(enc);
}

function stripSkipRows(text, skipRows) {
  if (!skipRows) return text;
  const lines = text.split(/\r?\n/);
  return lines.slice(skipRows).join('\n');
}

function parseCsv(buffer, profile) {
  const text = stripSkipRows(decodeBuffer(buffer, profile.encoding), profile.skip_rows);
  const result = Papa.parse(text, {
    header: true,
    delimiter: profile.delimiter,
    skipEmptyLines: true,
  });
  return result.data;
}

function normalizeRows(rawRows, profile) {
  const rows = [];
  for (const raw of rawRows) {
    const normalized = normalizeRow(raw, profile);
    if (normalized) rows.push(normalized);
  }
  return dedupeSameDayHashes(rows);
}

module.exports = { parseCsv, normalizeRows };
