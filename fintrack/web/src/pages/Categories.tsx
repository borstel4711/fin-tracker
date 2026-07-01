import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { chartTheme } from '../utils/chartTheme';
import { COICOP_CODES, type Category, type CategorySummaryResponse, type CategorySummaryRow } from '../types';
import MdiIcon from '../components/MdiIcon';
import CategoryBadge from '../components/CategoryBadge';
import TrendArrow from '../components/TrendArrow';
import TrendSparklineTile from '../components/TrendSparklineTile';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
import { formatCurrency } from '../utils/currency';
import { formatMonth } from '../utils/date';
import { groupCategoriesByParent } from '../utils/categoryTree';
import styles from './Categories.module.css';

const MODES: Category['mode'][] = ['recurring', 'one_time'];
const MODE_LABELS: Record<Category['mode'], string> = {
  recurring: 'Wiederkehrend',
  one_time: 'Einmalig',
};

// Dupliziert aus server/services/eurostat.js (COICOP_LABELS) — bei einer
// künftigen Änderung der Eurostat-Klassifikation beide Stellen anpassen.
const COICOP_LABELS: Record<string, string> = {
  CP00: 'Gesamt (alle Positionen)',
  CP01: 'Nahrungsmittel und alkoholfreie Getränke',
  CP02: 'Alkoholische Getränke und Tabak',
  CP03: 'Bekleidung und Schuhe',
  CP04: 'Wohnen, Wasser, Strom, Gas und andere Brennstoffe',
  CP05: 'Einrichtungsgegenstände und Haushaltsgeräte',
  CP06: 'Gesundheitspflege',
  CP07: 'Verkehr',
  CP08: 'Kommunikation',
  CP09: 'Freizeit und Kultur',
  CP10: 'Bildungswesen',
  CP11: 'Gaststätten- und Beherbergungsdienstleistungen',
  CP12: 'Sonstige Waren und Dienstleistungen',
};

const emptyForm = {
  name: '',
  parent_id: '',
  color: '#2563eb',
  icon: '',
  mode: 'recurring' as Category['mode'],
  coicop_code: '',
};

type SortDir = 'asc' | 'desc';
type SummarySortKey =
  | 'name'
  | 'total_year'
  | 'total_prev_year_month'
  | 'total_prev_month'
  | 'total_month'
  | 'avg_per_month'
  | 'trend_1m_pct'
  | 'trend_6m_pct'
  | 'trend_12m_pct'
  | 'trend_24m_pct';

type ModeFilter = 'all' | Category['mode'];

const SUMMARY_COLUMNS: { key: SummarySortKey; label: string; amountRight?: boolean }[] = [
  { key: 'name', label: 'Name' },
  { key: 'total_year', label: 'Betrag YTD', amountRight: true },
  { key: 'total_prev_year_month', label: 'Betrag PYM', amountRight: true },
  { key: 'total_prev_month', label: 'Betrag PM', amountRight: true },
  { key: 'total_month', label: 'Betrag MTD', amountRight: true },
  { key: 'avg_per_month', label: 'Ø Betrag/Monat', amountRight: true },
  { key: 'trend_1m_pct', label: '1M Trend', amountRight: true },
  { key: 'trend_6m_pct', label: '6M Trend', amountRight: true },
  { key: 'trend_12m_pct', label: '12M Trend', amountRight: true },
  { key: 'trend_24m_pct', label: '24M Trend', amountRight: true },
];

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

// Log-Skalierung statt linearer Bin-Grenzen: bei schiefen Finanzdaten (wenige
// große Ausreißer, viele kleine Beträge) sorgt das dafür, dass der Großteil
// der Werte über mehrere Farbstufen gespreizt wird, statt in den blassen
// mittleren Bins zu verschwinden.
function logBoundary(i: number, bins: number, max: number): number {
  return Math.expm1((i / bins) * Math.log1p(max));
}

