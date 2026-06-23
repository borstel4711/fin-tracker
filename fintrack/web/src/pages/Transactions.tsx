import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Category, Transaction } from '../types';
import { formatDate } from '../utils/date';
import CategoryBadge from '../components/CategoryBadge';
import DateRangeFilter from '../components/DateRangeFilter';
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

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [editingRowId, setEditingRowId] = useState<number | null>(null);
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({ key: 'date', dir: 'desc' });

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

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Buchungen</h2>
      </div>

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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
