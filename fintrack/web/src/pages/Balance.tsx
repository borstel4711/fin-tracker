import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import type { BalanceAnchor, BalanceSeriesResponse } from '../types';
import { formatDate, formatMonth } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import MdiIcon from '../components/MdiIcon';
import styles from './Balance.module.css';

const emptyAnchor = { date: '', balance: '', type: 'checkpoint' as BalanceAnchor['type'], note: '' };

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
  const [form, setForm] = useState(emptyAnchor);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api.get<BalanceAnchor[]>('/balance/anchors').then(setAnchors).catch(() => {});
    api.get<BalanceSeriesResponse>('/balance/series').then(setSeries).catch(() => {});
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

  const startEdit = (a: BalanceAnchor) => {
    setError('');
    setEditingId(a.id);
    setForm({ date: a.date, balance: String(a.balance), type: a.type, note: a.note ?? '' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyAnchor);
  };

  const chartDates = useMemo(() => anchors.map((a) => a.date), [anchors]);
  const enteredValues = useMemo(() => anchors.map((a) => a.balance), [anchors]);
  const computedValues = useMemo(
    () => anchors.map((a) => series.checkpoints.find((c) => c.id === a.id)?.computed ?? null),
    [anchors, series]
  );

  const foreColor = theme === 'dark' ? '#94a3b8' : '#6b7280';
  const gridColor = theme === 'dark' ? '#2e3147' : '#d1d5db';
  const tooltipTheme = theme === 'dark' ? 'dark' : 'light';

  const historyOptions: ApexOptions = {
    chart: { foreColor, toolbar: { show: false }, background: 'transparent' },
    grid: { borderColor: gridColor },
    xaxis: {
      categories: chartDates,
      labels: { formatter: (v: string) => (v ? formatMonth(v.slice(0, 7)) : '') },
    },
    yaxis: { labels: { formatter: formatCurrency } },
    tooltip: { theme: tooltipTheme, x: { formatter: (v: number) => formatDate(chartDates[v - 1]) } },
    colors: ['#d97706', '#2563eb'],
    stroke: { width: [2, 2], curve: 'smooth' },
    markers: { size: [5, 5] },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const historySeries = [
    { name: 'Eingetragen', data: enteredValues },
    { name: 'Berechnet', data: computedValues },
  ];

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Salden</h2>

      <form onSubmit={submit} className={`card ${styles.form}`}>
        <input
          type="date"
          className="input"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          className="input"
          placeholder="Saldo"
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
          required
        />
        <select
          className="input"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as BalanceAnchor['type'] })}
        >
          <option value="start">{TYPE_LABELS.start}</option>
          <option value="checkpoint">{TYPE_LABELS.checkpoint}</option>
          <option value="month_end">{TYPE_LABELS.month_end}</option>
        </select>
        <input
          className="input"
          placeholder="Notiz"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <button type="submit" className="button buttonPrimary">
          {editingId !== null ? 'Speichern' : 'Anker speichern'}
        </button>
        {editingId !== null && (
          <button type="button" className="button buttonSecondary" onClick={cancelEdit}>
            Abbrechen
          </button>
        )}
      </form>
      {error && <p className={styles.error}>{error}</p>}

      <div className="cardFlush">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Typ</th>
              <th className={styles.amountRight}>Eingetragen</th>
              <th className={styles.amountRight}>Berechnet</th>
              <th className={styles.amountRight}>Diff</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {anchors.map((a) => {
              const cp = series.checkpoints.find((c) => c.id === a.id);
              return (
                <tr key={a.id}>
                  <td>{formatDate(a.date)}</td>
                  <td>{TYPE_LABELS[a.type]}</td>
                  <td className={styles.amountRight}>{a.balance.toFixed(2)} €</td>
                  <td className={styles.amountRight}>{cp ? `${cp.computed.toFixed(2)} €` : '–'}</td>
                  <td className={`${styles.amountRight} ${cp && Math.abs(cp.diff) > 0.01 ? styles.diffBad : ''}`}>
                    {cp ? `${cp.diff.toFixed(2)} €` : '–'}
                  </td>
                  <td>
                    <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEdit(a)}>
                      <MdiIcon name="pencil-outline" variant="accent" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section>
        <h3 className={styles.sectionTitle}>Saldenverlauf</h3>
        <div className={`card ${styles.chartCard}`}>
          <Chart options={historyOptions} series={historySeries} type="line" height="100%" />
        </div>
      </section>
    </div>
  );
}
