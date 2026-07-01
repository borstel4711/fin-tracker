// Zeile mit dem spätesten Datum, die einen Saldo mitbringt (z. B. die
// Kontostand-Spalte im CSV-Export). Repräsentiert den Soll-Wert für einen
// automatischen Checkpoint-Anker nach dem Import — der "letzte bekannte
// Saldo laut Bank" für den importierten Zeitraum.
function findLatestBalanceRow(rows) {
  let latest = null;
  for (const row of rows) {
    if (row.balance == null) continue;
    if (!latest || row.date > latest.date) latest = row;
  }
  return latest;
}

module.exports = { findLatestBalanceRow };
