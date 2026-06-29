import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Chart from 'react-apexcharts';
import type { ApexOptions } from 'apexcharts';
import { api } from '../api';
import { useTheme } from '../ThemeContext';
import { chartTheme } from '../utils/chartTheme';
import type { LoanBalancePoint, LoanDetailResponse, Transaction } from '../types';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/date';
import MdiIcon from '../components/MdiIcon';
import styles from './LoanDetail.module.css';

function balanceAtDate(series: LoanBalancePoint[], date: string): number | null {
  let result: number | null = null;
  for (const p of series) {
    if (p.date <= date) result = p.balance;
    else break;
  }
  return result;
}

function paymentTypeLabel(type: 'rate' | 'sondertilgung'): string {
  return type === 'sondertilgung' ? 'Sondertilgung' : 'Rate';
}

export default function LoanDetail() {
  const { id } = useParams<{ id: string }>();
  const { theme } = useTheme();
  const [detail, setDetail] = useState<LoanDetailResponse | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Transaction[]>([]);

  const load = () => {
    api
      .get<LoanDetailResponse>(`/loans/${id}`)
      .then((data) => {
        setDetail(data);
        setNotFound(false);
      })
      .catch(() => setNotFound(true));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const params = new URLSearchParams({ unassigned_loan: 'true' });
    if (searchQuery) params.set('q', searchQuery);
    const handle = setTimeout(() => {
      api
        .get<Transaction[]>(`/transactions?${params.toString()}`)
        .then(setSearchResults)
        .catch(() => {});
    }, 300);
    return () => clearTimeout(handle);
  }, [searchQuery]);

  const assign = async (transactionId: number, paymentType: 'rate' | 'sondertilgung') => {
    setError('');
    try {
      await api.patch(`/transactions/${transactionId}`, { loan_id: Number(id), loan_payment_type: paymentType });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const unlink = async (transactionId: number) => {
    setError('');
    try {
      await api.patch(`/transactions/${transactionId}`, { loan_id: null, loan_payment_type: null });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const { colors: c, baseOptions } = chartTheme(theme);
  const foreColor = c.muted;

  const history = detail?.history ?? [];
  const projection = detail?.projection ?? [];
  const baseline = detail?.baseline ?? [];
  const loan = detail?.loan;

  const historyCategories1 = useMemo(() => [...history.map((e) => e.date), ...projection.map((p) => p.date)], [
    history,
    projection,
  ]);
  const interestData = useMemo(() => [...history.map((e) => e.interest), ...projection.map(() => null)], [
    history,
    projection,
  ]);
  const principalData = useMemo(() => [...history.map((e) => e.principal), ...projection.map(() => null)], [
    history,
    projection,
  ]);
  const balanceSolid = useMemo(() => [...history.map((e) => e.balance_after), ...projection.map(() => null)], [
    history,
    projection,
  ]);
  const balanceForecast = useMemo(() => {
    if (history.length === 0) return projection.map((p) => p.balance);
    const lastBalance = history[history.length - 1].balance_after;
    const padding = new Array(history.length - 1).fill(null);
    return [...padding, lastBalance, ...projection.map((p) => p.balance)];
  }, [history, projection]);

  const loanOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'loan-history', stacked: true },
    xaxis: { categories: historyCategories1, labels: { formatter: (v: string) => formatDate(v) } },
    yaxis: { labels: { formatter: formatCurrency } },
    tooltip: { ...baseOptions.tooltip, x: { formatter: (v: number) => formatDate(historyCategories1[v - 1]) } },
    colors: [c.red, c.green, c.accent2, c.accent2],
    stroke: { width: [0, 0, 2, 2], dashArray: [0, 0, 0, 6], curve: 'smooth' },
    plotOptions: { bar: { columnWidth: '60%' } },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const loanSeries = [
    { name: 'Zinsanteil', type: 'column', data: interestData },
    { name: 'Tilgungsanteil', type: 'column', data: principalData },
    { name: 'Restschuld', type: 'line', data: balanceSolid },
    { name: 'Restschuld (Prognose)', type: 'line', data: balanceForecast },
  ];

  const actualCombined = useMemo<LoanBalancePoint[]>(
    () => [...history.map((e) => ({ date: e.date, balance: e.balance_after })), ...projection],
    [history, projection]
  );
  const lastHistoryDate = history.length ? history[history.length - 1].date : loan?.start_date ?? '';

  const savingsCategories = useMemo(() => {
    const dates = new Set([...actualCombined.map((p) => p.date), ...baseline.map((p) => p.date)]);
    return Array.from(dates).sort();
  }, [actualCombined, baseline]);
  const savingsActualSolid = useMemo(
    () => savingsCategories.map((d) => (d <= lastHistoryDate ? balanceAtDate(actualCombined, d) : null)),
    [savingsCategories, actualCombined, lastHistoryDate]
  );
  const savingsActualForecast = useMemo(
    () => savingsCategories.map((d) => (d >= lastHistoryDate ? balanceAtDate(actualCombined, d) : null)),
    [savingsCategories, actualCombined, lastHistoryDate]
  );
  const savingsBaseline = useMemo(
    () => savingsCategories.map((d) => balanceAtDate(baseline, d)),
    [savingsCategories, baseline]
  );

  const savingsOptions: ApexOptions = {
    ...baseOptions,
    chart: { ...baseOptions.chart, id: 'loan-savings' },
    xaxis: { categories: savingsCategories, labels: { formatter: (v: string) => formatDate(v) } },
    yaxis: { labels: { formatter: formatCurrency } },
    tooltip: { ...baseOptions.tooltip, x: { formatter: (v: number) => formatDate(savingsCategories[v - 1]) } },
    colors: [c.accent2, c.accent2, c.muted],
    stroke: { width: [2, 2, 2], dashArray: [0, 6, 6], curve: 'smooth' },
    dataLabels: { enabled: false },
    legend: { labels: { colors: foreColor } },
  };
  const savingsSeries = [
    { name: 'Restschuld mit Sondertilgung', type: 'line', data: savingsActualSolid },
    { name: 'Restschuld mit Sondertilgung (Prognose)', type: 'line', data: savingsActualForecast },
    { name: 'Restschuld ohne Sondertilgung (hypothetisch)', type: 'line', data: savingsBaseline },
  ];

  if (notFound) {
    return (
      <div className={styles.page}>
        <Link className={`link ${styles.backLink}`} to="/loans">
          ← Zurück zu Darlehen
        </Link>
        <p className={styles.empty}>Darlehen nicht gefunden.</p>
      </div>
    );
  }

  if (!detail || !loan) return null;

  return (
    <div className={styles.page}>
      <div className={styles.headerRow}>
        <Link className={`link ${styles.backLink}`} to="/loans">
          ← Zurück zu Darlehen
        </Link>
        <h2 className={styles.title}>{loan.name}</h2>
        <p className={styles.subtitle}>
          {formatCurrency(loan.principal_amount)} · {loan.interest_rate_annual.toFixed(2)} % p. a. ·{' '}
          {formatCurrency(loan.monthly_payment)} / Monat · Start {formatDate(loan.start_date)}
        </p>
      </div>
      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.statsGrid}>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statLabel}>Restschuld</span>
          <span className={styles.statValue}>{formatCurrency(loan.remaining_balance)}</span>
        </div>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statLabel}>Gezahlte Zinsen</span>
          <span className={styles.statValue}>{formatCurrency(loan.paid_interest_total)}</span>
        </div>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statLabel}>Gezahlte Tilgung</span>
          <span className={styles.statValue}>{formatCurrency(loan.paid_principal_total)}</span>
        </div>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statLabel}>Gezahlte Sondertilgung</span>
          <span className={styles.statValue}>{formatCurrency(loan.paid_sondertilgung_total)}</span>
        </div>
        <div className={`card ${styles.statCard}`}>
          <span className={styles.statLabel}>Restlaufzeit (aktuell gerechnet)</span>
          {loan.remaining_term_months == null ? (
            <span className={styles.warning}>Amortisiert bei aktuellem Zinssatz nie</span>
          ) : (
            <>
              <span className={styles.statValue}>{loan.remaining_term_months} Monate</span>
              <span className={styles.statSub}>bis {formatDate(loan.payoff_date)}</span>
            </>
          )}
        </div>
      </div>

      <section>
        <h3 className={styles.sectionTitle}>Darlehensverlauf</h3>
        <div className={`card ${styles.chartCard}`}>
          <Chart options={loanOptions} series={loanSeries} type="line" height="100%" />
        </div>
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Ersparnis durch Sondertilgung</h3>
        <div className={`card ${styles.summaryBox}`}>
          {detail.savings.interestSavedTotal == null || detail.savings.monthsSavedTotal == null ? (
            <p className={styles.muted}>
              Ersparnis kann nicht berechnet werden, da das Darlehen (mit oder ohne Sondertilgung) bei der aktuellen
              Rate nicht vollständig amortisiert.
            </p>
          ) : (
            <p>
              Durch deine Sondertilgungen sparst du insgesamt <strong>{formatCurrency(detail.savings.interestSavedTotal)}</strong>{' '}
              Zinsen und verkürzt die Laufzeit um <strong>{detail.savings.monthsSavedTotal} Monate</strong>.
            </p>
          )}
        </div>
        <div className={`card ${styles.chartCard}`}>
          <Chart options={savingsOptions} series={savingsSeries} type="line" height="100%" />
        </div>
        {detail.savings.perSondertilgung.length > 0 && (
          <div className={`cardFlush ${styles.tableWrap}`} style={{ marginTop: 12 }}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className={styles.amountRight}>Betrag</th>
                  <th className={styles.amountRight}>Gesparte Zinsen</th>
                  <th className={styles.amountRight}>Gesparte Monate</th>
                </tr>
              </thead>
              <tbody>
                {detail.savings.perSondertilgung.map((s) => (
                  <tr key={s.transaction_id}>
                    <td data-label="Datum">{formatDate(s.date)}</td>
                    <td className={styles.amountRight} data-label="Betrag">{formatCurrency(Math.abs(s.amount))}</td>
                    <td className={styles.amountRight} data-label="Gesparte Zinsen">
                      {s.interestSaved != null ? formatCurrency(s.interestSaved) : '–'}
                    </td>
                    <td className={styles.amountRight} data-label="Gesparte Monate">{s.monthsSaved != null ? s.monthsSaved : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Zugeordnete Buchungen</h3>
        {history.length === 0 ? (
          <p className={styles.empty}>Noch keine Buchungen zugeordnet.</p>
        ) : (
          <div className={`cardFlush ${styles.tableWrap}`}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Datum</th>
                  <th className={styles.amountRight}>Betrag</th>
                  <th className={styles.amountRight}>Zins-Anteil</th>
                  <th className={styles.amountRight}>Tilgungs-Anteil</th>
                  <th>Typ</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.transaction_id}>
                    <td data-label="Datum">{formatDate(entry.date)}</td>
                    <td className={styles.amountRight} data-label="Betrag">{formatCurrency(entry.amount)}</td>
                    <td className={styles.amountRight} data-label="Zins-Anteil">{formatCurrency(entry.interest)}</td>
                    <td className={styles.amountRight} data-label="Tilgungs-Anteil">{formatCurrency(entry.principal)}</td>
                    <td data-label="Typ">
                      <span className={`${styles.pill} ${entry.payment_type === 'sondertilgung' ? styles.pillAccent : ''}`}>
                        {paymentTypeLabel(entry.payment_type)}
                      </span>
                    </td>
                    <td data-label="Aktionen">
                      <button
                        className="iconButton"
                        title="Entlinken"
                        aria-label="Entlinken"
                        onClick={() => unlink(entry.transaction_id)}
                      >
                        <MdiIcon name="link-off" variant="danger" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Vorschläge</h3>
        {detail.suggestions.length === 0 ? (
          <p className={styles.empty}>Keine passenden Buchungen gefunden.</p>
        ) : (
          <ul className={`cardFlush ${styles.list}`}>
            {detail.suggestions.map((tx) => (
              <li key={tx.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  <strong>{tx.counterparty ?? tx.purpose ?? '–'}</strong>
                  <span className={styles.muted}>
                    {formatDate(tx.date)} · {formatCurrency(tx.amount)}
                  </span>
                </span>
                <span className={styles.actions}>
                  <button className="button buttonSecondary" onClick={() => assign(tx.id, 'rate')}>
                    Als Rate zuordnen
                  </button>
                  <button className="button buttonSecondary" onClick={() => assign(tx.id, 'sondertilgung')}>
                    Als Sondertilgung zuordnen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className={styles.sectionTitle}>Buchung manuell verknüpfen</h3>
        <div className={styles.searchRow}>
          <input
            type="text"
            className="input"
            placeholder="Suche nach Empfänger oder Zweck…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        {searchResults.length === 0 ? (
          <p className={styles.empty}>Keine unverknüpften Buchungen gefunden.</p>
        ) : (
          <ul className={`cardFlush ${styles.list}`}>
            {searchResults.map((tx) => (
              <li key={tx.id} className={styles.listItem}>
                <span className={styles.listMain}>
                  <strong>{tx.counterparty ?? tx.purpose ?? '–'}</strong>
                  <span className={styles.muted}>
                    {formatDate(tx.date)} · {formatCurrency(tx.amount)}
                  </span>
                </span>
                <span className={styles.actions}>
                  <button className="button buttonSecondary" onClick={() => assign(tx.id, 'sondertilgung')}>
                    Als Sondertilgung verknüpfen
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
