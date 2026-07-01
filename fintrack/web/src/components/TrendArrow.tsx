import MdiIcon from './MdiIcon';
import { trendDirection, trendVariant, type TrendDirection } from '../utils/trend';
import styles from './TrendArrow.module.css';

const TREND_ICON: Record<TrendDirection, string> = {
  up: 'trending-up',
  down: 'trending-down',
  flat: 'trending-neutral',
};

export default function TrendArrow({ pct, positiveIsGood = false }: { pct: number; positiveIsGood?: boolean }) {
  const direction = trendDirection(pct);
  return (
    <span className={styles.trendArrow}>
      <MdiIcon name={TREND_ICON[direction]} variant={trendVariant(direction, positiveIsGood)} size={16} />
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)} %
    </span>
  );
}
