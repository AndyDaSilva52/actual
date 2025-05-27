CREATE TABLE transaction_debt_links (
    id TEXT PRIMARY KEY,
    transaction_id TEXT NOT NULL,
    debt_id TEXT NOT NULL,
    amount_applied REAL, -- Portion of transaction applied to debt, can be NULL if full transaction amount applies or not specified
    tombstone INTEGER DEFAULT 0,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
    FOREIGN KEY (debt_id) REFERENCES debts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transaction_debt_links_transaction_id ON transaction_debt_links (transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_debt_links_debt_id ON transaction_debt_links (debt_id);
CREATE INDEX IF NOT EXISTS idx_transaction_debt_links_tombstone ON transaction_debt_links (tombstone);
