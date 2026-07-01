import styles from './KpiTile.module.css';

export type KpiTone = 'default' | 'danger' | 'success';

interface KpiTileProps {
  label: string;
  value: string;
  sub?: string;
  tone?: KpiTone;
  href?: string;
}

const TONE_CLASS: Record<KpiTone, string> = {
  default: '',
  danger: styles.danger,
  success: styles.success,
};

export default function KpiTile({ label, value, sub, tone = 'default', href }: KpiTileProps) {
  const content = (
    <>
      <span className={styles.label}>{label}</span>
      <span className={`${styles.value} ${TONE_CLASS[tone]}`}>{value}</span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </>
  );
  if (href) {
    return (
      <a href={href} className={`card ${styles.tile} ${styles.clickable}`}>
        {content}
      </a>
    );
  }
  return <div className={`card ${styles.tile}`}>{content}</div>;
}
