// Transaction model - schema documentation
// Table: transactions
export const TransactionSchema = `
CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT CHECK(type IN ('credit','payment')) NOT NULL,
  amount REAL NOT NULL,
  description TEXT,
  note TEXT,
  transaction_date TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
`;
