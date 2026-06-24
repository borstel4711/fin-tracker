// Buchungen ohne Wertstellung fallen sonst aus jeder Monatsgruppierung heraus,
// deshalb auf das Buchungsdatum zurückfallen, statt NULL durchzureichen.
function dateColumn(field, alias = '') {
  const p = alias ? `${alias}.` : '';
  return field === 'value_date' ? `COALESCE(${p}value_date, ${p}date)` : `${p}date`;
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function lastNMonths(n) {
  const now = new Date();
  const current = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const months = [];
  for (let i = n - 1; i >= 0; i--) {
    months.push(shiftMonth(current, -i));
  }
  return months;
}

function monthsBetween(from, to) {
  const months = [];
  for (let m = from; m <= to; m = shiftMonth(m, 1)) {
    months.push(m);
  }
  return months;
}

function pctChange(recentAbs, olderAbs) {
  if (olderAbs === 0) return recentAbs === 0 ? 0 : 100;
  return Math.round(((recentAbs - olderAbs) / olderAbs) * 1000) / 10;
}

module.exports = { dateColumn, shiftMonth, lastNMonths, monthsBetween, pctChange };
