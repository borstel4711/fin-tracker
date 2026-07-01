export type TrendDirection = 'up' | 'down' | 'flat';
export type TrendVariant = 'accent' | 'danger' | 'muted';

export function trendDirection(pct: number): TrendDirection {
  if (pct > 5) return 'up';
  if (pct < -5) return 'down';
  return 'flat';
}

// Standard-Semantik ist auf Ausgaben ausgelegt (steigend = schlecht). Für
// Einnahmen-Kategorien (`positiveIsGood`) dreht sich die Färbung um:
// steigendes Gehalt ist gut, sinkendes schlecht.
export function trendVariant(direction: TrendDirection, positiveIsGood = false): TrendVariant {
  if (direction === 'flat') return 'muted';
  const isGood = direction === 'up' ? positiveIsGood : !positiveIsGood;
  return isGood ? 'accent' : 'danger';
}
