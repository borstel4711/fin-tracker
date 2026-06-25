const MAX_PROJECTION_MONTHS = 1200;

function round2(n) {
  return Math.round(n * 100) / 100;
}

function daysInMonth(year, monthIndex0) {
  return new Date(year, monthIndex0 + 1, 0).getDate();
}

// Date-Arithmetik clamped auf den letzten Tag des Zielmonats (statt JS' Standard-
// Rollover), damit ein Darlehen mit Start am 31. nicht monatlich "wegdriftet".
function addMonths(dateStr, n) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  dt.setDate(Math.min(d, daysInMonth(dt.getFullYear(), dt.getMonth())));
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function splitPayment(remainingBalance, interestRateAnnualPct, paymentAmount, isSondertilgung) {
  const absAmount = Math.abs(paymentAmount);
  let interest = 0;
  if (!isSondertilgung) {
    const monthlyRate = interestRateAnnualPct / 100 / 12;
    interest = round2(remainingBalance * monthlyRate);
  }
  let principal = round2(absAmount - interest);
  if (principal > remainingBalance) principal = remainingBalance;
  if (principal < 0) principal = 0;
  const remainingAfter = round2(Math.max(0, remainingBalance - principal));
  return { interest, principal, remainingAfter };
}

// linkedTxAsc: Buchungen eines Darlehens, aufsteigend nach date (dann id) sortiert.
function buildHistory(loan, linkedTxAsc) {
  let balance = loan.principal_amount;
  const entries = [];
  for (const tx of linkedTxAsc) {
    const isSondertilgung = tx.loan_payment_type === 'sondertilgung';
    const split = splitPayment(balance, loan.interest_rate_annual, tx.amount, isSondertilgung);
    entries.push({
      transaction_id: tx.id,
      date: tx.date,
      amount: tx.amount,
      payment_type: isSondertilgung ? 'sondertilgung' : 'rate',
      interest: split.interest,
      principal: split.principal,
      balance_before: balance,
      balance_after: split.remainingAfter,
    });
    balance = split.remainingAfter;
  }
  return { entries, remainingBalance: balance };
}

// Simuliert ab remainingBalance nur mit der regulären Rate (keine weitere
// Sondertilgung) bis die Restschuld 0 erreicht. Liefert months: null, wenn die
// Rate die Zinsen nicht deckt und das Darlehen so nie amortisiert.
function projectForward(remainingBalance, loan, fromDate) {
  if (remainingBalance <= 0) {
    return { months: 0, payoffDate: fromDate, totalInterest: 0, series: [] };
  }

  const monthlyRate = loan.interest_rate_annual / 100 / 12;
  let balance = remainingBalance;
  let date = fromDate;
  let totalInterest = 0;
  const series = [];

  for (let month = 1; month <= MAX_PROJECTION_MONTHS; month++) {
    const interest = round2(balance * monthlyRate);
    let principal = round2(loan.monthly_payment - interest);
    if (principal <= 0) {
      return { months: null, payoffDate: null, totalInterest: null, series };
    }
    if (principal > balance) principal = balance;
    balance = round2(balance - principal);
    totalInterest = round2(totalInterest + interest);
    date = addMonths(date, 1);
    series.push({ date, balance });
    if (balance <= 0) {
      return { months: month, payoffDate: date, totalInterest, series };
    }
  }

  return { months: null, payoffDate: null, totalInterest: null, series };
}

// Hypothetischer Verlauf ohne jede Sondertilgung: dieselben Rate-Zahlungen zu
// denselben Terminen, Sondertilgungen werden beim Durchlauf ignoriert, danach
// projiziert bis zur vollständigen Tilgung.
function buildBaseline(loan, linkedTxAsc) {
  let balance = loan.principal_amount;
  const entries = [];
  for (const tx of linkedTxAsc) {
    if (tx.loan_payment_type === 'sondertilgung') continue;
    const split = splitPayment(balance, loan.interest_rate_annual, tx.amount, false);
    entries.push({
      transaction_id: tx.id,
      date: tx.date,
      amount: tx.amount,
      interest: split.interest,
      principal: split.principal,
      balance_before: balance,
      balance_after: split.remainingAfter,
    });
    balance = split.remainingAfter;
  }
  const lastDate = entries.length ? entries[entries.length - 1].date : loan.start_date;
  const projection = projectForward(balance, loan, lastDate);
  return { entries, remainingBalance: balance, lastDate, projection };
}

// Marginale Ersparnis je Sondertilgung: vergleicht die Projektion unmittelbar vor
// und nach genau dieser einen Zahlung (alle anderen Zahlungen bleiben fix), damit
// jede Sondertilgung ihre eigene Wirkung zugeordnet bekommt statt eines Gesamtwerts.
function computeSondertilgungSavings(loan, historyEntries) {
  return historyEntries
    .filter((e) => e.payment_type === 'sondertilgung')
    .map((e) => {
      const before = projectForward(e.balance_before, loan, e.date);
      const after = projectForward(e.balance_after, loan, e.date);
      const comparable = before.months !== null && after.months !== null;
      return {
        transaction_id: e.transaction_id,
        date: e.date,
        amount: e.amount,
        interestSaved: comparable ? round2(before.totalInterest - after.totalInterest) : null,
        monthsSaved: comparable ? before.months - after.months : null,
      };
    });
}

module.exports = {
  round2,
  addMonths,
  splitPayment,
  buildHistory,
  projectForward,
  buildBaseline,
  computeSondertilgungSavings,
};
