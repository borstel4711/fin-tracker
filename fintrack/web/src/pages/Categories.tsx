import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import type { Category, CategorySummaryResponse } from '../types';
import MdiIcon from '../components/MdiIcon';
import CategoryBadge from '../components/CategoryBadge';
import { formatCurrency } from '../utils/currency';
import { formatMonth } from '../utils/date';
import styles from './Categories.module.css';

const MODES: Category['mode'][] = ['recurring', 'one_time'];
const MODE_LABELS: Record<Category['mode'], string> = {
  recurring: 'Wiederkehrend',
  one_time: 'Einmalig',
};

const emptyForm = {
  name: '',
  color: '#2563eb',
  icon: '',
  mode: 'recurring' as Category['mode'],
};

type SortDir = 'asc' | 'desc';
type SummarySortKey =
  | 'name'
  | 'total_year'
  | 'total_prev_year_month'
  | 'total_month'
  | 'avg_per_month'
  | 'trend_6m_pct'
  | 'trend_12m_pct'
  | 'trend_24m_pct';

type ModeFilter = 'all' | Category['mode'];

const SUMMARY_COLUMNS: { key: SummarySortKey; label: string; amountRight?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'total_year', label: 'Betrag YTD', amountRight: true },
  { key: 'total_prev_year_month', label: 'Betrag PYM', amountRight: true },
  { key: 'total_month', label: 'Betrag MTD', amountRight: true },
  { key: 'avg_per_month', label: 'Ø Betrag/Monat', amountRight: true },
  { key: 'trend_6m_pct', label: '6M Trend', amountRight: true },
  { key: 'trend_12m_pct', label: '12M Trend', amountRight: true },
  { key: 'trend_24m_pct', label: '24M Trend', amountRight: true },
];

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

function TrendArrow({ pct }: { pct: number }) {
  const direction = trendDirection(pct);
  return (
    <span className={styles.trendArrow}>
      <MdiIcon name={TREND_ICON[direction]} variant={TREND_VARIANT[direction]} size={16} />
      {pct > 0 ? '+' : ''}
      {pct.toFixed(1)} %
    </span>
  );
}

const HEATMAP_NEUTRAL = { dark: '#242736', light: '#e8eaf0' };
const HEATMAP_NEGATIVE = { dark: '#ef4444', light: '#dc2626' };
const HEATMAP_POSITIVE = { dark: '#22c55e', light: '#16a34a' };
const HEATMAP_BINS = 4;

