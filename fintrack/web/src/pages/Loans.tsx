import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { LoanSummary } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import MdiIcon from '../components/MdiIcon';
import styles from './Loans.module.css';

const emptyForm = {
  name: '',
  principal_amount: '',
  interest_rate_annual: '',
  monthly_payment: '',
  start_date: '',
  match_pattern: '',
  notes: '',
};

export default function Loans() {
  const [loans, setLoans] = useState<LoanSummary[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () => api.get<LoanSummary[]>('/loans').then(setLoans).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      name: form.name,
      principal_amount: Number(form.principal_amount),
      interest_rate_annual: Number(form.interest_rate_annual),
      monthly_payment: Number(form.monthly_payment),
      start_date: form.start_date,
      match_pattern: form.match_pattern || null,
      notes: form.notes || null,
    };
    try {
      if (editingId !== null) {
        await api.patch(`/loans/${editingId}`, payload);
      } else {
        await api.post('/loans', payload);
      }
      cancelEdit();
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const startEdit = (loan: LoanSummary) => {
    setError('');
    setEditingId(loan.id);
    setForm({
      name: loan.name,
      principal_amount: String(loan.principal_amount),
      interest_rate_annual: String(loan.interest_rate_annual),
      monthly_payment: String(loan.monthly_payment),
      start_date: loan.start_date,
      match_pattern: loan.match_pattern ?? '',
      notes: loan.notes ?? '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  const remove = async (id: number) => {
    await api.delete(`/loans/${id}`);
    if (editingId === id) cancelEdit();
    load();
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Darlehen</h2>

      <form onSubmit={submit} className={`card ${styles.form}`}>
        <input
          className="input"
          placeholder="Name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="input"
          placeholder="Darlehenssumme (€)"
          value={form.principal_amount}
          onChange={(e) => setForm({ ...form, principal_amount: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0"
          className="input"
          placeholder="Zinssatz p.a. (%)"
          value={form.interest_rate_annual}
          onChange={(e) => setForm({ ...form, interest_rate_annual: e.target.value })}
          required
        />
        <input
          type="number"
          step="0.01"
          min="0.01"
          className="input"
          placeholder="Monatliche Rate (€)"
          value={form.monthly_payment}
          onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })}
          required
        />
        <input
          type="date"
          className="input"
          value={form.start_date}
          onChange={(e) => setForm({ ...form, start_date: e.target.value })}
          required
        />
        <input
          className="input"
          placeholder="Suchmuster für Rate-Erkennung (optional)"
          value={form.match_pattern}
          onChange={(e) => setForm({ ...form, match_pattern: e.target.value })}
        />
        <input
          className="input"
          placeholder="Notizen (optional)"
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
        />
        <button type="submit" className="button buttonPrimary">
          <MdiIcon name={editingId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
          {editingId !== null ? 'Speichern' : 'Hinzufügen'}
        </button>
        {editingId !== null && (
          <button type="button" className="button buttonSecondary" onClick={cancelEdit}>
            Abbrechen
          </button>
        )}
      </form>
      {error && <p className={styles.error}>{error}</p>}

      {loans.length === 0 ? (
        <p className={styles.empty}>Noch keine Darlehen angelegt.</p>
      ) : (
        <div className={`cardFlush ${styles.tableWrap}`}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th className={styles.amountRight}>Restschuld</th>
                <th className={styles.amountRight}>Zins p.a.</th>
                <th className={styles.amountRight}>Rate</th>
                <th>Restlaufzeit</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => (
                <tr key={loan.id}>
                  <td>
                    <Link className="link" to={`/loans/${loan.id}`}>
                      {loan.name}
                    </Link>
                  </td>
                  <td className={styles.amountRight}>{formatCurrency(loan.remaining_balance)}</td>
                  <td className={styles.amountRight}>{loan.interest_rate_annual.toFixed(2)} %</td>
                  <td className={styles.amountRight}>{formatCurrency(loan.monthly_payment)}</td>
                  <td>
                    {loan.remaining_term_months == null ? (
                      <span className={styles.warning}>läuft nie aus</span>
                    ) : (
                      `${loan.remaining_term_months} Monate (bis ${formatDate(loan.payoff_date)})`
                    )}
                  </td>
                  <td className={styles.actions}>
                    <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEdit(loan)}>
                      <MdiIcon name="pencil-outline" variant="accent" />
                    </button>
                    <button className="iconButton" title="Löschen" aria-label="Löschen" onClick={() => remove(loan.id)}>
                      <MdiIcon name="delete-outline" variant="danger" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
