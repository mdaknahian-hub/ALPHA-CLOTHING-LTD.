// User model - schema documentation
// Table: users
// Columns: id INTEGER PK, name TEXT, email TEXT UNIQUE, password TEXT (hashed), created_at DATETIME
export const UserSchema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;
