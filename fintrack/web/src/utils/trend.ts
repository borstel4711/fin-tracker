export type TrendDirection = 'up' | 'down' | 'flat';

export function trendDirection(pct: number): TrendDirection {
  if (pct > 5) return 'up';
  if (pct < -5) return 'down';
  return 'flat';
}

export const TREND_VARIANT: Record<TrendDirection, 'accent' | 'danger' | 'muted'> = {
  up: 'danger',
  down: 'accent',
  flat: 'muted',
};
