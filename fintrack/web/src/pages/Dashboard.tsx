import { useEffect, useMemo, useState } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { formatDate, formatMonth, addDays, daysBetween, currentMonth } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { balanceAtDate } from '../utils/series';
import { chartTheme, chartPalette } from '../utils/chartTheme';
import type {
  MonthlyTotal,
  BalanceSeriesResponse,
  CategoryTotal,
  CategoryMonthlyTotal,
  CompareResponse,
  MonthStatusResponse,
  InflationHeadlinePoint,
  InflationBreakdownRow,
} from '../types';
import DateRangeFilter, { type DateRange } from '../components/DateRangeFilter';
import TrendArrow from '../components/TrendArrow';
import KpiTile from '../components/KpiTile';
import styles from './Dashboard.module.css';

const FORECAST_WEEKS = 13;

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

function pivotCategoryMonthly(rows: CategoryMonthlyTotal[], palette: string[]) {
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
      color: color || palette[i % palette.length],
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
  const [monthStatus, setMonthStatus] = useState<MonthStatusResponse | null>(null);
  const [inflationHeadline, setInflationHeadline] = useState<InflationHeadlinePoint[]>([]);
  const [inflationBreakdown, setInflationBreakdown] = useState<InflationBreakdownRow[]>([]);
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
    // Kontostandsverlauf respektiert denselben Zeitraumfilter wie die übrigen
    // Charts; ein Wertstellungs-Feld unterstützt der Endpoint nicht.
    const balanceParams = new URLSearchParams();
    if (range.from) balanceParams.set('from', range.from);
    if (range.to) balanceParams.set('to', range.to);
    api
      .get<BalanceSeriesResponse>(`/balance/series?${balanceParams.toString()}`)
      .then(setBalanceSeries)
      .catch(() => {});
  }, [range, dateField]);

  useEffect(() => {
    api.get<CategoryTotal[]>('/reports/by-category').then(setByCategoryAllTime).catch(() => {});
  }, []);

  // Eigener Effekt, unabhängig von range/dateField: eine YoY-Kennzahl braucht
  // mind. 24 Monate Historie und soll nicht durch den Seiten-Datumsfilter
  // eingeschränkt werden.
  useEffect(() => {
    api.get<InflationHeadlinePoint[]>('/inflation/headline?months=24').then(setInflationHeadline).catch(() => {});
    api.get<InflationBreakdownRow[]>('/inflation/breakdown').then(setInflationBreakdown).catch(() => {});
  }, []);

  useEffect(() => {
    const compareParams = new URLSearchParams({ month });
    if (dateField !== 'date') compareParams.set('field', dateField);
    api.get<CompareResponse>(`/reports/compare?${compareParams.toString()}`).then(setCompare).catch(() => {});
    api.get<MonthStatusResponse>('/reports/month-status').then(setMonthStatus).catch(() => {});
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

  const palette = useMemo(() => chartPalette(theme), [theme]);
  const expensePivot = useMemo(() => pivotCategoryMonthly(expenseMonthly, palette), [expenseMonthly, palette]);
  const incomePivot = useMemo(() => pivotCategoryMonthly(incomeMonthly, palette), [incomeMonthly, palette]);

  const { colors: c, baseOptions } = chartTheme(theme);
  const foreColor = c.muted;

  const monthlyOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'monthly' },
    xaxis: { categories: monthly.map((m) => m.month) },
    yaxis: { labels: { formatter: formatCurrency } },
    colors: [c.green, c.red, c.accent2],
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
    colors: [c.accent2, c.accent, c.accent2, c.violet],
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

  const inflationOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'inflation' },
    xaxis: {
      categories: inflationHeadline.map((p) => p.month),
      labels: { formatter: (v: string) => formatMonth(v) },
    },
    yaxis: { labels: { formatter: (val: number) => `${val.toFixed(1)} %` } },
    tooltip: { ...baseOptions.tooltip, y: { formatter: (val: number) => `${val.toFixed(1)} %` } },
    colors: [c.accent2, c.muted],
    stroke: { width: [2, 2], dashArray: [0, 6], curve: 'smooth' },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const inflationSeries = [
    { name: 'Deine Inflation', type: 'line', data: inflationHeadline.map((p) => p.personalRateYoy) },
    {
      name: 'Offizielle Inflation (Eurostat HICP, DE)',
      type: 'line',
      data: inflationHeadline.map((p) => p.officialRateYoy),
    },
  ];

  const categoryDataLabels: ApexOptions['dataLabels'] = {
    enabled: true,
    formatter: (val: number) => `${val.toFixed(1)} %`,
  };
  const categoryTooltip: ApexOptions['tooltip'] = {
    theme,
    y: { formatter: (val: number) => formatCurrency(val) },
  };

  const categoryOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'by-category', type: 'donut' },
    labels: byCategory.map((c) => c.name),
    colors: byCategory.map((cat, i) => cat.color || palette[i % palette.length]),
    legend: { labels: { colors: foreColor }, position: 'bottom' },
    dataLabels: categoryDataLabels,
    tooltip: categoryTooltip,
  };
  const categorySeries = byCategory.map((c) => c.total);

  const categoryAllTimeOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'by-category-all-time', type: 'donut' },
    labels: byCategoryAllTime.map((c) => c.name),
    colors: byCategoryAllTime.map((cat, i) => cat.color || palette[i % palette.length]),
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
      <div className={styles.kpiRow}>
        <KpiTile
          label="Restbudget (Monat)"
          value={monthStatus?.remainingBudget != null ? formatCurrency(monthStatus.remainingBudget) : '–'}
          tone={monthStatus?.remainingBudget != null && monthStatus.remainingBudget < 0 ? 'danger' : 'default'}
          sub={
            monthStatus?.remainingBudget != null
              ? `noch erwartet: +${formatCurrency(monthStatus.expectedRemainingIncome)} / −${formatCurrency(
                  monthStatus.expectedRemainingExpense
                )} · Puffer ${formatCurrency(monthStatus.buffer)}`
              : 'Startsaldo benötigt (Saldo-Seite)'
          }
          href={monthStatus?.remainingBudget == null ? '#/balance' : undefined}
        />
        <KpiTile
          label="Kontostand"
          value={monthStatus?.currentBalance != null ? formatCurrency(monthStatus.currentBalance) : '–'}
          sub={
            monthStatus?.currentBalance != null
              ? 'berechnet aus Startsaldo + Buchungen'
              : 'Startsaldo benötigt (Saldo-Seite)'
          }
          href={monthStatus?.currentBalance == null ? '#/balance' : undefined}
        />
        <KpiTile
          label="Ausgaben MTD"
          value={monthStatus ? formatCurrency(monthStatus.mtdExpense) : '–'}
          sub={compare ? `Vormonat gesamt: ${formatCurrency(compare.previousMonth.expense)}` : undefined}
        />
        <KpiTile
          label="Nicht kategorisiert"
          value={monthStatus ? String(monthStatus.uncategorizedCount) : '–'}
          tone={monthStatus && monthStatus.uncategorizedCount > 0 ? 'danger' : 'default'}
          sub="Buchungen zuordnen →"
          href="#/transactions?uncategorized=true"
        />
      </div>

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
        {balanceSeries.checkpoints.some((c) => c.diff != null && Math.abs(c.diff) > 0.01) && (
          <p className={styles.warning}>
            Achtung: Abweichung zwischen berechnetem und eingetragenem Saldo an mindestens einem Stützpunkt.
          </p>
        )}
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Persönliche vs. offizielle Inflation</h2>
        <div className={`card ${styles.chartCard}`}>
          <Chart options={inflationOptions} series={inflationSeries} type="line" height="100%" />
        </div>
        <p className={styles.caption}>
          Quelle: Eurostat HICP (prc_hicp_manr), Jahresrate für Deutschland. „Deine Inflation“ basiert auf deinen
          wiederkehrenden Ausgaben (rollierende 12-Monats-Summe ggü. Vorjahr) und vermischt methodisch Preis- und
          Mengenänderungen – sie ist daher nicht direkt mit einem amtlichen Preisindex vergleichbar. Bei weniger als
          24 Monaten Buchungshistorie verzerrt das den Kurvenanfang.
        </p>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Inflation nach Kategorie</h2>
        {inflationBreakdown.length === 0 ? (
          <p className={styles.caption}>
            Noch keine Kategorie einer COICOP-Gruppe zugeordnet. Das geht auf der Kategorien-Seite.
          </p>
        ) : (
          <div className={`cardFlush ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Gruppe</th>
                  <th>Kategorien</th>
                  <th className={styles.amountRight}>Deine Inflation</th>
                  <th className={styles.amountRight}>Offizielle Inflation</th>
                </tr>
              </thead>
              <tbody>
                {inflationBreakdown.map((row) => (
                  <tr key={row.coicop}>
                    <td data-label="Gruppe">{row.label}</td>
                    <td className={styles.meta} data-label="Kategorien">{row.categoryNames.join(', ')}</td>
                    <td className={styles.amountRight} data-label="Deine Inflation">
                      {row.personalRateYoy != null ? <TrendArrow pct={row.personalRateYoy} /> : '–'}
                    </td>
                    <td className={styles.amountRight} data-label="Offizielle Inflation">
                      {row.officialRateYoy != null ? <TrendArrow pct={row.officialRateYoy} /> : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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

    </div>
  );
}

function CompareRow({ label, data }: { label: string; data: MonthlyTotal }) {
  return (
    <div className={styles.compareRow}>
      <span className={styles.compareLabel}>{label}</span>
      <span>
        Ein. {formatCurrency(data.income)} · Aus. {formatCurrency(data.expense)} · Netto {formatCurrency(data.net)}
      </span>
    </div>
  );
}
