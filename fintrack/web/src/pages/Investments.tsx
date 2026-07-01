import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../api';
import type { AppSettings, BalanceSeriesResponse, Category, CategorySummaryResponse, Investment } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatMonth } from '../utils/date';
import Dialog from '../components/Dialog';
import FormField from '../components/FormField';
import MdiIcon from '../components/MdiIcon';
import styles from './Investments.module.css';

const emptyForm = { name: '', amount: '', priority: '100' };
const MAX_MONTHS_AHEAD = 600;

interface InvestmentPlanItem extends Investment {
  targetMonth: string | null;
  availableNow: number;
  cumulativeAmount: number;
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeInvestmentPlan(
  investments: Investment[],
  currentCash: number,
  buffer: number,
  monthlyRecurringExpense: number,
  monthlyNetCashFlow: number,
  nowMonth: string
): InvestmentPlanItem[] {
  const sorted = [...investments].sort((a, b) => a.priority - b.priority || a.id - b.id);
  let cash = currentCash;
  let month = nowMonth;
  let cumulative = 0;
  let blocked = false;
  return sorted.map((inv) => {
    cumulative += inv.amount;
    if (blocked) {
      return { ...inv, targetMonth: null, availableNow: 0, cumulativeAmount: cumulative };
    }
    const availableNow = cash - buffer - monthlyRecurringExpense;
    let m = month;
    let projected = cash;
    let steps = 0;
    while (projected - buffer - monthlyRecurringExpense < inv.amount) {
      if (steps >= MAX_MONTHS_AHEAD) {
        blocked = true;
        return { ...inv, targetMonth: null, availableNow, cumulativeAmount: cumulative };
      }
      m = shiftMonth(m, 1);
      projected += monthlyNetCashFlow;
      steps++;
    }
    cash = projected - inv.amount;
    month = m;
    return { ...inv, targetMonth: m, availableNow, cumulativeAmount: cumulative };
  });
}

export default function Investments() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [summary, setSummary] = useState<CategorySummaryResponse>({ months: [], categories: [] });
  const [balanceSeries, setBalanceSeries] = useState<BalanceSeriesResponse>({
    start: null,
    series: [],
    checkpoints: [],
    forecastRates: { total: 0, recurring: 0 },
  });
  const [settings, setSettings] = useState<AppSettings>({ id: 1, buffer: 0 });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.get<Investment[]>('/investments').then(setInvestments).catch(() => {});

