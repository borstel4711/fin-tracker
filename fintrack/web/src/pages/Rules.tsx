import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Category, Rule } from '../types';
import styles from './Rules.module.css';

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
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Regeln</h2>
        <button className="button buttonSecondary" onClick={recategorize}>
          Regeln neu anwenden
        </button>
      </div>

      <form onSubmit={create} className={`card ${styles.form}`}>
        <select
          value={form.match_field}
          onChange={(e) => setForm({ ...form, match_field: e.target.value as Rule['match_field'] })}
          className="input"
        >
          <option value="counterparty">Empfänger</option>
          <option value="purpose">Zweck</option>
          <option value="both">beide</option>
        </select>
        <select
          value={form.match_type}
          onChange={(e) => setForm({ ...form, match_type: e.target.value as Rule['match_type'] })}
          className="input"
        >
          <option value="contains">enthält</option>
          <option value="regex">regex</option>
          <option value="exact">exakt</option>
        </select>
        <input
          className="input"
          placeholder="Muster"
          value={form.pattern}
          onChange={(e) => setForm({ ...form, pattern: e.target.value })}
          required
        />
        <select
          className="input"
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
          className={`input ${styles.priorityInput}`}
          value={form.priority}
          onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
        />
        <button type="submit" className="button buttonPrimary">
          Regel hinzufügen
        </button>
      </form>

      <ul className={`cardFlush ${styles.list}`}>
        {rules.map((r) => (
          <li key={r.id} className={styles.listItem}>
            <span>
              [{r.priority}] {r.match_field} {r.match_type} „{r.pattern}" → Kategorie #{r.category_id}
            </span>
            <button className="deleteLink" onClick={() => remove(r.id)}>
              löschen
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