function buildHeatmapRanges(maxAbs: number, theme: 'dark' | 'light') {
  const neutral = HEATMAP_NEUTRAL[theme];
  const negative = HEATMAP_NEGATIVE[theme];
  const positive = HEATMAP_POSITIVE[theme];
  const safeMax = maxAbs || 1;
  const ranges: { from: number; to: number; color: string }[] = [];
  for (let i = HEATMAP_BINS; i >= 1; i--) {
    ranges.push({
      from: -logBoundary(i, HEATMAP_BINS, safeMax),
      to: -logBoundary(i - 1, HEATMAP_BINS, safeMax),
      color: lerpColor(neutral, negative, i / HEATMAP_BINS),
    });
  }
  for (let i = 1; i <= HEATMAP_BINS; i++) {
    ranges.push({
      from: logBoundary(i - 1, HEATMAP_BINS, safeMax),
      to: logBoundary(i, HEATMAP_BINS, safeMax),
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
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [sort, setSort] = useState<{ key: SummarySortKey; dir: SortDir }>({ key: 'name', dir: 'asc' });
  const [hiddenCategories, setHiddenCategories] = useState<Set<number>>(new Set());
  const [modeFilter, setModeFilter] = useState<ModeFilter>('all');
  const [showSubcategories, setShowSubcategories] = useState(true);
  const [sumSubIntoParent, setSumSubIntoParent] = useState(false);

  const load = () => api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  const loadSummary = (rollup: boolean) =>
    api
      .get<CategorySummaryResponse>(`/reports/category-summary${rollup ? '?rollup=1' : ''}`)
      .then(setSummary)
      .catch(() => {});

  useEffect(() => {
    load();
  }, []);

  // Läd die Summary initial und immer wenn der Rollup-Filter umgeschaltet
  // wird (Trend-Berechnung für aufsummierte Elternkategorien läuft im Backend).
  useEffect(() => {
    loadSummary(sumSubIntoParent);
  }, [sumSubIntoParent]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const payload = {
      ...form,
      icon: form.icon || null,
      coicop_code: form.coicop_code || null,
      parent_id: form.parent_id ? Number(form.parent_id) : null,
    };
    try {
      if (editingId !== null) {
        await api.patch(`/categories/${editingId}`, payload);
      } else {
        await api.post('/categories', payload);
      }
      cancelEdit();
      load();
      loadSummary(sumSubIntoParent);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const startCreate = () => {
    setFormError('');
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (c: Category) => {
    setFormError('');
    setEditingId(c.id);
    setForm({
      name: c.name,
      parent_id: c.parent_id != null ? String(c.parent_id) : '',
      color: c.color ?? '#2563eb',
      icon: c.icon ?? '',
      mode: c.mode,
      coicop_code: c.coicop_code ?? '',
    });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(false);
  };

  const remove = async (id: number) => {
    if (
      !window.confirm(
        'Kategorie wirklich löschen? Zugeordnete Buchungen werden auf „Nicht kategorisiert" gesetzt, zugehörige Regeln und gelernte Zuordnungen werden gelöscht.'
      )
    ) {
      return;
    }
    await api.delete(`/categories/${id}`);
    if (editingId === id) cancelEdit();
    load();
    loadSummary(sumSubIntoParent);
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

  // "Subkategorien anzeigen" blendet Unterkategorien komplett aus Tabelle und
  // Heatmap aus (statt sie nur einzeln über die Heatmap-Pills auszublenden).
  const baseSummary = useMemo(
    () => summary.categories.filter((c) => showSubcategories || c.parent_id == null),
    [summary, showSubcategories]
  );

  const modeFilteredSummary = useMemo(
    () => baseSummary.filter((c) => modeFilter === 'all' || c.mode === modeFilter),
    [baseSummary, modeFilter]
  );

  // Unterkategorien bleiben bei jeder Sortierung direkt unter ihrer
  // Elternkategorie gruppiert; nur die Reihenfolge der Gruppen (und der
  // Kinder innerhalb einer Gruppe) folgt der gewählten Spalte/Richtung.
  const sortedSummary = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const compare = (a: CategorySummaryRow, b: CategorySummaryRow) => {
      if (sort.key === 'name') return a.name.localeCompare(b.name, 'de');
      const av = a[sort.key];
      const bv = b[sort.key];
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    };
    const childrenByParent = new Map<number, CategorySummaryRow[]>();
    const topLevel: CategorySummaryRow[] = [];
    for (const row of modeFilteredSummary) {
      if (row.parent_id != null) {
        if (!childrenByParent.has(row.parent_id)) childrenByParent.set(row.parent_id, []);
        childrenByParent.get(row.parent_id)!.push(row);
      } else {
        topLevel.push(row);
      }
    }
    const ordered: CategorySummaryRow[] = [];
    const emitted = new Set<number>();
    for (const row of [...topLevel].sort((a, b) => dir * compare(a, b))) {
      ordered.push(row);
      emitted.add(row.category_id);
      for (const child of (childrenByParent.get(row.category_id) ?? []).sort((a, b) => dir * compare(a, b))) {
        ordered.push(child);
        emitted.add(child.category_id);
      }
    }
    // Kinder, deren Elternkategorie durch den Modus-Filter ausgeblendet
    // ist, werden wie eigenständige Zeilen behandelt statt zu verschwinden.
    const orphans = modeFilteredSummary
      .filter((row) => !emitted.has(row.category_id))
      .sort((a, b) => dir * compare(a, b));
    return [...ordered, ...orphans];
  }, [modeFilteredSummary, sort]);

  // Bei aktivem Rollup enthalten Top-Kategorien bereits die Beträge ihrer
  // Unterkategorien; für die Summenzeile daher nur Top-Kategorien addieren,
  // um keine Beträge doppelt zu zählen.
  const totalsRow = useMemo(() => {
    const rows = sumSubIntoParent ? modeFilteredSummary.filter((r) => r.parent_id == null) : modeFilteredSummary;
    return rows.reduce(
      (acc, r) => ({
        total_year: acc.total_year + r.total_year,
        total_prev_year_month: acc.total_prev_year_month + r.total_prev_year_month,
        total_prev_month: acc.total_prev_month + r.total_prev_month,
        total_month: acc.total_month + r.total_month,
        avg_per_month: acc.avg_per_month + r.avg_per_month,
      }),
      { total_year: 0, total_prev_year_month: 0, total_prev_month: 0, total_month: 0, avg_per_month: 0 }
    );
  }, [modeFilteredSummary, sumSubIntoParent]);

  const groupedCategories = useMemo(() => groupCategoriesByParent(categories), [categories]);

  const heatmapPillCategories = useMemo(
    () => (showSubcategories ? groupedCategories : groupedCategories.filter((g) => g.depth === 0)),
    [groupedCategories, showSubcategories]
  );

  const visibleSummaryCategories = useMemo(
    () => baseSummary.filter((c) => !hiddenCategories.has(c.category_id)),
    [baseSummary, hiddenCategories]
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

  const { colors: c } = chartTheme(theme);

  const heatmapOptions: ApexOptions = {
    chart: { foreColor: c.muted, toolbar: { show: false }, background: 'transparent' },
    grid: { borderColor: c.border },
    tooltip: { theme, y: { formatter: (val: number) => formatCurrency(val) } },
    dataLabels: { enabled: false },
    legend: { show: false },
    plotOptions: {
      heatmap: {
        useFillColorAsStroke: true,
        // ApexCharts wendet auf Bin-Farben standardmäßig zusätzlich eine
        // eigene Hell/Dunkel-Abstufung an (enableShades), die unsere fein
        // abgestuften Bin-Farben stark verwäscht. Da die Bins selbst schon
        // die gewünschte Abstufung liefern, deaktivieren wir das.
        enableShades: false,
        colorScale: { ranges: buildHeatmapRanges(heatmapMaxAbs, theme) },
      },
    },
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Kategorien</h2>
        {!showForm && (
          <button type="button" className="button buttonPrimary" onClick={startCreate}>
            <MdiIcon name="plus" color="#ffffff" size={16} />
            Hinzufügen
          </button>
        )}
      </div>

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
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={showSubcategories}
              onChange={(e) => setShowSubcategories(e.target.checked)}
            />
            Subkategorien anzeigen
          </label>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={sumSubIntoParent}
              onChange={(e) => setSumSubIntoParent(e.target.checked)}
            />
            Subkategorien in Elternkategorien summieren
          </label>
        </div>
        <div className={styles.mobileSort}>
          <select
            className="input"
            value={sort.key}
            onChange={(e) => setSort({ key: e.target.value as SummarySortKey, dir: 'asc' })}
          >
            {SUMMARY_COLUMNS.map((col) => (
              <option key={col.key} value={col.key}>
                {col.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="iconButton"
            aria-label="Sortierrichtung umkehren"
            onClick={() => toggleSort(sort.key)}
          >
            <MdiIcon name={sort.dir === 'asc' ? 'sort-ascending' : 'sort-descending'} variant="accent" />
          </button>
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
                  <td
                    className={[
                      row.mode === 'recurring' ? styles.recurringName : '',
                      row.parent_id != null ? styles.indentedName : '',
                    ]
                      .filter(Boolean)
                      .join(' ') || undefined}
                    data-label="Name"
                  >
                    {row.name}
                  </td>
                  <td className={styles.amountRight} data-label="Betrag YTD">{formatCurrency(row.total_year)}</td>
                  <td className={styles.amountRight} data-label="Betrag PYM">{formatCurrency(row.total_prev_year_month)}</td>
                  <td className={styles.amountRight} data-label="Betrag PM">{formatCurrency(row.total_prev_month)}</td>
                  <td className={styles.amountRight} data-label="Betrag MTD">{formatCurrency(row.total_month)}</td>
                  <td className={styles.amountRight} data-label="Ø Betrag/Monat">{formatCurrency(row.avg_per_month)}</td>
                  <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="1M Trend">
                    <TrendArrow pct={row.trend_1m_pct} positiveIsGood={row.avg_per_month > 0} />
                  </td>
                  <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="6M Trend">
                    <TrendArrow pct={row.trend_6m_pct} positiveIsGood={row.avg_per_month > 0} />
                  </td>
                  <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="12M Trend">
                    <TrendArrow pct={row.trend_12m_pct} positiveIsGood={row.avg_per_month > 0} />
                  </td>
                  <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="24M Trend">
                    <TrendArrow pct={row.trend_24m_pct} positiveIsGood={row.avg_per_month > 0} />
                  </td>
                  <td className={styles.trendGridCell}>
                    <div className={styles.trendGrid}>
                      <TrendSparklineTile
                        label="1M"
                        pct={row.trend_1m_pct}
                        series={row.monthly.slice(-2)}
                        positiveIsGood={row.avg_per_month > 0}
                      />
                      <TrendSparklineTile
                        label="6M"
                        pct={row.trend_6m_pct}
                        series={row.monthly.slice(-6)}
                        positiveIsGood={row.avg_per_month > 0}
                      />
                      <TrendSparklineTile
                        label="12M"
                        pct={row.trend_12m_pct}
                        series={row.monthly}
                        positiveIsGood={row.avg_per_month > 0}
                      />
                      <TrendSparklineTile
                        label="24M"
                        pct={row.trend_24m_pct}
                        series={row.monthly24}
                        positiveIsGood={row.avg_per_month > 0}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className={styles.totalsRow}>
                <td className={styles.symbolCol}>&nbsp;</td>
                <td data-label="Name">Gesamt</td>
                <td className={styles.amountRight} data-label="Betrag YTD">{formatCurrency(totalsRow.total_year)}</td>
                <td className={styles.amountRight} data-label="Betrag PYM">
                  {formatCurrency(totalsRow.total_prev_year_month)}
                </td>
                <td className={styles.amountRight} data-label="Betrag PM">
                  {formatCurrency(totalsRow.total_prev_month)}
                </td>
                <td className={styles.amountRight} data-label="Betrag MTD">{formatCurrency(totalsRow.total_month)}</td>
                <td className={styles.amountRight} data-label="Ø Betrag/Monat">
                  {formatCurrency(totalsRow.avg_per_month)}
                </td>
                <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="1M Trend">
                  –
                </td>
                <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="6M Trend">
                  –
                </td>
                <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="12M Trend">
                  –
                </td>
                <td className={`${styles.amountRight} ${styles.trendCell}`} data-label="24M Trend">
                  –
                </td>
                <td className={styles.trendGridCell}>–</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Kategorie × Monat (letzte 12 Monate)</h3>
        <div className={styles.filterRow}>
          {heatmapPillCategories.map(({ category: c }) => (
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

      <Dialog
        open={showForm}
        onClose={cancelEdit}
        title={editingId !== null ? 'Kategorie bearbeiten' : 'Kategorie hinzufügen'}
      >
        <form onSubmit={submit} className={styles.form}>
          <FormField label="Name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Parent-Kategorie (optional)">
            <select
              className="input"
              value={form.parent_id}
              onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
            >
              <option value="">Keine (Top-Level)</option>
              {categories
                .filter((c) => c.parent_id == null && c.id !== editingId)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </select>
          </FormField>
          <FormField label="Art">
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
          </FormField>
          <FormField label="Inflations-Zuordnung (COICOP)">
            <select
              className="input"
              value={form.coicop_code}
              onChange={(e) => setForm({ ...form, coicop_code: e.target.value })}
            >
              <option value="">Keine Zuordnung (Inflation)</option>
              {COICOP_CODES.map((code) => (
                <option key={code} value={code}>
                  {COICOP_LABELS[code]}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Farbe">
            <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
          </FormField>
          <FormField label="Icon (mdi-icon-name)">
            <span className={styles.iconInputGroup}>
              <input
                className="input"
                value={form.icon}
                onChange={(e) => setForm({ ...form, icon: e.target.value })}
              />
              <MdiIcon name={form.icon} color={form.color} />
            </span>
          </FormField>
          {formError && <p className={styles.error}>{formError}</p>}
          <div className={styles.formActions}>
            <button type="submit" className="button buttonPrimary">
              <MdiIcon name={editingId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
              {editingId !== null ? 'Speichern' : 'Hinzufügen'}
            </button>
            <button type="button" className="button buttonSecondary" onClick={cancelEdit}>
              Abbrechen
            </button>
          </div>
        </form>
      </Dialog>

      <ul className={`cardFlush ${styles.list}`}>
        {groupedCategories.map(({ category: c, depth }) => (
          <li key={c.id} className={`${styles.listItem} ${depth === 1 ? styles.childListItem : ''}`}>
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
