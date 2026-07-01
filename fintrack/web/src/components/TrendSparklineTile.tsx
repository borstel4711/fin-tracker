import { trendDirection, TREND_VARIANT } from '../utils/trend';
import styles from './TrendSparklineTile.module.css';

const VARIANT_COLOR_VAR: Record<'accent' | 'danger' | 'muted', string> = {
  accent: 'var(--accent2)',
  danger: 'var(--red)',
  muted: 'var(--text-muted)',
};

function buildSparklinePoints(series: number[], width: number, height: number): string {
  if (series.length < 2) return '';
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  return series
    .map((v, i) => {
      const x = (i / (series.length - 1 || 1)) * width;
      const y = height - ((v - min) / range) * height;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export default function TrendSparklineTile({
  label,
  pct,
  series,
}: {
  label: string;
  pct: number;
  series: number[];
}) {
  const direction = trendDirection(pct);
  const color = VARIANT_COLOR_VAR[TREND_VARIANT[direction]];
  const points = buildSparklinePoints(series, 100, 32);

  return (
    <div className={styles.tile}>
      <svg className={styles.sparkline} viewBox="0 0 100 32" preserveAspectRatio="none">
        <polyline points={points} fill="none" stroke={color} strokeWidth={2} />
      </svg>
      <div className={styles.content}>
        <span className={styles.label}>{label}</span>
        <span className={styles.pct} style={{ color }}>
          {pct > 0 ? '+' : ''}
          {pct.toFixed(1)} %
        </span>
      </div>
    </div>
  );
}
