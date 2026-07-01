import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Category, Loan, Transaction } from '../types';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { groupCategoriesByParent } from '../utils/categoryTree';
import CategoryBadge from '../components/CategoryBadge';
import DateRangeFilter from '../components/DateRangeFilter';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
import MdiIcon from '../components/MdiIcon';
import styles from './Transactions.module.css';

type SortKey = 'date' | 'value_date' | 'counterparty' | 'purpose' | 'amount' | 'category';
type SortDir = 'asc' | 'desc';

const COLUMNS: { key: SortKey; label: string; amountRight?: boolean }[] = [
  { key: 'date', label: 'Datum' },
  { key: 'value_date', label: 'Wertstellung' },
  { key: 'counterparty', label: 'Empfänger' },
  { key: 'purpose', label: 'Zweck' },
  { key: 'amount', label: 'Betrag', amountRight: true },
  { key: 'category', label: 'Kategorie' },
];

const emptyTxForm = {
  date: '',
  value_date: '',
  counterparty: '',
  purpose: '',
  amount: '',
  direction: 'out' as 'in' | 'out',
  category_id: '',
  loan_id: '',
  loan_payment_type: '' as '' | 'rate' | 'sondertilgung',
};

function paymentTypeLabel(type: 'rate' | 'sondertilgung' | null): string {
  return type === 'sondertilgung' ? 'Sondertilgung' : 'Rate';
}

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });

  const [showForm, setShowForm] = useState(false);
  const [editingTxId, setEditingTxId] = useState<number | null>(null);
  const [txForm, setTxForm] = useState(emptyTxForm);
  const [formError, setFormError] = useState('');

  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const category = searchParams.get('category');
  const uncategorized = searchParams.get('uncategorized') === 'true';
  const q = searchParams.get('q') ?? '';
  const [qInput, setQInput] = useState(q);

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === '') next.delete(key);
      else next.set(key, value);
    }
    setSearchParams(next);
  };

  const load = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (uncategorized) params.set('uncategorized', 'true');
    else if (category) params.set('category', category);
    if (q) params.set('q', q);
    return api
      .get<Transaction[]>(`/transactions?${params.toString()}`)
      .then(setTransactions)
      .catch(() => {});
  };

  useEffect(() => {
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
    api.get<Loan[]>('/loans').then(setLoans).catch(() => {});
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, category, uncategorized, q]);

  useEffect(() => {
    const handle = setTimeout(() => updateParams({ q: qInput || null }), 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  const updateCategory = async (id: number, categoryId: string) => {
    await api.patch(`/transactions/${id}`, { category_id: categoryId ? Number(categoryId) : null });
    await load();
    setEditingRowId(null);
  };

  const categoryById = new Map(categories.map((c) => [c.id, c]));
  const loanById = new Map(loans.map((l) => [l.id, l]));
  const groupedCategories = useMemo(() => groupCategoriesByParent(categories), [categories]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  const sortValue = (tx: Transaction, key: SortKey): string | number => {
    switch (key) {
      case 'amount':
        return tx.amount;
      case 'category':
        return (tx.category_id ? categoryById.get(tx.category_id)?.name : null) ?? '';
      case 'value_date':
        return tx.value_date ?? '';
      case 'counterparty':
        return tx.counterparty ?? '';
      case 'purpose':
        return tx.purpose ?? '';
      default:
        return tx.date;
    }
  };

  const sortedTransactions = useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...transactions].sort((a, b) => {
      const av = sortValue(a, sort.key);
      const bv = sortValue(b, sort.key);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, sort, categories]);

  const startCreate = () => {
    setFormError('');
    setEditingTxId(null);
    setTxForm(emptyTxForm);
    setShowForm(true);
  };

  const startEditTx = (tx: Transaction) => {
    setFormError('');
    setEditingTxId(tx.id);
    setTxForm({
      date: tx.date,
      value_date: tx.value_date ?? '',
      counterparty: tx.counterparty ?? '',
      purpose: tx.purpose ?? '',
      amount: String(Math.abs(tx.amount)),
      direction: tx.amount < 0 ? 'out' : 'in',
      category_id: tx.category_id != null ? String(tx.category_id) : '',
      loan_id: tx.loan_id != null ? String(tx.loan_id) : '',
      loan_payment_type: tx.loan_payment_type ?? '',
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingTxId(null);
    setTxForm(emptyTxForm);
    setFormError('');
  };

  const submitTx = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    const signedAmount =
      txForm.direction === 'out' ? -Math.abs(Number(txForm.amount)) : Math.abs(Number(txForm.amount));
    const payload = {
      date: txForm.date,
      value_date: txForm.value_date || null,
      amount: signedAmount,
      counterparty: txForm.counterparty || null,
      purpose: txForm.purpose || null,
      category_id: txForm.category_id ? Number(txForm.category_id) : null,
      loan_id: txForm.loan_id ? Number(txForm.loan_id) : null,
      loan_payment_type: txForm.loan_id ? txForm.loan_payment_type || 'rate' : null,
    };
    try {
      if (editingTxId !== null) {
        await api.patch(`/transactions/${editingTxId}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      cancelForm();
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : String(err));
    }
  };

  const removeTx = async (id: number) => {
    if (!window.confirm('Buchung wirklich löschen?')) return;
    await api.delete(`/transactions/${id}`);
    if (editingTxId === id) cancelForm();
    load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Buchungen</h2>
        {!showForm && (
          <button type="button" className="button buttonPrimary" onClick={startCreate}>
            <MdiIcon name="plus" color="#ffffff" size={16} />
            Neue Buchung
          </button>
        )}
      </div>

      <Dialog
        open={showForm}
        onClose={cancelForm}
        title={editingTxId !== null ? 'Buchung bearbeiten' : 'Neue Buchung'}
      >
        <form onSubmit={submitTx} className={styles.txForm}>
          <FormField label="Datum">
            <input
              type="date"
              className="input"
              value={txForm.date}
              onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Wertstellung">
            <input
              type="date"
              className="input"
              value={txForm.value_date}
              onChange={(e) => setTxForm({ ...txForm, value_date: e.target.value })}
            />
          </FormField>
          <FormField label="Empfänger">
            <input
              className="input"
              value={txForm.counterparty}
              onChange={(e) => setTxForm({ ...txForm, counterparty: e.target.value })}
            />
          </FormField>
          <FormField label="Zweck">
            <input
              className="input"
              value={txForm.purpose}
              onChange={(e) => setTxForm({ ...txForm, purpose: e.target.value })}
            />
          </FormField>
          <FormField label="Art">
            <div className={styles.filterRow}>
              <button
                type="button"
                className={`${styles.pill} ${txForm.direction === 'out' ? styles.pillActive : ''}`}
                onClick={() => setTxForm({ ...txForm, direction: 'out' })}
              >
                Ausgabe
              </button>
              <button
                type="button"
                className={`${styles.pill} ${txForm.direction === 'in' ? styles.pillActive : ''}`}
                onClick={() => setTxForm({ ...txForm, direction: 'in' })}
              >
                Einnahme
              </button>
            </div>
          </FormField>
          <FormField label="Betrag (€)">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={txForm.amount}
              onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Kategorie">
            <select
              className="input"
              value={txForm.category_id}
              onChange={(e) => setTxForm({ ...txForm, category_id: e.target.value })}
            >
              <option value="">Keine Kategorie</option>
              {groupedCategories.map(({ category, depth }) => (
                <option key={category.id} value={category.id}>
                  {depth === 1 ? `— ${category.name}` : category.name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Darlehen">
            <select
              className="input"
              value={txForm.loan_id}
              onChange={(e) =>
                setTxForm({
                  ...txForm,
                  loan_id: e.target.value,
                  loan_payment_type: e.target.value ? txForm.loan_payment_type || 'rate' : '',
                })
              }
            >
              <option value="">Kein Darlehen</option>
              {loans.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </FormField>
          {txForm.loan_id && (
            <FormField label="Zahlungsart">
              <select
                className="input"
                value={txForm.loan_payment_type}
                onChange={(e) =>
                  setTxForm({ ...txForm, loan_payment_type: e.target.value as 'rate' | 'sondertilgung' })
                }
              >
                <option value="rate">{paymentTypeLabel('rate')}</option>
                <option value="sondertilgung">{paymentTypeLabel('sondertilgung')}</option>
              </select>
            </FormField>
          )}
          {formError && <p className={styles.error}>{formError}</p>}
          <div className={styles.formActions}>
            <button type="submit" className="button buttonPrimary">
              <MdiIcon name={editingTxId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
              {editingTxId !== null ? 'Speichern' : 'Anlegen'}
            </button>
            <button type="button" className="button buttonSecondary" onClick={cancelForm}>
              Abbrechen
            </button>
          </div>
        </form>
      </Dialog>

      <div className={`card ${styles.filterPane}`}>
        <DateRangeFilter
          value={{ from, to }}
          onChange={(range) => updateParams({ from: range.from || null, to: range.to || null })}
        />

        <input
          type="text"
          className="input"
          placeholder="Suche nach Empfänger oder Zweck…"
          value={qInput}
          onChange={(e) => setQInput(e.target.value)}
        />

        <div className={styles.filterRow}>
          <button
            type="button"
            className={`${styles.pill} ${!category && !uncategorized ? styles.pillActive : ''}`}
            onClick={() => updateParams({ category: null, uncategorized: null })}
          >
            Alle
          </button>
          <button
            type="button"
            className={`${styles.pill} ${uncategorized ? styles.pillActive : ''}`}
            onClick={() => updateParams({ category: null, uncategorized: 'true' })}
          >
            Nicht kategorisiert
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`${styles.pill} ${category === String(c.id) ? styles.pillActive : ''}`}
              onClick={() => updateParams({ category: String(c.id), uncategorized: null })}
            >
              <CategoryBadge category={c} />
            </button>
          ))}
        </div>
      </div>

      <div className={styles.mobileSort}>
        <select
          className="input"
          value={sort.key}
          onChange={(e) => setSort({ key: e.target.value as SortKey, dir: 'asc' })}
        >
          {COLUMNS.map((col) => (
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
              {COLUMNS.map((col) => (
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
              <th>Darlehen</th>
              <th>Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {sortedTransactions.map((tx) => (
              <tr key={tx.id}>
                <td className={styles.nowrap} data-label="Datum">{formatDate(tx.date)}</td>
                <td className={`${styles.nowrap} ${styles.muted}`} data-label="Wertstellung">{formatDate(tx.value_date)}</td>
                <td data-label="Empfänger">{tx.counterparty}</td>
                <td className={styles.muted} data-label="Zweck">{tx.purpose}</td>
                <td
                  className={`${styles.amountRight} ${tx.amount < 0 ? styles.negative : styles.positive}`}
                  data-label="Betrag"
                >
                  {formatCurrency(tx.amount)}
                </td>
                <td data-label="Kategorie">
                  {editingRowId === tx.id ? (
                    <select
                      className="input inputSmall"
                      autoFocus
                      defaultValue={tx.category_id ?? ''}
                      onBlur={() => setEditingRowId(null)}
                      onChange={(e) => updateCategory(tx.id, e.target.value)}
                    >
                      <option value="">–</option>
                      {groupedCategories.map(({ category, depth }) => (
                        <option key={category.id} value={category.id}>
                          {depth === 1 ? `— ${category.name}` : category.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={styles.categoryCell}
                      onClick={() => setEditingRowId(tx.id)}
                    >
                      <CategoryBadge
                        category={tx.category_id ? categoryById.get(tx.category_id) : null}
                        fallback="Nicht kategorisiert"
                      />
                    </span>
                  )}
                </td>
                <td className={styles.muted} data-label="Darlehen">
                  {tx.loan_id != null ? (
                    <Link className="link" to={`/loans/${tx.loan_id}`}>
                      {loanById.get(tx.loan_id)?.name ?? 'Darlehen'} · {paymentTypeLabel(tx.loan_payment_type)}
                    </Link>
                  ) : (
                    '–'
                  )}
                </td>
                <td className={styles.actions} data-label="Aktionen">
                  <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEditTx(tx)}>
                    <MdiIcon name="pencil-outline" variant="accent" />
                  </button>
                  <button className="iconButton" title="Löschen" aria-label="Löschen" onClick={() => removeTx(tx.id)}>
                    <MdiIcon name="delete-outline" variant="danger" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
