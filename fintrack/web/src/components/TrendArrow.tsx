import MdiIcon from './MdiIcon';
import styles from './TrendArrow.module.css';

type TrendDirection = 'up' | 'down' | 'flat';

function trendDirection(pct: number): TrendDirection {
  if (pct > 5) return 'up';
  if (pct < -5) return 'down';
  return 'flat';
}

const TREND_ICON: Record<TrendDirection, string> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'trending-neutral',
};

const TREND_VARIANT: Record<TrendDirection, 'accent' | 'danger' | 'muted'> = {
  up: 'danger',
  down: 'accent',
  flat: 'muted',
};

export default function TrendArrow({ pct }: { pct: number }) {
  const direction = trendDirection(pct);
  return (
    <span className={styles.trendArrow}>
      <MdiIcon name={TREND_ICON[direction]} variant={TREND_VARIANT[direction]} size={16} />
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)} %
    </span>
  );
}
