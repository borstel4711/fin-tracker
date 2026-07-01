export const COICOP_CODES = [
  'CP00',
  'CP01',
  'CP02',
  'CP03',
  'CP04',
  'CP05',
  'CP06',
  'CP07',
  'CP08',
  'CP09',
  'CP10',
  'CP11',
  'CP12',
] as const;
export type CoicopCode = (typeof COICOP_CODES)[number];

export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  icon: string | null;
  mode: 'one_time' | 'recurring';
  coicop_code: string | null;
}

export interface Rule {
  id: number;
  match_field: 'counterparty' | 'purpose' | 'both';
  match_type: 'contains' | 'regex' | 'exact';
  pattern: string;
  category_id: number;
  priority: number;
  enabled: number;
}

export interface ImportProfile {
  id: number;
  name: string;
  delimiter: string;
  encoding: 'latin1' | 'utf8';
  date_format: string;
  decimal_comma: number;
  skip_rows: number;
  col_date: string;
  col_value_date: string | null;
  col_amount: string | null;
  col_debit: string | null;
  col_credit: string | null;
  col_counterparty: string | null;
  col_purpose: string | null;
  col_balance: string | null;
}

export interface Transaction {
  id: number;
  date: string;
  value_date: string | null;
  amount: number;
  type: 'in' | 'out';
  counterparty: string | null;
  purpose: string | null;
  category_id: number | null;
  category_src: string | null;
  source_file: string | null;
  import_batch: number | null;
  hash: string;
  loan_id: number | null;
  loan_payment_type: 'rate' | 'sondertilgung' | null;
}

export interface BalanceAnchor {
  id: number;
  date: string;
  balance: number;
  type: 'start' | 'checkpoint' | 'month_end';
  source: 'manual' | 'csv';
  note: string | null;
}

export interface Checkpoint extends BalanceAnchor {
  // null, wenn der Anker vor dem Start-Anker liegt (kein Soll/Ist-Vergleich möglich)
  computed: number | null;
  diff: number | null;
}

export interface BalanceSeriesResponse {
  start: BalanceAnchor | null;
  series: { date: string; balance: number }[];
  checkpoints: Checkpoint[];
  forecastRates: { total: number; recurring: number };
}

export interface AppSettings {
  id: number;
  buffer: number;
}

export interface Investment {
  id: number;
  name: string;
  amount: number;
  priority: number;
}

export interface Loan {
  id: number;
  name: string;
  principal_amount: number;
  interest_rate_annual: number;
  monthly_payment: number;
  start_date: string;
  match_pattern: string | null;
  notes: string | null;
}

export interface LoanSummary extends Loan {
  remaining_balance: number;
  paid_interest_total: number;
  paid_principal_total: number;
  paid_sondertilgung_total: number;
  remaining_term_months: number | null;
  payoff_date: string | null;
}

export interface LoanHistoryEntry {
  transaction_id: number;
  date: string;
  amount: number;
  payment_type: 'rate' | 'sondertilgung';
  interest: number;
  principal: number;
  balance_before: number;
  balance_after: number;
}

export interface LoanBalancePoint {
  date: string;
  balance: number;
}

export interface LoanSondertilgungSaving {
  transaction_id: number;
  date: string;
  amount: number;
  interestSaved: number | null;
  monthsSaved: number | null;
}

export interface LoanDetailResponse {
  loan: LoanSummary;
  history: LoanHistoryEntry[];
  projection: LoanBalancePoint[];
  baseline: LoanBalancePoint[];
  savings: {
    interestSavedTotal: number | null;
    monthsSavedTotal: number | null;
    perSondertilgung: LoanSondertilgungSaving[];
  };
  suggestions: Transaction[];
}

export interface MonthlyTotal {
  month: string;
  income: number;
  expense: number;
  net: number;
}

export interface CategoryTotal {
  category_id: number | null;
  name: string;
  color: string | null;
  total: number;
}

export interface CategoryMonthlyTotal {
  month: string;
  category_id: number | null;
  name: string;
  color: string | null;
  total: number;
}

export interface CompareResponse {
  month: MonthlyTotal;
  previousMonth: MonthlyTotal;
  previousYear: MonthlyTotal;
}

export interface InflationHeadlinePoint {
  month: string;
  personalRateYoy: number | null;
  officialRateYoy: number | null;
}

export interface InflationBreakdownRow {
  coicop: string;
  label: string;
  categoryNames: string[];
  personalRateYoy: number | null;
  officialRateYoy: number | null;
}

export interface CsvCheckpoint {
  date: string;
  balance: number;
  created: boolean;
}

export interface ImportResult {
  batch_id: number;
  row_count: number;
  inserted: number;
  skipped: number;
  value_date_filled: number;
  csv_checkpoint: CsvCheckpoint | null;
}

export interface ImportBatch {
  id: number;
  profile_id: number | null;
  profile_name: string | null;
  filename: string | null;
  imported_at: string;
  row_count: number;
  inserted: number;
  skipped: number;
}

export interface SavingsRatePoint {
  month: string;
  income: number;
  expense: number;
  net: number;
  rate: number | null;
  rate3m: number | null;
  rate6m: number | null;
}

export interface TopTransaction {
  id: number;
  date: string;
  amount: number;
  counterparty: string | null;
  purpose: string | null;
  category_id: number | null;
}

export interface RecurringPayment {
  counterparty: string | null;
  amount: number;
  occurrences: number;
  firstDate: string;
  lastDate: string;
  avgIntervalDays: number;
  category_id: number | null;
}

export interface AnomalyTransaction {
  id: number;
  date: string;
  amount: number;
  counterparty: string | null;
  purpose: string | null;
  category_id: number;
  categoryAvg: number;
  ratio: number;
}

export interface MonthStatusResponse {
  month: string;
  currentBalance: number | null;
  buffer: number;
  expectedRemainingIncome: number;
  expectedRemainingExpense: number;
  remainingBudget: number | null;
  mtdIncome: number;
  mtdExpense: number;
  uncategorizedCount: number;
}

export interface CategorySummaryRow {
  category_id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  icon: string | null;
  mode: Category['mode'];
  total_prev_year_month: number;
  total_year: number;
  total_prev_month: number;
  total_month: number;
  avg_per_month: number;
  trend_1m_pct: number;
  trend_6m_pct: number;
  trend_12m_pct: number;
  trend_24m_pct: number;
  monthly: number[];
  monthly24: number[];
}

export interface CategorySummaryResponse {
  months: string[];
  categories: CategorySummaryRow[];
}
