import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { formatDate, addDays, daysBetween } from '../utils/date';
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
const FORECAST_WEEKS = 13;

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function weeklyDatesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  let d = start;
  while (d <= end) {
    dates.push(d);
    d = addDays(d, 7);
  }
  if (dates[dates.length - 1] !== end) dates.push(end);
  return dates;
}

function balanceAtDate(series: { date: string; balance: number }[], date: string): number | null {
  let result: number | null = null;
  for (const p of series) {
    if (p.date <= date) result = p.balance;
    else break;
  }
  return result;
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
    forecastRates: { total: 0, recurring: 0 },
  });
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [byCategoryAllTime, setByCategoryAllTime] = useState<CategoryTotal[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [range, setRange] = useState<DateRange>({ from: '', to: '' });
  const [dateField, setDateField] = useState<'date' | 'value_date'>('date');
  const month = currentMonth();

  useEffect(() => {
    const params = new URLSearchParams();
    if (range.from) params.set('from', range.from);
    if (range.to) params.set('to', range.to);
    if (dateField !== 'date') params.set('field', dateField);
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
    api.get<CategoryTotal[]>(`/reports/by-category?${qs}`).then(setByCategory).catch(() => {});
  }, [range, dateField]);

  useEffect(() => {
    api.get<CategoryTotal[]>('/reports/by-category').then(setByCategoryAllTime).catch(() => {});
  }, []);

  useEffect(() => {
    const compareParams = new URLSearchParams({ month });
    if (dateField !== 'date') compareParams.set('field', dateField);
    api.get<BalanceSeriesResponse>('/balance/series').then(setBalanceSeries).catch(() => {});
    api.get<CompareResponse>(`/reports/compare?${compareParams.toString()}`).then(setCompare).catch(() => {});
    api
      .get<Transaction[]>('/transactions?uncategorized=true')
      .then((rows) => setUncategorizedCount(rows.length))
      .catch(() => {});
  }, [month, dateField]);

  // X-Achse auf Wochenebene resampelt (alle 7 Tage), plus exakte
  // Checkpoint-Termine, damit deren Marker nicht ins Raster fallen.
  const historyDates = useMemo(() => {
    const series = balanceSeries.series;
    if (series.length === 0) return [] as string[];
    const first = series[0].date;
    const last = series[series.length - 1].date;
    const grid = weeklyDatesBetween(first, last);
    const checkpointDates = balanceSeries.checkpoints.map((c) => c.date);
    return Array.from(new Set([...grid, ...checkpointDates])).sort();
  }, [balanceSeries]);

  const lastHistoryDate = historyDates[historyDates.length - 1];
  const lastBalance = useMemo(
    () => (lastHistoryDate ? balanceAtDate(balanceSeries.series, lastHistoryDate) : null),
    [balanceSeries, lastHistoryDate]
  );

  const forecastDates = useMemo(() => {
    if (!lastHistoryDate) return [] as string[];
    return Array.from({ length: FORECAST_WEEKS }, (_, i) => addDays(lastHistoryDate, (i + 1) * 7));
  }, [lastHistoryDate]);

  const computedValues = useMemo(
    () => historyDates.map((d) => balanceAtDate(balanceSeries.series, d)),
    [historyDates, balanceSeries]
  );
  const checkpointValues = useMemo(
    () => historyDates.map((d) => balanceSeries.checkpoints.find((c) => c.date === d)?.balance ?? null),
    [historyDates, balanceSeries]
  );

  const projectFrom = (rate: number) =>
    lastBalance == null || !lastHistoryDate
      ? forecastDates.map(() => null)
      : forecastDates.map((d) => Math.round((lastBalance + rate * daysBetween(lastHistoryDate, d)) * 100) / 100);

  const forecastTotalValues = useMemo(
    () => projectFrom(balanceSeries.forecastRates.total),
    [forecastDates, lastBalance, lastHistoryDate, balanceSeries]
  );
  const forecastBaselineValues = useMemo(
    () => projectFrom(balanceSeries.forecastRates.recurring),
    [forecastDates, lastBalance, lastHistoryDate, balanceSeries]
  );

  const balanceCategories = useMemo(() => [...historyDates, ...forecastDates], [historyDates, forecastDates]);
  const extendedComputedValues = useMemo(
    () => [...computedValues, ...forecastDates.map(() => null)],
    [computedValues, forecastDates]
  );
  const extendedCheckpointValues = useMemo(
    () => [...checkpointValues, ...forecastDates.map(() => null)],
    [checkpointValues, forecastDates]
  );
  const padForecastSeries = (values: (number | null)[]) => {
    if (historyDates.length === 0) return values;
    const padding = new Array(historyDates.length - 1).fill(null);
    return [...padding, lastBalance, ...values];
  };
  const extendedForecastTotalValues = useMemo(
    () => padForecastSeries(forecastTotalValues),
    [historyDates, lastBalance, forecastTotalValues]
  );
  const extendedForecastBaselineValues = useMemo(
    () => padForecastSeries(forecastBaselineValues),
    [historyDates, lastBalance, forecastBaselineValues]
  );

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
      categories: balanceCategories,
      labels: { formatter: (v: string) => formatDate(v) },
    },
    yaxis: { labels: { formatter: formatCurrency } },
    tooltip: { ...baseOptions.tooltip, x: { formatter: (v: number) => formatDate(balanceCategories[v - 1]) } },
    colors: ['#2563eb', '#d97706', '#2563eb', '#7c3aed'],
    stroke: { width: [2, 0, 2, 2], dashArray: [0, 0, 6, 6], curve: 'smooth' },
    markers: { size: [0, 5, 0, 0] },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const balanceChartSeries = [
    { name: 'Berechnet', type: 'line', data: extendedComputedValues },
    { name: 'Saldo', type: 'line', data: extendedCheckpointValues },
    { name: 'Forecast Insgesamt', type: 'line', data: extendedForecastTotalValues },
    { name: 'Forecast Baseline', type: 'line', data: extendedForecastBaselineValues },
  ];

  const categoryDataLabels: ApexOptions['dataLabels'] = {
    enabled: true,
    formatter: (val: number) => `${val.toFixed(1)} %`,
  };
  const categoryTooltip: ApexOptions['tooltip'] = {
    theme: tooltipTheme,
    y: { formatter: (val: number) => formatCurrency(val) },
  };

  const categoryOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'by-category', type: 'donut' },
    labels: byCategory.map((c) => c.name),
    colors: byCategory.map((c, i) => c.color || COLORS[i % COLORS.length]),
    legend: { labels: { colors: foreColor }, position: 'bottom' },
    dataLabels: categoryDataLabels,
    tooltip: categoryTooltip,
  };
  const categorySeries = byCategory.map((c) => c.total);

  const categoryAllTimeOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'by-category-all-time', type: 'donut' },
    labels: byCategoryAllTime.map((c) => c.name),
    colors: byCategoryAllTime.map((c, i) => c.color || COLORS[i % COLORS.length]),
    legend: { labels: { colors: foreColor }, position: 'bottom' },
    dataLabels: categoryDataLabels,
    tooltip: categoryTooltip,
  };
  const categoryAllTimeSeries = byCategoryAllTime.map((c) => c.total);

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
        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.pill} ${dateField === 'date' ? styles.pillActive : ''}`}
            onClick={() => setDateField('date')}
          >
            Buchungsdatum
          </button>
          <button
            type="button"
            className={`${styles.pill} ${dateField === 'value_date' ? styles.pillActive : ''}`}
            onClick={() => setDateField('value_date')}
          >
            Wertstellungsdatum
          </button>
        </div>
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

      <div className={styles.statsGrid}>
        <section>
          <h2 className={styles.sectionTitle}>Ausgaben nach Kategorie (gefiltert)</h2>
          <div className={`card ${styles.chartCardSmall}`}>
            <Chart options={categoryOptions} series={categorySeries} type="donut" height="100%" />
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Ausgaben nach Kategorie (alle Zeit)</h2>
          <div className={`card ${styles.chartCardSmall}`}>
            <Chart options={categoryAllTimeOptions} series={categoryAllTimeSeries} type="donut" height="100%" />
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
