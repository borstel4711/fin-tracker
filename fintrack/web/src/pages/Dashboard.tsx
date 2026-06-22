import { useEffect, useMemo, useState } from 'react';
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import type { MonthlyTotal, BalanceSeriesResponse, CategoryTotal, CompareResponse, Transaction } from '../types';
import styles from './Dashboard.module.css';

const COLORS = ['#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed', '#0891b2', '#db2777'];

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function Dashboard() {
  const { theme } = useTheme();
  const [monthly, setMonthly] = useState<MonthlyTotal[]>([]);
  const [balanceSeries, setBalanceSeries] = useState<BalanceSeriesResponse>({
    start: null,
    series: [],
    checkpoints: [],
  });
  const [byCategory, setByCategory] = useState<CategoryTotal[]>([]);
  const [compare, setCompare] = useState<CompareResponse | null>(null);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const month = currentMonth();

  useEffect(() => {
    api.get<MonthlyTotal[]>('/reports/monthly').then(setMonthly).catch(() => {});
    api.get<BalanceSeriesResponse>('/balance/series').then(setBalanceSeries).catch(() => {});
    api.get<CategoryTotal[]>(`/reports/by-category?month=${month}`).then(setByCategory).catch(() => {});
    api.get<CompareResponse>(`/reports/compare?month=${month}`).then(setCompare).catch(() => {});
    api
      .get<Transaction[]>('/transactions?uncategorized=true')
      .then((rows) => setUncategorizedCount(rows.length))
      .catch(() => {});
  }, [month]);

  const balanceChartData = useMemo(
    () =>
      balanceSeries.series.map((p) => ({
        date: p.date,
        balance: p.balance,
        checkpoint: balanceSeries.checkpoints.find((c) => c.date === p.date)?.balance ?? null,
      })),
    [balanceSeries]
  );

  const gridColor = theme === 'dark' ? '#2e3147' : '#d1d5db';
  const axisColor = theme === 'dark' ? '#94a3b8' : '#6b7280';
  const tooltipStyle = {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    color: 'var(--text)',
  };

  return (
    <div className={styles.page}>
      <section>
        <h2 className={styles.sectionTitle}>Monatsbilanz</h2>
        <div className={`card ${styles.chartCard}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="month" tick={{ fill: axisColor, fontSize: 12 }} />
              <YAxis tick={{ fill: axisColor, fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Legend />
              <Bar dataKey="income" name="Einnahmen" fill="#16a34a" />
              <Bar dataKey="expense" name="Ausgaben" fill="#dc2626" />
              <Line type="monotone" dataKey="net" name="Netto" stroke="#2563eb" strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section>
        <h2 className={styles.sectionTitle}>Kontostandsverlauf</h2>
        <div className={`card ${styles.chartCard}`}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={balanceChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
              <XAxis dataKey="date" tick={{ fill: axisColor, fontSize: 12 }} />
              <YAxis tick={{ fill: axisColor, fontSize: 12 }} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="balance" name="Berechnet" stroke="#2563eb" dot={false} />
              <Line
                type="monotone"
                dataKey="checkpoint"
                name="Soll/Ist-Stützpunkt"
                stroke="#d97706"
                strokeWidth={0}
                dot={{ r: 5 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        {balanceSeries.checkpoints.some((c) => Math.abs(c.diff) > 0.01) && (
          <p className={styles.warning}>
            Achtung: Abweichung zwischen berechnetem und eingetragenem Saldo an mindestens einem Stützpunkt.
          </p>
        )}
      </section>

      <div className={styles.grid2}>
        <section>
          <h2 className={styles.sectionTitle}>Ausgaben nach Kategorie ({month})</h2>
          <div className={`card ${styles.chartCardSmall}`}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={byCategory} dataKey="total" nameKey="name" innerRadius={50} outerRadius={80}>
                  {byCategory.map((entry, i) => (
                    <Cell key={entry.category_id ?? 'none'} fill={entry.color || COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section>
          <h2 className={styles.sectionTitle}>Monatsvergleich</h2>
          {compare && (
            <div className={`card ${styles.compareCard}`}>
              <CompareRow label="Dieser Monat" data={compare.month} />
              <CompareRow label="Vormonat" data={compare.previousMonth} />
              <CompareRow label="Vorjahresmonat" data={compare.previousYear} />
            </div>
          )}
        </section>
      </div>

      <section>
        <a href="#/transactions?uncategorized=true" className={`link ${styles.footerLink}`}>
          {uncategorizedCount} nicht kategorisierte Buchung(en) ansehen →
        </a>
      </section>
    </div>
  );
}

function CompareRow({ label, data }: { label: string; data: MonthlyTotal }) {
  return (
    <div className={styles.compareRow}>
      <span className={styles.compareLabel}>{label}</span>
      <span>
        Ein. {data.income.toFixed(2)} € · Aus. {data.expense.toFixed(2)} € · Netto {data.net.toFixed(2)} €
      </span>
    </div>
  );
}
