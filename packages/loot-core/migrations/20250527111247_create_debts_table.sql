CREATE TABLE debts (
    id TEXT PRIMARY KEY,
    -- user_id TEXT, -- Commenting out for now, may not be needed for local-first
    creditor_name TEXT,
    debt_nickname TEXT,
    account_number TEXT, -- Will store encrypted value
    debt_type TEXT, -- Consider adding CHECK constraint later if appropriate for SQLite version
    current_balance REAL,
    original_balance REAL,
    interest_rate_apr REAL,
    minimum_monthly_payment REAL,
    next_payment_due_date TEXT, -- Store as YYYY-MM-DD
    original_loan_term_months INTEGER,
    compounding_frequency TEXT DEFAULT 'MONTHLY', -- Store as ENUM-like string
    late_payment_fee REAL,
    other_fees TEXT, -- Store as JSON string: '[{"name": "Annual Fee", "amount": 75, "frequency": "ANNUAL"}]'
    creation_date TEXT, -- Store as ISO8601 string
    last_updated_date TEXT, -- Store as ISO8601 string
    custom_order INTEGER,
    promotional_apr_rate REAL,
    promotional_apr_expires_date TEXT, -- Store as YYYY-MM-DD
    tombstone INTEGER DEFAULT 0
);

-- Optional: Add indexes for frequently queried columns
CREATE INDEX IF NOT EXISTS idx_debts_tombstone ON debts (tombstone);
-- CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts (user_id); -- If user_id is added

-- Note on CHECK constraints for debt_type and compounding_frequency:
-- While useful, SQLite versions before 3.3.0 don't enforce them.
-- Actual's target environment might influence this. For now, define without them,
-- validation can occur at the application layer.
-- Example if they were to be added:
-- debt_type TEXT CHECK (debt_type IN ('CREDIT_CARD', 'PERSONAL_LOAN', 'STUDENT_LOAN', 'MORTGAGE', 'AUTO_LOAN', 'LINE_OF_CREDIT', 'MEDICAL_DEBT', 'OTHER_INSTALLMENT', 'CUSTOM')),
-- compounding_frequency TEXT DEFAULT 'MONTHLY' CHECK (compounding_frequency IN ('DAILY', 'MONTHLY', 'ANNUALLY')),
