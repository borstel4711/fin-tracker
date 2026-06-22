import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { formatDate } from '../utils/date';
import type { MonthlyTotal, BalanceSeriesResponse, CategoryTotal, CompareResponse, Transaction } from '../types';
import styles from './Dashboard.module.css';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777'];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { theme } = useTheme();
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [balanceSeries, setBalanceSeries] = useState<BalanceSeriesResponse>({
    start: null,
    series: [],
    checkpoints: [],
  });
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const month = currentMonth();

  useEffect(() => {
    api.get<MonthlyTotal[]>('/reports/monthly').then(setMonthly).catch(() => {});
    api.get<BalanceSeriesResponse>('/balance/series').then(setBalanceSeries).catch(() => {});
    api.get<CategoryTotal[]>(`/reports/by-category?month=${month}`).then(setByCategory).catch(() => {});
    api.get<CompareResponse>(`/reports/compare?month=${month}`).then(setCompare).catch(() => {});
    api
      .get<Transaction[]>('/transactions?uncategorized=true')
      .then((rows) => setUncategorizedCount(rows.length))
      .catch(() => {});
  }, [month]);

  const balanceDates = useMemo(() => balanceSeries.series.map((p) => p.date), [balanceSeries]);
  const balanceValues = useMemo(() => balanceSeries.series.map((p) => p.balance), [balanceSeries]);
  const checkpointValues = useMemo(
    () =>
      balanceSeries.series.map((p) => balanceSeries.checkpoints.find((c) => c.date === p.date)?.balance ?? null),
    [balanceSeries]
  );

  const foreColor = theme === 'dark' ? '#94a3b8' : '#6b7280';
  const gridColor = theme === 'dark' ? '#2e3147' : '#d1d5db';
  const tooltipTheme = theme === 'dark' ? 'dark' : 'light';

  const baseOptions: ApexOptions = {
    chart: { foreColor, toolbar: { show: false }, background: 'transparent' },
    grid: { borderColor: gridColor },
    tooltip: { theme: tooltipTheme },
  };

  const monthlyOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'monthly' },
    xaxis: { categories: monthly.map((m) => m.month) },
    colors: ['#16a34a', '#dc2626', '#2563eb'],
    stroke: { width: [0, 0, 2] },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const monthlySeries = [
    { name: 'Einnahmen', type: 'column', data: monthly.map((m) => m.income) },
    { name: 'Ausgaben', type: 'column', data: monthly.map((m) => m.expense) },
    { name: 'Netto', type: 'line', data: monthly.map((m) => m.net) },
  ];

  const balanceOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'balance' },
    xaxis: {
      categories: balanceDates,
      labels: { formatter: (v: string) => formatDate(v) },
    },
    tooltip: { ...baseOptions.tooltip, x: { formatter: (v: number) => formatDate(balanceDates[v - 1]) } },
    colors: ['#2563eb', '#d97706'],
    stroke: { width: [2, 0], curve: 'smooth' },
    markers: { size: [0, 5] },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const balanceChartSeries = [
    { name: 'Berechnet', type: 'line', data: balanceValues },
    { name: 'Soll/Ist-Stützpunkt', type: 'line', data: checkpointValues },
  ];

  const categoryOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'by-category', type: 'donut' },
    labels: byCategory.map((c) => c.name),
    colors: byCategory.map((c, i) => c.color || COLORS[i % COLORS.length]),
    legend: { labels: { colors: foreColor }, position: 'bottom' },
    dataLabels: { enabled: false },
  };
  const categorySeries = byCategory.map((c) => c.total);

  return (
    <div className={styles.page}>
      <section>
        <h2 className={styles.sectionTitle}>Monatsbilanz</h2>
        <div className={`card ${styles.chartCard}`}>
          <Chart options={monthlyOptions} series={monthlySeries} type="line" height="100%" />
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Kontostandsverlauf</h2>
        <div className={`card ${styles.chartCard}`}>
          <Chart options={balanceOptions} series={balanceChartSeries} type="line" height="100%" />
        </div>
        {balanceSeries.checkpoints.some((c) => Math.abs(c.diff) > 0.01) && (
          <p className={styles.warning}>
            Achtung: Abweichung zwischen berechnetem und eingetragenem Saldo an mindestens einem Stützpunkt.
          </p>
        )}
      </section>

      <div className={styles.grid2}>
        <section>
          <h2 className={styles.sectionTitle}>Ausgaben nach Kategorie ({month})</h2>
          <div className={`card ${styles.chartCardSmall}`}>
            <Chart options={categoryOptions} series={categorySeries} type="donut" height="100%" />
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Monatsvergleich</h2>
          {compare && (
            <div className={`card ${styles.compareCard}`}>
              <CompareRow label="Dieser Monat" data={compare.month} />
              <CompareRow label="Vormonat" data={compare.previousMonth} />
              <CompareRow label="Vorjahresmonat" data={compare.previousYear} />
            </div>
          )}
        </section>
      </div>

      <section>
        <a href="#/transactions?uncategorized=true" className={`link ${styles.footerLink}`}>
          {uncategorizedCount} nicht kategorisierte Buchung(en) ansehen →
        </a>
      </section>
    </div>
  );
}

function CompareRow({ label, data }: { label: string; data: MonthlyTotal }) {
  return (
    <div className={styles.compareRow}>
      <span className={styles.compareLabel}>{label}</span>
      <span>
        Ein. {data.income.toFixed(2)} € · Aus. {data.expense.toFixed(2)} € · Netto {data.net.toFixed(2)} €
      </span>
    </div>
  );
}
