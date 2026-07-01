import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { chartTheme } from '../utils/chartTheme';
import type { AppSettings, BalanceAnchor, BalanceSeriesResponse } from '../types';
import { formatDate, formatMonth, nextMonthEnd } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
import MdiIcon from '../components/MdiIcon';
import styles from './Balance.module.css';

const makeEmptyAnchor = () => ({
  date: nextMonthEnd(),
  balance: '',
  type: 'checkpoint' as BalanceAnchor['type'],
  note: '',
});

const TYPE_LABELS: Record<BalanceAnchor['type'], string> = {
  start: 'Startsaldo',
  month_end: 'Monatsende',
  checkpoint: 'Stichtag',
};

export default function Balance() {
  const { theme } = useTheme();
  const [anchors, setAnchors] = useState<BalanceAnchor[]>([]);
  const [series, setSeries] = useState<BalanceSeriesResponse>({
    start: null,
    series: [],
    checkpoints: [],
    forecastRates: { total: 0, recurring: 0 },
  });
  const [settings, setSettings] = useState<AppSettings>({ id: 1, buffer: 0 });
  const [form, setForm] = useState(makeEmptyAnchor);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => {
    api.get<BalanceAnchor[]>('/balance/anchors').then(setAnchors).catch(() => {});
    api.get<BalanceSeriesResponse>('/balance/series').then(setSeries).catch(() => {});
    api.get<AppSettings>('/settings').then(setSettings).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { ...form, balance: Number(form.balance) };
    try {
      if (editingId !== null) {
        await api.patch(`/balance/anchors/${editingId}`, payload);
      } else {
        await api.post('/balance/anchors', payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startCreate = () => {
    setError('');
    setEditingId(null);
    setForm(makeEmptyAnchor());
    setShowForm(true);
  };

  const startEdit = (a: BalanceAnchor) => {
    setError('');
    setEditingId(a.id);
    setForm({ date: a.date, balance: String(a.balance), type: a.type, note: a.note ?? '' });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(makeEmptyAnchor());
    setError('');
    setShowForm(false);
  };

  const remove = async (id: number) => {
    await api.delete(`/balance/anchors/${id}`);
    load();
  };

  const chartDates = useMemo(() => anchors.map((a) => a.date), [anchors]);
  const enteredValues = useMemo(() => anchors.map((a) => a.balance), [anchors]);
  const computedValues = useMemo(
    () => anchors.map((a) => series.checkpoints.find((c) => c.id === a.id)?.computed ?? null),
    [anchors, series]
  );
  const average = useMemo(
    () => (enteredValues.length ? enteredValues.reduce((sum, v) => sum + v, 0) / enteredValues.length : 0),
    [enteredValues]
  );

  // Veränderung in % wird nur für Monatsende-Anker ausgewiesen, jeweils
  // gegen den erfassten Saldo des vorherigen Monatsende-Ankers.
  const monthEndChangePct = useMemo(() => {
    const map = new Map<number, number | null>();
    let prevMonthEnd: BalanceAnchor | null = null;
    for (const a of anchors) {
      if (a.type === 'month_end') {
        map.set(a.id, prevMonthEnd && prevMonthEnd.balance !== 0 ? ((a.balance - prevMonthEnd.balance) / Math.abs(prevMonthEnd.balance)) * 100 : null);
        prevMonthEnd = a;
      }
    }
    return map;
  }, [anchors]);

  const { colors: c } = chartTheme(theme);
  const foreColor = c.muted;

  const historyOptions: ApexOptions = {
    chart: { foreColor, toolbar: { show: false }, background: 'transparent' },
    grid: { borderColor: c.border },
    xaxis: {
      categories: chartDates,
      labels: { formatter: (v: string) => (v ? formatMonth(v.slice(0, 7)) : '') },
    },
    yaxis: { labels: { formatter: formatCurrency } },
    tooltip: { theme, x: { formatter: (v: number) => formatDate(chartDates[v - 1]) } },
    colors: [c.accent, c.accent2],
    stroke: { width: [2, 2], curve: 'smooth' },
    markers: { size: [5, 5] },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
    annotations: {
      yaxis: [
        {
          y: average,
          borderColor: foreColor,
          strokeDashArray: 4,
          label: {
            text: `Mittelwert: ${formatCurrency(average)}`,
            position: 'left',
            textAnchor: 'start',
            borderColor: foreColor,
            style: { color: '#fff', background: foreColor },
          },
        },
        ...(settings.buffer
          ? [
              {
                y: settings.buffer,
                y2: -1e9,
                borderColor: c.red,
                fillColor: c.red,
                opacity: 0.12,
                label: {
                  text: `Puffer: ${formatCurrency(settings.buffer)}`,
                  position: 'right',
                  textAnchor: 'end',
                  borderColor: c.red,
                  style: { color: '#fff', background: c.red },
                },
              },
            ]
          : []),
      ],
    },
  };
  const historySeries = [
    { name: 'Erfasst', data: enteredValues },
    { name: 'Berechnet', data: computedValues },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Salden</h2>
        {!showForm && (
          <button type="button" className="button buttonPrimary" onClick={startCreate}>
            <MdiIcon name="plus" color="#ffffff" size={16} />
            Saldo hinzufügen
          </button>
        )}
      </div>

      <Dialog
        open={showForm}
        onClose={cancelEdit}
        title={editingId !== null ? 'Saldo bearbeiten' : 'Saldo hinzufügen'}
      >
        <form onSubmit={submit} className={styles.form}>
          <FormField label="Datum">
            <input
              type="date"
              className="input"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Saldo">
            <input
              type="number"
              step="0.01"
              className="input"
              value={form.balance}
              onChange={(e) => setForm({ ...form, balance: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Typ">
            <select
              className="input"
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as BalanceAnchor['type'] })}
            >
              <option value="start">{TYPE_LABELS.start}</option>
              <option value="checkpoint">{TYPE_LABELS.checkpoint}</option>
              <option value="month_end">{TYPE_LABELS.month_end}</option>
            </select>
          </FormField>
          <FormField label="Notiz">
            <input
              className="input"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </FormField>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className="button buttonPrimary">
              Speichern
            </button>
            <button type="button" className="button buttonSecondary" onClick={cancelEdit}>
              Abbrechen
            </button>
          </div>
        </form>
      </Dialog>

      <div className={`cardFlush ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Typ</th>
              <th className={styles.amountRight}>Erfasst</th>
              <th className={styles.amountRight}>Berechnet</th>
              <th className={styles.amountRight}>Differenz</th>
              <th className={styles.amountRight}>Δ % Vormonatsende</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {anchors.map((a) => {
              const cp = series.checkpoints.find((c) => c.id === a.id);
              const pct = monthEndChangePct.get(a.id) ?? null;
              return (
                <tr key={a.id}>
                  <td data-label="Datum">{formatDate(a.date)}</td>
                  <td data-label="Typ">
                    {TYPE_LABELS[a.type]}
                    {a.note && <div className={styles.subLabel}>{a.note}</div>}
                  </td>
                  <td className={styles.amountRight} data-label="Erfasst">{a.balance.toFixed(2)} €</td>
                  <td className={styles.amountRight} data-label="Berechnet">{cp ? `${cp.computed.toFixed(2)} €` : '–'}</td>
                  <td
                    className={`${styles.amountRight} ${cp && Math.abs(cp.diff) > 0.01 ? styles.diffBad : ''}`}
                    data-label="Differenz"
                  >
                    {cp ? `${cp.diff.toFixed(2)} €` : '–'}
                  </td>
                  <td
                    className={`${styles.amountRight} ${
                      pct == null ? '' : pct > 0 ? styles.pctUp : pct < 0 ? styles.pctDown : ''
                    }`}
                    data-label="Δ % Vormonatsende"
                  >
                    {pct == null ? '–' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)} %`}
                  </td>
                  <td>
                    <div className={styles.actions}>
                      <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEdit(a)}>
                        <MdiIcon name="pencil-outline" variant="accent" />
                      </button>
                      <button className="iconButton" title="Löschen" aria-label="Löschen" onClick={() => remove(a.id)}>
                        <MdiIcon name="delete-outline" variant="danger" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section>
        <div className={`card ${styles.chartCard}`}>
          <h3 className={styles.sectionTitle}>Saldenverlauf</h3>
          <Chart options={historyOptions} series={historySeries} type="line" height="100%" />
        </div>
      </section>
    </div>
  );
}