  useEffect(() => {
    load();
    api.get<Category[]>('/categories').then(setCategories).catch(() => {});
    api.get<CategorySummaryResponse>('/reports/category-summary').then(setSummary).catch(() => {});
    api.get<BalanceSeriesResponse>('/balance/series').then(setBalanceSeries).catch(() => {});
    api.get<AppSettings>('/settings').then(setSettings).catch(() => {});
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { name: form.name, amount: Number(form.amount), priority: Number(form.priority) };
    try {
      if (editingId !== null) {
        await api.patch(`/investments/${editingId}`, payload);
      } else {
        await api.post('/investments', payload);
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

  const startEdit = (inv: Investment) => {
    setError('');
    setEditingId(inv.id);
    setForm({ name: inv.name, amount: String(inv.amount), priority: String(inv.priority) });
    setShowForm(true);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
    setShowForm(false);
  };

  const remove = async (id: number) => {
    await api.delete(`/investments/${id}`);
    if (editingId === id) cancelEdit();
    load();
  };

  const currentCash = useMemo(
    () => (balanceSeries.series.length ? balanceSeries.series[balanceSeries.series.length - 1].balance : null),
    [balanceSeries]
  );

  const categoryModeById = useMemo(() => new Map(categories.map((c) => [c.id, c.mode])), [categories]);

  const monthlyRecurringIncome = useMemo(
    () =>
      summary.categories
        .filter((c) => categoryModeById.get(c.category_id) === 'recurring' && c.avg_per_month > 0)
        .reduce((sum, c) => sum + c.avg_per_month, 0),
    [summary, categoryModeById]
  );

  const monthlyRecurringExpense = useMemo(
    () =>
      summary.categories
        .filter((c) => categoryModeById.get(c.category_id) === 'recurring' && c.avg_per_month < 0)
        .reduce((sum, c) => sum - c.avg_per_month, 0),
    [summary, categoryModeById]
  );

  const monthlyNetCashFlow = useMemo(
    () => monthlyRecurringIncome - monthlyRecurringExpense,
    [monthlyRecurringIncome, monthlyRecurringExpense]
  );

  const nowMonth = currentMonth();

  const plan = useMemo(
    () =>
      currentCash == null
        ? []
        : computeInvestmentPlan(investments, currentCash, settings.buffer, monthlyRecurringExpense, monthlyNetCashFlow, nowMonth),
    [investments, currentCash, settings.buffer, monthlyRecurringExpense, monthlyNetCashFlow, nowMonth]
  );

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <h2 className={styles.title}>Investitionen</h2>
        {!showForm && (
          <button type="button" className="button buttonPrimary" onClick={startCreate}>
            <MdiIcon name="plus" color="#ffffff" size={16} />
            Investition hinzufügen
          </button>
        )}
      </div>

      {currentCash == null ? (
        <div className={`card ${styles.infoBox}`}>
          <p>
            Für die Berechnung wird ein Startsaldo benötigt. Bitte zuerst auf der{' '}
            <a className="link" href="#/balance">
              Saldo-Seite
            </a>{' '}
            einen Startsaldo anlegen.
          </p>
        </div>
      ) : (
        <div className={`card ${styles.infoBox}`}>
          <ul className={styles.assumptions}>
            <li>
              Aktueller Kontostand: <strong>{formatCurrency(currentCash)}</strong>
            </li>
            <li>
              Puffer: <strong>{formatCurrency(settings.buffer)}</strong>
            </li>
            <li>
              Ø wiederkehrende Einnahmen / Monat: <strong>{formatCurrency(monthlyRecurringIncome)}</strong>
            </li>
            <li>
              Ø wiederkehrende Ausgaben / Monat: <strong>{formatCurrency(monthlyRecurringExpense)}</strong>
            </li>
            <li>
              Ø wiederkehrender Cashflow / Monat: <strong>{formatCurrency(monthlyNetCashFlow)}</strong>
            </li>
          </ul>
          <p className={styles.explanation}>
            Für die Prognose berücksichtigen wir ausschließlich wiederkehrende Kategorien (z. B. Gehalt, Miete,
            Abos) als Durchschnitt der letzten 12 Monate. Einmalige Anschaffungen und nicht kategorisierte Buchungen
            fließen bewusst nicht ein, da sie sich nicht zuverlässig in die Zukunft fortschreiben lassen — der
            Cashflow entspricht daher genau wiederkehrenden Einnahmen minus wiederkehrenden Ausgaben. Eine
            Investition gilt als leistbar, sobald nach Abzug ihres Betrags noch genug übrig bleibt, um den Puffer zu
            halten und die wiederkehrenden Ausgaben des jeweiligen Monats zu bezahlen. Bei mehreren Investitionen
            wird zuerst die mit der höchsten Priorität (niedrigste Zahl) berechnet; ihr Betrag gilt danach als
            ausgegeben, bevor die nächste Investition berechnet wird.
          </p>
          {monthlyNetCashFlow <= 0 && (
            <p className={styles.warning}>
              Achtung: Der durchschnittliche Cashflow ist aktuell nicht positiv. Die Prognose kann daher für manche
              Investitionen keinen erreichbaren Zeitpunkt ermitteln.
            </p>
          )}
        </div>
      )}

      <Dialog
        open={showForm}
        onClose={cancelEdit}
        title={editingId !== null ? 'Investition bearbeiten' : 'Investition hinzufügen'}
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
          <FormField label="Betrag (€)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="input"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Priorität">
            <input
              type="number"
              className="input"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
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

      {plan.length === 0 ? (
        <p className={styles.empty}>Noch keine Investitionen angelegt.</p>
      ) : (
        <ul className={`cardFlush ${styles.list}`}>
          {plan.map((item, idx) => {
            const pct = Math.min(100, Math.max(0, (item.availableNow / item.amount) * 100));
            const affordableNow = item.targetMonth !== null && item.targetMonth <= nowMonth;
            return (
              <li key={item.id} className={styles.listItem}>
                <span className={styles.rank}>#{idx + 1}</span>
                <span className={styles.nameRow}>
                  <span className={styles.nameLine}>
                    <strong>{item.name}</strong>
                    <span className={styles.meta}>
                      Prio {item.priority} · {formatCurrency(item.amount)}
                    </span>
                    {affordableNow && <span className={styles.badge}>Jetzt leistbar</span>}
                  </span>
                  <span className={styles.progressTrack}>
                    <span className={styles.progressFill} style={{ width: `${pct}%` }} />
                  </span>
                  <span className={styles.subLabel}>Kumuliert bis hier: {formatCurrency(item.cumulativeAmount)}</span>
                </span>
                <span className={styles.targetMonth}>{item.targetMonth ? formatMonth(item.targetMonth) : 'Nicht absehbar'}</span>
                <span className={styles.actions}>
                  <button className="iconButton" title="Bearbeiten" aria-label="Bearbeiten" onClick={() => startEdit(item)}>
                    <MdiIcon name="pencil-outline" variant="accent" />
                  </button>
                  <button className="iconButton" title="Löschen" aria-label="Löschen" onClick={() => remove(item.id)}>
                    <MdiIcon name="delete-outline" variant="danger" />
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
