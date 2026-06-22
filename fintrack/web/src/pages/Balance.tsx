import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { BalanceAnchor, BalanceSeriesResponse } from '../types';
import { formatDate } from '../utils/date';
import styles from './Balance.module.css';

const emptyAnchor = { date: '', balance: '', type: 'checkpoint' as BalanceAnchor['type'], note: '' };

export default function Balance() {
  const [anchors, setAnchors] = useState<BalanceAnchor[]>([]);
  const [series, setSeries] = useState<BalanceSeriesResponse>({ start: null, series: [], checkpoints: [] });
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

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Saldo-Anker</h2>

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
          <option value="start">Start</option>
          <option value="checkpoint">Checkpoint</option>
          <option value="month_end">Monatsende</option>
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
                  <td>{a.type}</td>
                  <td className={styles.amountRight}>{a.balance.toFixed(2)} €</td>
                  <td className={styles.amountRight}>{cp ? `${cp.computed.toFixed(2)} €` : '–'}</td>
                  <td className={`${styles.amountRight} ${cp && Math.abs(cp.diff) > 0.01 ? styles.diffBad : ''}`}>
                    {cp ? `${cp.diff.toFixed(2)} €` : '–'}
                  </td>
                  <td>
                    <button className="link" onClick={() => startEdit(a)}>
                      bearbeiten
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
