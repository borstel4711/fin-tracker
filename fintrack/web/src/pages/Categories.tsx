import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Category } from '../types';
import styles from './Categories.module.css';

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
    <div className={styles.page}>
      <h2 className={styles.title}>Kategorien</h2>
      <form onSubmit={create} className={`card ${styles.form}`}>
        <input
          className="input"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <select
          className="input"
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
        <button type="submit" className="button buttonPrimary">
          Hinzufügen
        </button>
      </form>

      <ul className={`cardFlush ${styles.list}`}>
        {categories.map((c) => (
          <li key={c.id} className={styles.listItem}>
            <span className={styles.nameRow}>
              <span className={styles.colorDot} style={{ background: c.color ?? undefined }} />
              {c.name} <span className={styles.kind}>({c.kind})</span>
            </span>
            <button className="deleteLink" onClick={() => remove(c.id)}>
              löschen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
