import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Category } from '../types';

const KINDS: Category['kind'][] = ['fixed', 'variable', 'income', 'transfer'];

export default function Categories() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState({ name: '', kind: 'variable' as Category['kind'], color: '#2563eb' });

  const load = () => api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    await api.post('/categories', form);
    setForm({ name: '', kind: 'variable', color: '#2563eb' });
    load();
  };

  const remove = async (id: number) => {
    await api.delete(`/categories/${id}`);
    load();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-base font-semibold">Kategorien</h2>
      <form onSubmit={create} className="bg-white rounded-lg shadow p-4 flex flex-wrap gap-2 items-end text-sm">
        <input
          className="border rounded px-2 py-1"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="border rounded px-2 py-1"
          value={form.kind}
          onChange={(e) => setForm({ ...form, kind: e.target.value as Category['kind'] })}
        >
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
        <button type="submit" className="bg-blue-600 text-white px-3 py-1.5 rounded">
          Hinzufügen
        </button>
      </form>

      <ul className="bg-white rounded-lg shadow divide-y text-sm">
        {categories.map((c) => (
          <li key={c.id} className="p-3 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full inline-block" style={{ background: c.color ?? undefined }} />
              {c.name} <span className="text-slate-400">({c.kind})</span>
            </span>
            <button className="text-red-600 hover:underline" onClick={() => remove(c.id)}>
              löschen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
