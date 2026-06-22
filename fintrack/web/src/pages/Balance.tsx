import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { BalanceAnchor, BalanceSeriesResponse } from '../types';

const emptyAnchor = { date: '', balance: '', type: 'checkpoint' as BalanceAnchor['type'], note: '' };

export default function Balance() {
  const [anchors, setAnchors] = useState<BalanceAnchor[]>([]);
  const [series, setSeries] = useState<BalanceSeriesResponse>({ start: null, series: [], checkpoints: [] });
  const [form, setForm] = useState(emptyAnchor);
  const [error, setError] = useState('');

  const load = () => {
    api.get<BalanceAnchor[]>('/balance/anchors').then(setAnchors).catch(() => {});
    api.get<BalanceSeriesResponse>('/balance/series').then(setSeries).catch(() => {});
  };
  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/balance/anchors', { ...form, balance: Number(form.balance) });
      setForm(emptyAnchor);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Saldo-Anker</h2>

      <form onSubmit={create} className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2 items-end text-sm">
        <input
          type="date"
          className="border rounded px-2 py-1"
          value={form.date}
          onChange={(e) => setForm({ ...form, date: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          className="border rounded px-2 py-1"
          placeholder="Saldo"
          value={form.balance}
          onChange={(e) => setForm({ ...form, balance: e.target.value })}
          required
        />
        <select
          className="border rounded px-2 py-1"
          value={form.type}
          onChange={(e) => setForm({ ...form, type: e.target.value as BalanceAnchor['type'] })}
        >
          <option value="start">Start</option>
          <option value="checkpoint">Checkpoint</option>
          <option value="month_end">Monatsende</option>
        </select>
        <input
          className="border rounded px-2 py-1"
          placeholder="Notiz"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
        />
        <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded">
          Anker speichern
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <table className="w-full bg-white rounded-lg shadow text-sm">
        <thead className="bg-slate-100 text-left">
          <tr>
            <th className="p-2">Datum</th>
            <th className="p-2">Typ</th>
            <th className="p-2 text-right">Eingetragen</th>
            <th className="p-2 text-right">Berechnet</th>
            <th className="p-2 text-right">Diff</th>
          </tr>
        </thead>
        <tbody>
          {anchors.map((a) => {
            const cp = series.checkpoints.find((c) => c.id === a.id);
            return (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.date}</td>
                <td className="p-2">{a.type}</td>
                <td className="p-2 text-right">{a.balance.toFixed(2)} €</td>
                <td className="p-2 text-right">{cp ? `${cp.computed.toFixed(2)} €` : '–'}</td>
                <td className={`p-2 text-right ${cp && Math.abs(cp.diff) > 0.01 ? 'text-red-600 font-semibold' : ''}`}>
                  {cp ? `${cp.diff.toFixed(2)} €` : '–'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
