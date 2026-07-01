// Letzter bekannter Wert einer datumsaufsteigend sortierten Serie bis
// einschließlich `date` (Kontostands- und Darlehensverläufe sind Stufenkurven).
export function balanceAtDate(series: { date: string; balance: number }[], date: string): number | null {
  let result: number | null = null;
  for (const p of series) {
    if (p.date <= date) result = p.balance;
    else break;
  }
  return result;
}
