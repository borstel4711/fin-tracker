const Papa = require('papaparse');
const db = require('../db');
const { logError } = require('../log');

const BASE_URL = 'https://ec.europa.eu/eurostat/api/dissemination/sdmx/2.1/data/prc_hicp_manr';
const GEO = 'DE';
const STALE_MS = 7 * 24 * 60 * 60 * 1000;

const COICOP_LABELS = {
  CP00: 'Gesamt (alle Positionen)',
  CP01: 'Nahrungsmittel und alkoholfreie Getränke',
  CP02: 'Alkoholische Getränke und Tabak',
  CP03: 'Bekleidung und Schuhe',
  CP04: 'Wohnen, Wasser, Strom, Gas und andere Brennstoffe',
  CP05: 'Einrichtungsgegenstände und Haushaltsgeräte',
  CP06: 'Gesundheitspflege',
  CP07: 'Verkehr',
  CP08: 'Kommunikation',
  CP09: 'Freizeit und Kultur',
  CP10: 'Bildungswesen',
  CP11: 'Gaststätten- und Beherbergungsdienstleistungen',
  CP12: 'Sonstige Waren und Dienstleistungen',
};
const COICOP_CODES = Object.keys(COICOP_LABELS);

const upsertStmt = db.prepare(`
  INSERT INTO official_inflation_rates (month, coicop, rate_yoy, fetched_at)
  VALUES (@month, @coicop, @rate_yoy, @fetched_at)
  ON CONFLICT(month, coicop) DO UPDATE SET rate_yoy = excluded.rate_yoy, fetched_at = excluded.fetched_at
`);
const upsertRates = db.transaction((rows) => {
  for (const row of rows) upsertStmt.run(row);
});

function isStale(coicop, currentMonth) {
  const row = db
    .prepare('SELECT fetched_at FROM official_inflation_rates WHERE coicop = ? AND month = ?')
    .get(coicop, currentMonth);
  if (!row) return true;
  return Date.now() - new Date(row.fetched_at).getTime() > STALE_MS;
}

function findColumn(fields, candidates) {
  if (!fields) return null;
  for (const candidate of candidates) {
    const found = fields.find((f) => f.toLowerCase() === candidate.toLowerCase());
    if (found) return found;
  }
  return null;
}

// Eurostats COICOP-Klassifikation wurde im Januar 2026 auf ECOICOP v2
// umgestellt; Spaltennamen/Codes wurden zur Implementierungszeit nicht gegen
// die echte API verifiziert (Host in dieser Umgebung von der Egress-Policy
// geblockt). Deshalb Spalten dynamisch über Kandidatennamen statt über feste
// Indizes auflösen, damit ein abweichendes Format einen klaren Fehler statt
// stiller Falschdaten erzeugt.
async function fetchRatesFromEurostat(codes, startPeriod) {
  const url = `${BASE_URL}/M.RCH_A.${codes.join('+')}.${GEO}?startPeriod=${startPeriod}&format=sdmx+csv`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`Eurostat HTTP ${res.status}`);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: true });

  const coicopKey = findColumn(parsed.meta.fields, ['coicop']);
  const timeKey = findColumn(parsed.meta.fields, ['TIME_PERIOD', 'time']);
  const valueKey = findColumn(parsed.meta.fields, ['OBS_VALUE', 'value']);
  if (!coicopKey || !timeKey || !valueKey) {
    throw new Error(`Unerwartetes Eurostat-CSV-Format, Spalten: ${(parsed.meta.fields || []).join(', ')}`);
  }

  const rows = [];
  for (const r of parsed.data) {
    const coicop = r[coicopKey];
    const month = r[timeKey];
    if (!coicop || !month) continue;
    const value = r[valueKey];
    const rate = value === '' || value == null ? NaN : Number(value);
    rows.push({ coicop, month, rate_yoy: Number.isFinite(rate) ? rate : null });
  }
  return rows;
}

async function refreshCodes(codes, startPeriod) {
  const fetchedAt = new Date().toISOString();
  try {
    const rows = await fetchRatesFromEurostat(codes, startPeriod);
    upsertRates(rows.map((r) => ({ ...r, fetched_at: fetchedAt })));
    return;
  } catch (err) {
    logError(`Eurostat: kombinierter Abruf für [${codes.join(',')}] fehlgeschlagen, Fallback auf Einzelabrufe:`, err.message);
  }
  for (const code of codes) {
    try {
      const rows = await fetchRatesFromEurostat([code], startPeriod);
      upsertRates(rows.map((r) => ({ ...r, fetched_at: fetchedAt })));
    } catch (err) {
      logError(`Eurostat: Abruf für ${code} fehlgeschlagen:`, err.message);
    }
  }
}

function readRatesFromCache(codes, months) {
  const result = new Map(codes.map((c) => [c, new Map()]));
  if (!codes.length || !months.length) return result;
  const placeholders = (arr) => arr.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT coicop, month, rate_yoy FROM official_inflation_rates
       WHERE coicop IN (${placeholders(codes)}) AND month IN (${placeholders(months)})`
    )
    .all(...codes, ...months);
  for (const row of rows) {
    result.get(row.coicop)?.set(row.month, row.rate_yoy);
  }
  return result;
}

// Liefert offizielle Jahresraten für die angeforderten COICOP-Codes/Monate.
// Schlägt der Eurostat-Abruf fehl (Netzwerk, Timeout, unerwartetes Format),
// wird das hier abgefangen und geloggt statt geworfen — ein nicht
// abgefangener Reject in einem Request-Handler würde wegen
// process.on('unhandledRejection', ...) den gesamten Server beenden.
async function getOfficialRates(codes, months) {
  const validCodes = [...new Set(codes)].filter((c) => COICOP_CODES.includes(c));
  const result = new Map(validCodes.map((c) => [c, new Map()]));
  if (!validCodes.length || !months.length) return result;

  const currentMonth = months[months.length - 1];
  const staleCodes = validCodes.filter((c) => isStale(c, currentMonth));
  if (staleCodes.length) {
    try {
      await refreshCodes(staleCodes, months[0]);
    } catch (err) {
      logError('Eurostat: Refresh fehlgeschlagen, verwende ggf. veralteten Cache:', err.message);
    }
  }

  return readRatesFromCache(validCodes, months);
}

module.exports = { COICOP_CODES, COICOP_LABELS, getOfficialRates };
