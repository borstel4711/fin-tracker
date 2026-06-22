import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Category, Transaction } from '../types';
import { formatDate } from '../utils/date';
import styles from './Transactions.module.css';

export default function Transactions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const uncategorized = searchParams.get('uncategorized') === 'true';

  const load = () => {
    const params = new URLSearchParams();
    if (uncategorized) params.set('uncategorized', 'true');
    api.get<Transaction[]>(`/transactions?${params.toString()}`).then(setTransactions).catch(() => {});
  };

  useEffect(() => {
    load();
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uncategorized]);

  const updateCategory = async (id: number, categoryId: string) => {
    await api.patch(`/transactions/${id}`, { category_id: categoryId ? Number(categoryId) : null });
    load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Buchungen</h2>
        <label className={styles.filterLabel}>
          <input
            type="checkbox"
            checked={uncategorized}
            onChange={(e) => setSearchParams(e.target.checked ? { uncategorized: 'true' } : {})}
          />
          nur nicht kategorisierte
        </label>
      </div>

      <div className={`cardFlush ${styles.tableWrap}`}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Wertstellung</th>
              <th>Empfänger</th>
              <th>Zweck</th>
              <th className={styles.amountRight}>Betrag</th>
              <th>Kategorie</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id}>
                <td className={styles.nowrap}>{formatDate(tx.date)}</td>
                <td className={`${styles.nowrap} ${styles.muted}`}>{formatDate(tx.value_date)}</td>
                <td>{tx.counterparty}</td>
                <td className={styles.muted}>{tx.purpose}</td>
                <td className={`${styles.amountRight} ${tx.amount < 0 ? styles.negative : styles.positive}`}>
                  {tx.amount.toFixed(2)} €
                </td>
                <td>
                  <select
                    className="input inputSmall"
                    value={tx.category_id ?? ''}
                    onChange={(e) => updateCategory(tx.id, e.target.value)}
                  >
                    <option value="">–</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
