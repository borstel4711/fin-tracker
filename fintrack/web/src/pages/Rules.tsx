import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Category, Rule } from '../types';

const emptyRule = {
  match_field: 'counterparty' as Rule['match_field'],
  match_type: 'contains' as Rule['match_type'],
  pattern: '',
  category_id: '',
  priority: 100,
};

export default function Rules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyRule);

  const load = () => api.get<Rule[]>('/rules').then(setRules).catch(() => {});
  useEffect(() => {
    load();
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/rules', { ...form, category_id: Number(form.category_id), priority: Number(form.priority) });
    setForm(emptyRule);
    load();
  };

  const remove = async (id: number) => {
    await api.delete(`/rules/${id}`);
    load();
  };

  const recategorize = async () => {
    const res = await api.post<{ updated: number }>('/recategorize', {});
    alert(`${res.updated} Buchungen neu kategorisiert.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Regeln</h2>
        <button className="text-sm bg-slate-800 text-white px-3 py-1.5 rounded" onClick={recategorize}>
          Regeln neu anwenden
        </button>
      </div>

      <form onSubmit={create} className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2 items-end text-sm">
        <select
          value={form.match_field}
          onChange={(e) => setForm({ ...form, match_field: e.target.value as Rule['match_field'] })}
          className="border rounded px-2 py-1"
        >
          <option value="counterparty">Empfänger</option>
          <option value="purpose">Zweck</option>
          <option value="both">beide</option>
        </select>
        <select
          value={form.match_type}
          onChange={(e) => setForm({ ...form, match_type: e.target.value as Rule['match_type'] })}
          className="border rounded px-2 py-1"
        >
          <option value="contains">enthält</option>
          <option value="regex">regex</option>
          <option value="exact">exakt</option>
        </select>
        <input
          className="border rounded px-2 py-1"
          placeholder="Muster"
          value={form.pattern}
          onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          required
        />
        <select
          className="border rounded px-2 py-1"
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          required
        >
          <option value="">Kategorie…</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="border rounded px-2 py-1 w-20"
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
        />
        <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded">
          Regel hinzufügen
        </button>
      </form>

      <ul className="bg-white rounded-lg shadow divide-y text-sm">
        {rules.map((r) => (
          <li key={r.id} className="p-3 flex items-center justify-between">
            <span>
              [{r.priority}] {r.match_field} {r.match_type} „{r.pattern}" → Kategorie #{r.category_id}
            </span>
            <button className="text-red-600 hover:underline" onClick={() => remove(r.id)}>
              löschen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
