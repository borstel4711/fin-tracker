import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { Category, Rule } from '../types';
import { groupCategoriesByParent } from '../utils/categoryTree';
import CategoryBadge from '../components/CategoryBadge';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
import MdiIcon from '../components/MdiIcon';
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [recategorizeResult, setRecategorizeResult] = useState('');

  const load = () => api.get<Rule[]>('/rules').then(setRules).catch(() => {});
  useEffect(() => {
    load();
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
  }, []);

  const groupedCategories = useMemo(() => groupCategoriesByParent(categories), [categories]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyRule);
    setShowForm(true);
  };

  const startEdit = (r: Rule) => {
    setEditingId(r.id);
    setForm({
      match_field: r.match_field,
      match_type: r.match_type,
      pattern: r.pattern,
      category_id: String(r.category_id),
      priority: r.priority,
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setEditingId(null);
    setForm(emptyRule);
    setShowForm(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const payload = { ...form, category_id: Number(form.category_id), priority: Number(form.priority) };
    if (editingId !== null) {
      await api.patch(`/rules/${editingId}`, payload);
    } else {
      await api.post('/rules', payload);
    }
    cancelForm();
    load();
  };

  const remove = async (id: number) => {
    if (!window.confirm('Regel wirklich löschen?')) return;
    await api.delete(`/rules/${id}`);
    load();
  };

  const recategorize = async () => {
    setRecategorizeResult('');
    const res = await api.post<{ updated: number; cleared: number }>('/recategorize', {});
    setRecategorizeResult(
      `${res.updated} Buchung(en) neu kategorisiert, ${res.cleared} veraltete Zuordnung(en) entfernt.`
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Regeln</h2>
        <div className={styles.formActions}>
          <button className="button buttonSecondary" onClick={recategorize}>
            Regeln neu anwenden
          </button>
          {!showForm && (
            <button type="button" className="button buttonPrimary" onClick={startCreate}>
              <MdiIcon name="plus" color="#ffffff" size={16} />
              Regel hinzufügen
            </button>
          )}
        </div>
      </div>

      <Dialog open={showForm} onClose={cancelForm} title={editingId !== null ? 'Regel bearbeiten' : 'Regel hinzufügen'}>
        <form onSubmit={submit} className={styles.form}>
          <FormField label="Feld">
            <select
              value={form.match_field}
              onChange={(e) => setForm({ ...form, match_field: e.target.value as Rule['match_field'] })}
              className="input"
            >
              <option value="counterparty">Empfänger</option>
              <option value="purpose">Zweck</option>
              <option value="both">beide</option>
            </select>
          </FormField>
          <FormField label="Vergleichstyp">
            <select
              value={form.match_type}
              onChange={(e) => setForm({ ...form, match_type: e.target.value as Rule['match_type'] })}
              className="input"
            >
              <option value="contains">enthält</option>
              <option value="regex">regex</option>
              <option value="exact">exakt</option>
            </select>
          </FormField>
          <FormField label="Muster">
            <input
              className="input"
              value={form.pattern}
              onChange={(e) => setForm({ ...form, pattern: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Kategorie">
            <select
              className="input"
              value={form.category_id}
              onChange={(e) => setForm({ ...form, category_id: e.target.value })}
              required
            >
              <option value="">Kategorie…</option>
              {groupedCategories.map(({ category, depth }) => (
                <option key={category.id} value={category.id}>
                  {depth === 1 ? `— ${category.name}` : category.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Priorität">
            <input
              type="number"
              className="input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })}
            />
          </FormField>
          <div className={styles.formActions}>
            <button type="submit" className="button buttonPrimary">
              <MdiIcon name={editingId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
              {editingId !== null ? 'Speichern' : 'Regel hinzufügen'}
            </button>
            <button type="button" className="button buttonSecondary" onClick={cancelForm}>
              Abbrechen
            </button>
          </div>
        </form>
      </Dialog>

      {recategorizeResult && <p className={styles.result}>{recategorizeResult}</p>}

      <ul className={`cardFlush ${styles.list}`}>
        {rules.map((r) => (
          <li key={r.id} className={styles.listItem}>
            <span className={styles.ruleLine}>
              [{r.priority}] {r.match_field} {r.match_type} „{r.pattern}" →{' '}
              <CategoryBadge
                category={categories.find((c) => c.id === r.category_id) ?? null}
                fallback={`Kategorie #${r.category_id}`}
              />
            </span>
            <span className={styles.actions}>
              <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEdit(r)}>
                <MdiIcon name="pencil-outline" variant="accent" />
              </button>
              <button className="iconButton" title="Löschen" aria-label="Löschen" onClick={() => remove(r.id)}>
                <MdiIcon name="delete-outline" variant="danger" />
              </button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
