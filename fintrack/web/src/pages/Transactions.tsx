import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api';
import type { Category, Transaction } from '../types';

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
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h2 className="text-base font-semibold">Buchungen</h2>
        <label className="text-sm flex items-center gap-1">
          <input
            type="checkbox"
            checked={uncategorized}
            onChange={(e) => setSearchParams(e.target.checked ? { uncategorized: 'true' } : {})}
          />
          nur nicht kategorisierte
        </label>
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2">Datum</th>
              <th className="p-2">Empfänger</th>
              <th className="p-2">Zweck</th>
              <th className="p-2 text-right">Betrag</th>
              <th className="p-2">Kategorie</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{tx.date}</td>
                <td className="p-2">{tx.counterparty}</td>
                <td className="p-2 text-slate-500">{tx.purpose}</td>
                <td className={`p-2 text-right ${tx.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {tx.amount.toFixed(2)} €
                </td>
                <td className="p-2">
                  <select
                    className="border rounded px-1 py-0.5"
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
