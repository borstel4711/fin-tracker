export interface Category {
  id: number;
  name: string;
  parent_id: number | null;
  color: string | null;
  kind: 'fixed' | 'variable' | 'income' | 'transfer';
  icon: string | null;
  mode: 'one_time' | 'recurring';
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
  computed: number;
  diff: number;
}

export interface BalanceSeriesResponse {
  start: BalanceAnchor | null;
  series: { date: string; balance: number }[];
  checkpoints: Checkpoint[];
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

export interface ImportResult {
  batch_id: number;
  row_count: number;
  inserted: number;
  skipped: number;
  value_date_filled: number;
}
