import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { formatDate, addDays } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import type {
  MonthlyTotal,
  BalanceSeriesResponse,
  CategoryTotal,
  CategoryMonthlyTotal,
  CompareResponse,
  Transaction,
} from '../types';
import DateRangeFilter, { type DateRange } from '../components/DateRangeFilter';
import styles from './Dashboard.module.css';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777'];
const FORECAST_STEPS_DAYS = [30, 60, 90];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function pivotCategoryMonthly(rows: CategoryMonthlyTotal[]) {
  const months = Array.from(new Set(rows.map((r) => r.month))).sort();
  const order: string[] = [];
  const meta = new Map<string, { name: string; color: string | null }>();
  for (const r of rows) {
    const key = String(r.category_id ?? 'none');
    if (!meta.has(key)) {
      meta.set(key, { name: r.name, color: r.color });
      order.push(key);
    }
  }
  const series = order.map((key, i) => {
    const { name, color } = meta.get(key)!;
    return {
      name,
      color: color || COLORS[i % COLORS.length],
      data: months.map(
        (month) => rows.find((r) => r.month === month && String(r.category_id ?? 'none') === key)?.total ?? 0
      ),
    };
  });
  return { months, series };
}

export default function Dashboard() {
  const { theme } = useTheme();
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [expenseMonthly, setExpenseMonthly] = useState<CategoryMonthlyTotal[]>([]);
  const [incomeMonthly, setIncomeMonthly] = useState<CategoryMonthlyTotal[]>([]);
  const [balanceSeries, setBalanceSeries] = useState<BalanceSeriesResponse>({
    start: null,
    series: [],
    checkpoints: [],
  });
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const month = currentMonth();

  useEffect(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    const qs = params.toString();
    api.get<MonthlyTotal[]>(`/reports/monthly?${qs}`).then(setMonthly).catch(() => {});
    api
      .get<CategoryMonthlyTotal[]>(`/reports/by-category-monthly?type=expense&${qs}`)
      .then(setExpenseMonthly)
      .catch(() => {});
    api
      .get<CategoryMonthlyTotal[]>(`/reports/by-category-monthly?type=income&${qs}`)
      .then(setIncomeMonthly)
      .catch(() => {});
  }, [range]);

  useEffect(() => {
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

  const forecast = useMemo(() => {
    const series = balanceSeries.series;
    if (series.length < 2) return { dates: [] as string[], values: [] as number[] };
    const first = series[0];
    const last = series[series.length - 1];
    const totalDays = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000;
    if (totalDays <= 0) return { dates: [] as string[], values: [] as number[] };
    const avgDailyChange = (last.balance - first.balance) / totalDays;
    return {
      dates: FORECAST_STEPS_DAYS.map((d) => addDays(last.date, d)),
      values: FORECAST_STEPS_DAYS.map((d) => Math.round((last.balance + avgDailyChange * d) * 100) / 100),
    };
  }, [balanceSeries]);

  const extendedBalanceDates = useMemo(() => [...balanceDates, ...forecast.dates], [balanceDates, forecast]);
  const extendedBalanceValues = useMemo(
    () => [...balanceValues, ...forecast.dates.map(() => null)],
    [balanceValues, forecast]
  );
  const extendedCheckpointValues = useMemo(
    () => [...checkpointValues, ...forecast.dates.map(() => null)],
    [checkpointValues, forecast]
  );
  const forecastSeriesValues = useMemo(() => {
    if (balanceValues.length === 0) return forecast.values.map(() => null);
    const padding = new Array(balanceValues.length - 1).fill(null);
    return [...padding, balanceValues[balanceValues.length - 1], ...forecast.values];
  }, [balanceValues, forecast]);

  const expensePivot = useMemo(() => pivotCategoryMonthly(expenseMonthly), [expenseMonthly]);
  const incomePivot = useMemo(() => pivotCategoryMonthly(incomeMonthly), [incomeMonthly]);

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
    yaxis: { labels: { formatter: formatCurrency } },
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
      categories: extendedBalanceDates,
      labels: { formatter: (v: string) => formatDate(v) },
    },
    yaxis: { labels: { formatter: formatCurrency } },
    tooltip: { ...baseOptions.tooltip, x: { formatter: (v: number) => formatDate(extendedBalanceDates[v - 1]) } },
    colors: ['#2563eb', '#d97706', '#2563eb'],
    stroke: { width: [2, 0, 2], dashArray: [0, 0, 6], curve: 'smooth' },
    markers: { size: [0, 5, 0] },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const balanceChartSeries = [
    { name: 'Berechnet', type: 'line', data: extendedBalanceValues },
    { name: 'Saldo', type: 'line', data: extendedCheckpointValues },
    { name: 'Prognose', type: 'line', data: forecastSeriesValues },
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

  const expenseByCategoryMonthlyOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'expense-by-category-monthly', type: 'bar', stacked: true },
    xaxis: { categories: expensePivot.months },
    yaxis: { labels: { formatter: formatCurrency } },
    colors: expensePivot.series.map((s) => s.color),
    plotOptions: { bar: { columnWidth: '60%' } },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor }, showForSingleSeries: true },
  };
  const expenseByCategoryMonthlySeries = expensePivot.series.map(({ name, data }) => ({ name, data }));

  const incomeByCategoryMonthlyOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'income-by-category-monthly', type: 'bar', stacked: true },
    xaxis: { categories: incomePivot.months },
    yaxis: { labels: { formatter: formatCurrency } },
    colors: incomePivot.series.map((s) => s.color),
    plotOptions: { bar: { columnWidth: '60%' } },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor }, showForSingleSeries: true },
  };
  const incomeByCategoryMonthlySeries = incomePivot.series.map(({ name, data }) => ({ name, data }));

  return (
    <div className={styles.page}>
      <div className={`card ${styles.filterPane}`}>
        <DateRangeFilter value={range} onChange={setRange} />
      </div>

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

      <section>
        <h2 className={styles.sectionTitle}>Ausgaben nach Kategorie (Verlauf)</h2>
        <div className={`card ${styles.chartCard}`}>
          <Chart
            options={expenseByCategoryMonthlyOptions}
            series={expenseByCategoryMonthlySeries}
            type="bar"
            height="100%"
          />
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Einnahmen nach Kategorie (Verlauf)</h2>
        <div className={`card ${styles.chartCard}`}>
          <Chart
            options={incomeByCategoryMonthlyOptions}
            series={incomeByCategoryMonthlySeries}
            type="bar"
            height="100%"
          />
        </div>
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