function hexToRgb(hex: string): [number, number, number] {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

function lerpColor(from: string, to: string, t: number): string {
  const [fr, fg, fb] = hexToRgb(from);
  const [tr, tg, tb] = hexToRgb(to);
  const channel = (a: number, b: number) => Math.round(a + (b - a) * t).toString(16).padStart(2, '0');
  return `#${channel(fr, tr)}${channel(fg, tg)}${channel(fb, tb)}`;
}

function buildHeatmapRanges(maxAbs: number, theme: 'dark' | 'light') {
  const neutral = HEATMAP_NEUTRAL[theme];
  const negative = HEATMAP_NEGATIVE[theme];
  const positive = HEATMAP_POSITIVE[theme];
  const safeMax = maxAbs || 1;
  const ranges: { from: number; to: number; color: string }[] = [];
  for (let i = HEATMAP_BINS; i >= 1; i--) {
    ranges.push({
      from: -safeMax * (i / HEATMAP_BINS),
      to: -safeMax * ((i - 1) / HEATMAP_BINS),
      color: lerpColor(neutral, negative, i / HEATMAP_BINS),
    });
  }
  for (let i = 1; i <= HEATMAP_BINS; i++) {
    ranges.push({
      from: safeMax * ((i - 1) / HEATMAP_BINS),
      to: safeMax * (i / HEATMAP_BINS),
      color: lerpColor(neutral, positive, i / HEATMAP_BINS),
    });
  }
  return ranges;
}

export default function Categories() {
  const { theme } = useTheme();
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<CategorySummaryResponse>({ months: [], categories: [] });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SummarySortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });
  const [hiddenCategories, setHiddenCategories] = useState<Set<number>>(new Set());
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');

  const load = () => api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  const loadSummary = () =>
    api.get<CategorySummaryResponse>('/reports/category-summary').then(setSummary).catch(() => {});

  useEffect(() => {
    load();
    loadSummary();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, icon: form.icon || null };
    if (editingId !== null) {
      await api.patch(`/categories/${editingId}`, payload);
    } else {
      await api.post('/categories', payload);
    }
    cancelEdit();
    load();
    loadSummary();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setForm({ name: c.name, color: c.color ?? '#2563eb', icon: c.icon ?? '', mode: c.mode });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = async (id: number) => {
    await api.delete(`/categories/${id}`);
    if (editingId === id) cancelEdit();
    load();
    loadSummary();
  };

  const toggleSort = (key: SummarySortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const toggleCategoryVisibility = (id: number) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const modeFilteredSummary = useMemo(
    () => summary.categories.filter((c) => modeFilter === 'all' || c.mode === modeFilter),
    [summary, modeFilter]
  );

  const sortedSummary = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...modeFilteredSummary].sort((a, b) => {
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [modeFilteredSummary, sort]);

  const visibleSummaryCategories = useMemo(
    () => summary.categories.filter((c) => !hiddenCategories.has(c.category_id)),
    [summary, hiddenCategories]
  );

  const heatmapSeries = useMemo(
    () =>
      visibleSummaryCategories.map((c) => ({
        name: c.name,
        data: summary.months.map((m, i) => ({
          x: formatMonth(m),
          y: Math.round((c.monthly[i] ?? 0) * 100) / 100,
        })),
      })),
    [visibleSummaryCategories, summary.months]
  );

  const heatmapMaxAbs = useMemo(
    () => visibleSummaryCategories.reduce((max, c) => Math.max(max, ...c.monthly.map((v) => Math.abs(v)), 0), 0),
    [visibleSummaryCategories]
  );

  const foreColor = theme === 'dark' ? '#94a3b8' : '#6b7280';
  const gridColor = theme === 'dark' ? '#2e3147' : '#d1d5db';
  const tooltipTheme = theme === 'dark' ? 'dark' : 'light';

  const heatmapOptions: ApexOptions = {
    chart: { foreColor, toolbar: { show: false }, background: 'transparent' },
    grid: { borderColor: gridColor },
    tooltip: { theme: tooltipTheme, y: { formatter: (val: number) => formatCurrency(val) } },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      heatmap: {
        useFillColorAsStroke: true,
        colorScale: { ranges: buildHeatmapRanges(heatmapMaxAbs, theme) },
      },
    },
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Kategorien</h2>

      <section>
        <h3 className={styles.sectionTitle}>Übersicht</h3>
        <div className={styles.filterRow}>
          <select
            className="input inputSmall"
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value as ModeFilter)}
          >
            <option value="all">Einmalig &amp; wiederkehrend</option>
            <option value="recurring">Nur wiederkehrend</option>
            <option value="one_time">Nur einmalig</option>
          </select>
        </div>
        <div className={`cardFlush ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.symbolCol}>&nbsp;</th>
                {SUMMARY_COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`${styles.sortable} ${col.amountRight ? styles.amountRight : ''}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    {col.label}
                    <span className={styles.sortIndicator}>
                      {sort.key === col.key ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSummary.map((row) => (
                <tr key={row.category_id}>
                  <td className={styles.symbolCol}>
                    <MdiIcon name={row.icon} color={row.color} />
                  </td>
                  <td className={row.mode === 'recurring' ? styles.recurringName : undefined}>{row.name}</td>
                  <td className={styles.amountRight}>{formatCurrency(row.total_year)}</td>
                  <td className={styles.amountRight}>{formatCurrency(row.total_prev_year_month)}</td>
                  <td className={styles.amountRight}>{formatCurrency(row.total_month)}</td>
                  <td className={styles.amountRight}>{formatCurrency(row.avg_per_month)}</td>
                  <td className={styles.amountRight}>
                    <TrendArrow pct={row.trend_6m_pct} />
                  </td>
                  <td className={styles.amountRight}>
                    <TrendArrow pct={row.trend_12m_pct} />
                  </td>
                  <td className={styles.amountRight}>
                    <TrendArrow pct={row.trend_24m_pct} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Kategorie × Monat (letzte 12 Monate)</h3>
        <div className={styles.filterRow}>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.pill} ${hiddenCategories.has(c.id) ? '' : styles.pillActive}`}
              onClick={() => toggleCategoryVisibility(c.id)}
            >
              <CategoryBadge category={c} />
            </button>
          ))}
        </div>
        <div className={`card ${styles.heatmapCard}`}>
          <Chart options={heatmapOptions} series={heatmapSeries} type="heatmap" height="100%" />
        </div>
      </section>

      <form onSubmit={submit} className={`card ${styles.form}`}>
        <input
          className="input"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="input"
          value={form.mode}
          onChange={(e) => setForm({ ...form, mode: e.target.value as Category['mode'] })}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <span className={styles.iconInputGroup}>
          <input
            className="input"
            placeholder="mdi-icon-name"
            value={form.icon}
            onChange={(e) => setForm({ ...form, icon: e.target.value })}
          />
          <MdiIcon name={form.icon} color={form.color} />
        </span>
        <button type="submit" className="button buttonPrimary">
          <MdiIcon name={editingId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
          {editingId !== null ? 'Speichern' : 'Hinzufügen'}
        </button>
        {editingId !== null && (
          <button type="button" className="button buttonSecondary" onClick={cancelEdit}>
            Abbrechen
          </button>
        )}
      </form>

      <ul className={`cardFlush ${styles.list}`}>
        {categories.map((c) => (
          <li key={c.id} className={styles.listItem}>
            <span className={styles.nameRow}>
              <span className={styles.colorDot} style={{ background: c.color ?? undefined }} />
              <MdiIcon name={c.icon} color={c.color} />
              {c.name} <span className={styles.meta}>({MODE_LABELS[c.mode]})</span>
            </span>
            <span className={styles.actions}>
              <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEdit(c)}>
                <MdiIcon name="pencil-outline" variant="accent" />
              </button>
              <button className="iconButton" title="Löschen" aria-label="Löschen" onClick={() => remove(c.id)}>
                <MdiIcon name="delete-outline" variant="danger" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
