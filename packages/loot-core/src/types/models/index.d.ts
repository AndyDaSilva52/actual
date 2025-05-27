export interface AccountEntity {
  id: string;
  name: string;
  offbudget: boolean;
  closed: boolean;
  sort_order: number;
  account_id?: string | null;
  balance_current?: number | null;
  balance_available?: number | null;
  balance_limit?: number | null;
  mask?: string | null;
  official_name?: string | null;
  type?: string | null;
  subtype?: string | null;
  bank?: string | null;
  account_sync_source?: 'simpleFin' | 'goCardless' | null;
  tombstone: boolean;
}

export interface BankEntity {
  id: string;
  bank_id: string;
  name: string;
  tombstone: boolean;
}

export interface CategoryEntity {
  id: string;
  name: string;
  is_income: boolean;
  cat_group: CategoryGroupEntity['id'];
  sort_order: number;
  hidden: boolean;
  goal_def?: string | null; // JSON string
  tombstone: boolean;
}

export interface CategoryGroupEntity {
  id: string;
  name: string;
  is_income: boolean;
  sort_order: number;
  hidden: boolean;
  tombstone: boolean;
}

export interface PayeeEntity {
  id: string;
  name: string;
  transfer_acct?: AccountEntity['id'] | null;
  favorite: boolean;
  learn_categories: boolean;
  tombstone: boolean;
  category?: string | null;
}

export interface RuleEntity {
  id: string;
  stage: string;
  conditions_op: 'and' | 'or';
  conditions: unknown[]; // Array of condition objects
  actions: unknown[]; // Array of action objects
  tombstone: boolean;
}

export interface ScheduleEntity {
  id: string;
  name: string;
  rule: RuleEntity['id'];
  active: boolean;
  completed: boolean;
  posts_transaction: boolean;
  tombstone: boolean;
  // Fields from join with rules
  _payee: PayeeEntity['id'] | null;
  _account: AccountEntity['id'] | null;
  _amount: number | null;
  _amountOp: 'is' | 'isapprox' | 'isbetween' | null; // Assuming these ops
  _date: unknown | null; // Date condition object
  _conditions: unknown[] | null;
  _actions: unknown[] | null;
  // Fields from join with schedule_nextdates
  next_date: string | null; // Date string
}

export interface TransactionEntity {
  id: string;
  is_parent: boolean;
  is_child: boolean;
  date: string; // Date string
  account: AccountEntity['id'];
  amount: number;
  sort_order: number;
  parent_id?: TransactionEntity['id'] | null;
  category?: CategoryEntity['id'] | null;
  payee?: PayeeEntity['id'] | null;
  description?: string | null;
  notes?: string | null;
  financial_id?: string | null;
  error?: string | null;
  imported_description?: string | null;
  transferred_id?: TransactionEntity['id'] | null;
  schedule?: ScheduleEntity['id'] | null;
  starting_balance_flag: boolean;
  tombstone: boolean;
  cleared: boolean;
  reconciled: boolean;
  pending?: boolean | null;
  location?: string | null;
  type?: string | null;
}

export interface CustomReportEntity {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  date_static: boolean;
  date_range: string;
  mode: string;
  group_by: string;
  balance_type: string;
  show_empty: boolean;
  show_offbudget: boolean;
  show_hidden: boolean;
  show_uncateogorized: boolean; // Note: 'uncategorized' is misspelled in DbCustomReport
  selected_categories: string; // JSON string of category IDs
  graph_type: string;
  conditions: string; // JSON string of conditions
  conditions_op: 'and' | 'or';
  metadata: string; // JSON string
  interval: string;
  color_scheme: string;
  include_current: boolean;
  sort_by: string;
  tombstone: boolean;
}

export interface DebtEntity {
  id: string;
  // user_id?: string | null; // Not in DbDebt for now
  creditor_name: string;
  debt_nickname?: string | null;
  account_number?: string | null; // Stored encrypted, decrypted for entity? Or keep as string? Assume string for now.
  debt_type: string; // Consider ENUM string type e.g. 'CREDIT_CARD' | 'MORTGAGE' etc.
  current_balance: number;
  original_balance?: number | null;
  interest_rate_apr: number;
  minimum_monthly_payment: number;
  next_payment_due_date?: string | null; // 'YYYY-MM-DD'
  original_loan_term_months?: number | null;
  compounding_frequency?: string; // 'DAILY' | 'MONTHLY' | 'ANNUALLY'
  late_payment_fee?: number | null;
  other_fees?: Record<string, unknown>[] | null; // JSON: '[{"name": "Annual Fee", "amount": 75, "frequency": "ANNUAL"}]'
  creation_date?: string | null; // ISO8601
  last_updated_date?: string | null; // ISO8601
  custom_order?: number | null;
  promotional_apr_rate?: number | null;
  promotional_apr_expires_date?: string | null; // 'YYYY-MM-DD'
  tombstone: boolean;
}

export interface TransactionDebtLinkEntity {
  id: string;
  transaction_id: string;
  debt_id: string;
  amount_applied?: number | null;
  tombstone?: boolean;
}
