import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { LoanSummary } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
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
  const [showForm, setShowForm] = useState(false);
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

  const startCreate = () => {
    setError('');
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
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
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(false);
  };

  const remove = async (id: number) => {
    if (!window.confirm('Darlehen wirklich löschen? Verknüpfte Buchungen bleiben erhalten, verlieren aber ihre Zuordnung.')) return;
    await api.delete(`/loans/${id}`);
    if (editingId === id) cancelEdit();
    load();
  };

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Darlehen</h2>
        {!showForm && (
          <button type="button" className="button buttonPrimary" onClick={startCreate}>
            <MdiIcon name="plus" color="#ffffff" size={16} />
            Darlehen hinzufügen
          </button>
        )}
      </div>

      <Dialog
        open={showForm}
        onClose={cancelEdit}
        title={editingId !== null ? 'Darlehen bearbeiten' : 'Darlehen hinzufügen'}
      >
        <form onSubmit={submit} className={styles.form}>
          <FormField label="Name">
            <input
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Darlehenssumme (€)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              value={form.principal_amount}
              onChange={(e) => setForm({ ...form, principal_amount: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Zinssatz p.a. (%)">
            <input
              type="number"
              step="0.01"
              min="0"
              className="input"
              value={form.interest_rate_annual}
              onChange={(e) => setForm({ ...form, interest_rate_annual: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Monatliche Rate (€)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              value={form.monthly_payment}
              onChange={(e) => setForm({ ...form, monthly_payment: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Startdatum">
            <input
              type="date"
              className="input"
              value={form.start_date}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Suchmuster für Rate-Erkennung (optional)">
            <input
              className="input"
              value={form.match_pattern}
              onChange={(e) => setForm({ ...form, match_pattern: e.target.value })}
            />
          </FormField>
          <FormField label="Notizen (optional)">
            <input
              className="input"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormField>
          {error && <p className={styles.error}>{error}</p>}
          <div className={styles.formActions}>
            <button type="submit" className="button buttonPrimary">
              <MdiIcon name={editingId !== null ? 'content-save-outline' : 'plus'} color="#ffffff" size={16} />
              {editingId !== null ? 'Speichern' : 'Hinzufügen'}
            </button>
            <button type="button" className="button buttonSecondary" onClick={cancelEdit}>
              Abbrechen
            </button>
          </div>
        </form>
      </Dialog>

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
                  <td data-label="Name">
                    <Link className="link" to={`/loans/${loan.id}`}>
                      {loan.name}
                    </Link>
                  </td>
                  <td className={styles.amountRight} data-label="Restschuld">{formatCurrency(loan.remaining_balance)}</td>
                  <td className={styles.amountRight} data-label="Zins p.a.">{loan.interest_rate_annual.toFixed(2)} %</td>
                  <td className={styles.amountRight} data-label="Rate">{formatCurrency(loan.monthly_payment)}</td>
                  <td data-label="Restlaufzeit">
                    {loan.remaining_term_months == null ? (
                      <span className={styles.warning}>läuft nie aus</span>
                    ) : (
                      `${loan.remaining_term_months} Monate (bis ${formatDate(loan.payoff_date)})`
                    )}
                  </td>
                  <td className={styles.actions} data-label="Aktionen">
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
