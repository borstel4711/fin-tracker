import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Category, Loan, Transaction } from '../types';
import { formatDate } from '../utils/date';
import CategoryBadge from '../components/CategoryBadge';
import DateRangeFilter from '../components/DateRangeFilter';
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

      {showForm && (
        <form onSubmit={submitTx} className={`card ${styles.txForm}`}>
          <input
            type="date"
            className="input"
            value={txForm.date}
            onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
            required
          />
          <input
            type="date"
            className="input"
            placeholder="Wertstellung"
            value={txForm.value_date}
            onChange={(e) => setTxForm({ ...txForm, value_date: e.target.value })}
          />
          <input
            className="input"
            placeholder="Empfänger"
            value={txForm.counterparty}
            onChange={(e) => setTxForm({ ...txForm, counterparty: e.target.value })}
          />
          <input
            className="input"
            placeholder="Zweck"
            value={txForm.purpose}
            onChange={(e) => setTxForm({ ...txForm, purpose: e.target.value })}
          />
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
          <input
            type="number"
            step="0.01"
            min="0"
            className="input"
            placeholder="Betrag (€)"
            value={txForm.amount}
            onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
            required
          />
          <select
            className="input"
            value={txForm.category_id}
            onChange={(e) => setTxForm({ ...txForm, category_id: e.target.value })}
          >
            <option value="">Keine Kategorie</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <button type="submit" className="button buttonPrimary">
            <MdiIcon name={editingTxId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
            {editingTxId !== null ? 'Speichern' : 'Anlegen'}
          </button>
          <button type="button" className="button buttonSecondary" onClick={cancelForm}>
            Abbrechen
          </button>
        </form>
      )}
      {formError && <p className={styles.error}>{formError}</p>}

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
                <td className={styles.nowrap}>{formatDate(tx.date)}</td>
                <td className={`${styles.nowrap} ${styles.muted}`}>{formatDate(tx.value_date)}</td>
                <td>{tx.counterparty}</td>
                <td className={styles.muted}>{tx.purpose}</td>
                <td className={`${styles.amountRight} ${tx.amount < 0 ? styles.negative : styles.positive}`}>
                  {tx.amount.toFixed(2)} €
                </td>
                <td>
                  {editingRowId === tx.id ? (
                    <select
                      className="input inputSmall"
                      autoFocus
                      defaultValue={tx.category_id ?? ''}
                      onBlur={() => setEditingRowId(null)}
                      onChange={(e) => updateCategory(tx.id, e.target.value)}
                    >
                      <option value="">–</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
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
                <td className={styles.muted}>
                  {tx.loan_id != null ? (
                    <Link className="link" to={`/loans/${tx.loan_id}`}>
                      {loanById.get(tx.loan_id)?.name ?? 'Darlehen'} · {paymentTypeLabel(tx.loan_payment_type)}
                    </Link>
                  ) : (
                    '–'
                  )}
                </td>
                <td className={styles.actions}>
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
