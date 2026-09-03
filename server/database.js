import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try better-sqlite3 first, fallback to sqlite3, fallback to in-memory
let db;
let dbType = 'memory';

try {
  const BetterSqlite3 = (await import('better-sqlite3')).default;
  const dbPath = path.join(__dirname, 'ledger.db');
  db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  dbType = 'better-sqlite3';
  console.log('✅ Using better-sqlite3 at', dbPath);
} catch (e) {
  console.warn('⚠️ better-sqlite3 failed, trying sqlite3:', e.message);
  try {
    const sqlite3 = (await import('sqlite3')).default;
    const sqlite = sqlite3.verbose();
    const dbPath = path.join(__dirname, 'ledger.db');
    db = new sqlite.Database(dbPath);
    dbType = 'sqlite3';
    console.log('✅ Using sqlite3 at', dbPath);
  } catch (e2) {
    console.warn('⚠️ sqlite3 also failed, using in-memory mock DB:', e2.message);
    dbType = 'memory';
    db = null;
  }
}

// For better-sqlite3, init synchronously. For sqlite3, use serialize. For memory, use JS maps with file persistence.
const memoryFile = path.join(__dirname, 'ledger-memory.json');
let memoryStore = {
  users: [],
  customers: [],
  transactions: [],
  nextUserId: 1,
  nextCustomerId: 1,
  nextTransactionId: 1,
};
try {
  if (fs.existsSync(memoryFile)) {
    const raw = fs.readFileSync(memoryFile, 'utf8');
    const parsed = JSON.parse(raw);
    memoryStore = { ...memoryStore, ...parsed };
    console.log('📁 Loaded memory DB from', memoryFile);
  }
} catch (e) {
  console.warn('Could not load memory file:', e.message);
}
function saveMemory() {
  try {
    fs.writeFileSync(memoryFile, JSON.stringify(memoryStore, null, 2));
  } catch (e) {
    console.warn('Could not save memory file:', e.message);
  }
}

function initBetterSqlite3() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    );
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
    CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
  `);
}

function initSqlite3() {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT UNIQUE NOT NULL, password TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS customers (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, name TEXT NOT NULL, phone TEXT NOT NULL, address TEXT, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
    db.run(`CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, customer_id INTEGER NOT NULL, user_id INTEGER NOT NULL, type TEXT CHECK(type IN ('credit','payment')) NOT NULL, amount REAL NOT NULL, description TEXT, note TEXT, transaction_date TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE, FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  });
}

if (dbType === 'better-sqlite3') initBetterSqlite3();
if (dbType === 'sqlite3') initSqlite3();

// Unified helper API
export const getDBType = () => dbType;
export const getRawDB = () => db;

// Helper to run queries abstractly
export function run(query, params = []) {
  if (dbType === 'better-sqlite3') {
    const stmt = db.prepare(query);
    return stmt.run(...params);
  }
  if (dbType === 'sqlite3') {
    return new Promise((resolve, reject) => {
      db.run(query, params, function (err) {
        if (err) reject(err);
        else resolve({ lastInsertRowid: this.lastID, changes: this.changes });
      });
    });
  }
  // memory: parse query crudely
  throw new Error('Memory DB does not support raw run');
}

export function get(query, params = []) {
  if (dbType === 'better-sqlite3') {
    return db.prepare(query).get(...params);
  }
  if (dbType === 'sqlite3') {
    return new Promise((resolve, reject) => {
      db.get(query, params, (err, row) => err ? reject(err) : resolve(row));
    });
  }
  throw new Error('Memory DB does not support raw get');
}

export function all(query, params = []) {
  if (dbType === 'better-sqlite3') {
    return db.prepare(query).all(...params);
  }
  if (dbType === 'sqlite3') {
    return new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => err ? reject(err) : resolve(rows));
    });
  }
  throw new Error('Memory DB does not support raw all');
}

// High-level helpers used by routes - they abstract dbType
export const DB = {
  // Users
  createUser: async ({ name, email, password }) => {
    if (dbType === 'better-sqlite3') {
      const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?,?,?)');
      const r = stmt.run(name, email, password);
      return { id: r.lastInsertRowid, name, email };
    }
    if (dbType === 'sqlite3') {
      const r = await new Promise((resolve, reject) => {
        db.run('INSERT INTO users (name, email, password) VALUES (?,?,?)', [name, email, password], function (err) {
          if (err) reject(err); else resolve({ lastID: this.lastID });
        });
      });
      return { id: r.lastID, name, email };
    }
    // memory
    if (memoryStore.users.find(u => u.email === email)) throw new Error('Email already exists');
    const user = { id: memoryStore.nextUserId++, name, email, password, created_at: new Date().toISOString() };
    memoryStore.users.push(user);
    saveMemory();
    return { id: user.id, name, email };
  },
  findUserByEmail: async (email) => {
    if (dbType === 'better-sqlite3') return db.prepare('SELECT * FROM users WHERE email=?').get(email) || null;
    if (dbType === 'sqlite3') return await new Promise((res, rej) => db.get('SELECT * FROM users WHERE email=?', [email], (e, r) => e ? rej(e) : res(r || null)));
    return memoryStore.users.find(u => u.email === email) || null;
  },
  findUserById: async (id) => {
    if (dbType === 'better-sqlite3') return db.prepare('SELECT * FROM users WHERE id=?').get(id) || null;
    if (dbType === 'sqlite3') return await new Promise((res, rej) => db.get('SELECT * FROM users WHERE id=?', [id], (e, r) => e ? rej(e) : res(r || null)));
    return memoryStore.users.find(u => u.id === Number(id)) || null;
  },
  updateUser: async (id, { name, email }) => {
    if (dbType === 'better-sqlite3') {
      const existing = db.prepare('SELECT * FROM users WHERE id=?').get(id);
      if (!existing) return null;
      db.prepare('UPDATE users SET name=?, email=? WHERE id=?').run(name, email, id);
      return db.prepare('SELECT * FROM users WHERE id=?').get(id);
    }
    if (dbType === 'sqlite3') {
      await new Promise((res, rej) => db.run('UPDATE users SET name=?, email=? WHERE id=?', [name, email, id], e => e ? rej(e) : res()));
      return await new Promise((res, rej) => db.get('SELECT * FROM users WHERE id=?', [id], (e, r) => e ? rej(e) : res(r)));
    }
    const u = memoryStore.users.find(x => x.id === Number(id));
    if (!u) return null;
    if (email !== u.email && memoryStore.users.find(x => x.email === email)) throw new Error('Email already exists');
    u.name = name; u.email = email;
    saveMemory();
    return u;
  },

  // Customers
  createCustomer: async ({ user_id, name, phone, address, email }) => {
    if (dbType === 'better-sqlite3') {
      const r = db.prepare('INSERT INTO customers (user_id,name,phone,address,email) VALUES (?,?,?,?,?)').run(user_id, name, phone, address || '', email || '');
      return db.prepare('SELECT * FROM customers WHERE id=?').get(r.lastInsertRowid);
    }
    if (dbType === 'sqlite3') {
      const r = await new Promise((res, rej) => db.run('INSERT INTO customers (user_id,name,phone,address,email) VALUES (?,?,?,?,?)', [user_id, name, phone, address || '', email || ''], function (e) { e ? rej(e) : res({ lastID: this.lastID }); }));
      return await new Promise((res, rej) => db.get('SELECT * FROM customers WHERE id=?', [r.lastID], (e, row) => e ? rej(e) : res(row)));
    }
    const c = { id: memoryStore.nextCustomerId++, user_id: Number(user_id), name, phone, address: address || '', email: email || '', created_at: new Date().toISOString() };
    memoryStore.customers.push(c);
    saveMemory();
    return c;
  },
  getCustomersByUser: async (user_id, search = '') => {
    if (dbType === 'better-sqlite3') {
      if (search) return db.prepare('SELECT * FROM customers WHERE user_id=? AND (name LIKE ? OR phone LIKE ?) ORDER BY created_at DESC').all(user_id, `%${search}%`, `%${search}%`);
      return db.prepare('SELECT * FROM customers WHERE user_id=? ORDER BY created_at DESC').all(user_id);
    }
    if (dbType === 'sqlite3') {
      const q = search ? 'SELECT * FROM customers WHERE user_id=? AND (name LIKE ? OR phone LIKE ?) ORDER BY created_at DESC' : 'SELECT * FROM customers WHERE user_id=? ORDER BY created_at DESC';
      const p = search ? [user_id, `%${search}%`, `%${search}%`] : [user_id];
      return await new Promise((res, rej) => db.all(q, p, (e, rows) => e ? rej(e) : res(rows)));
    }
    let list = memoryStore.customers.filter(c => c.user_id === Number(user_id));
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
    }
    return list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  },
  getCustomerById: async (id, user_id) => {
    if (dbType === 'better-sqlite3') return db.prepare('SELECT * FROM customers WHERE id=? AND user_id=?').get(id, user_id) || null;
    if (dbType === 'sqlite3') return await new Promise((res, rej) => db.get('SELECT * FROM customers WHERE id=? AND user_id=?', [id, user_id], (e, r) => e ? rej(e) : res(r || null)));
    return memoryStore.customers.find(c => c.id === Number(id) && c.user_id === Number(user_id)) || null;
  },
  updateCustomer: async (id, user_id, data) => {
    if (dbType === 'better-sqlite3') {
      const cur = db.prepare('SELECT * FROM customers WHERE id=? AND user_id=?').get(id, user_id);
      if (!cur) return null;
      db.prepare('UPDATE customers SET name=?, phone=?, address=?, email=? WHERE id=?').run(data.name, data.phone, data.address || '', data.email || '', id);
      return db.prepare('SELECT * FROM customers WHERE id=?').get(id);
    }
    if (dbType === 'sqlite3') {
      const cur = await new Promise((res, rej) => db.get('SELECT * FROM customers WHERE id=? AND user_id=?', [id, user_id], (e, r) => e ? rej(e) : res(r)));
      if (!cur) return null;
      await new Promise((res, rej) => db.run('UPDATE customers SET name=?, phone=?, address=?, email=? WHERE id=?', [data.name, data.phone, data.address || '', data.email || '', id], e => e ? rej(e) : res()));
      return await new Promise((res, rej) => db.get('SELECT * FROM customers WHERE id=?', [id], (e, r) => e ? rej(e) : res(r)));
    }
    const c = memoryStore.customers.find(x => x.id === Number(id) && x.user_id === Number(user_id));
    if (!c) return null;
    Object.assign(c, { name: data.name, phone: data.phone, address: data.address || '', email: data.email || '' });
    saveMemory();
    return c;
  },
  deleteCustomer: async (id, user_id) => {
    if (dbType === 'better-sqlite3') {
      const r = db.prepare('DELETE FROM customers WHERE id=? AND user_id=?').run(id, user_id);
      if (r.changes) db.prepare('DELETE FROM transactions WHERE customer_id=?').run(id);
      return r.changes > 0;
    }
    if (dbType === 'sqlite3') {
      const r = await new Promise((res, rej) => db.run('DELETE FROM customers WHERE id=? AND user_id=?', [id, user_id], function (e) { e ? rej(e) : res({ changes: this.changes }); }));
      if (r.changes) await new Promise((res, rej) => db.run('DELETE FROM transactions WHERE customer_id=?', [id], e => e ? rej(e) : res()));
      return r.changes > 0;
    }
    const idx = memoryStore.customers.findIndex(c => c.id === Number(id) && c.user_id === Number(user_id));
    if (idx === -1) return false;
    memoryStore.customers.splice(idx, 1);
    memoryStore.transactions = memoryStore.transactions.filter(t => t.customer_id !== Number(id));
    saveMemory();
    return true;
  },

  // Transactions
  createTransaction: async ({ customer_id, user_id, type, amount, description, note, transaction_date }) => {
    if (dbType === 'better-sqlite3') {
      const r = db.prepare('INSERT INTO transactions (customer_id,user_id,type,amount,description,note,transaction_date) VALUES (?,?,?,?,?,?,?)').run(customer_id, user_id, type, amount, description || '', note || '', transaction_date);
      return db.prepare('SELECT * FROM transactions WHERE id=?').get(r.lastInsertRowid);
    }
    if (dbType === 'sqlite3') {
      const r = await new Promise((res, rej) => db.run('INSERT INTO transactions (customer_id,user_id,type,amount,description,note,transaction_date) VALUES (?,?,?,?,?,?,?)', [customer_id, user_id, type, amount, description || '', note || '', transaction_date], function (e) { e ? rej(e) : res({ lastID: this.lastID }); }));
      return await new Promise((res, rej) => db.get('SELECT * FROM transactions WHERE id=?', [r.lastID], (e, row) => e ? rej(e) : res(row)));
    }
    const t = { id: memoryStore.nextTransactionId++, customer_id: Number(customer_id), user_id: Number(user_id), type, amount: Number(amount), description: description || '', note: note || '', transaction_date, created_at: new Date().toISOString() };
    memoryStore.transactions.push(t);
    saveMemory();
    return t;
  },
  getTransactionsByCustomer: async (customer_id, user_id) => {
    if (dbType === 'better-sqlite3') return db.prepare('SELECT * FROM transactions WHERE customer_id=? AND user_id=? ORDER BY transaction_date ASC, created_at ASC').all(customer_id, user_id);
    if (dbType === 'sqlite3') return await new Promise((res, rej) => db.all('SELECT * FROM transactions WHERE customer_id=? AND user_id=? ORDER BY transaction_date ASC, created_at ASC', [customer_id, user_id], (e, rows) => e ? rej(e) : res(rows)));
    return memoryStore.transactions.filter(t => t.customer_id === Number(customer_id) && t.user_id === Number(user_id)).sort((a, b) => new Date(a.transaction_date) - new Date(b.transaction_date));
  },
  getAllTransactionsByUser: async (user_id) => {
    if (dbType === 'better-sqlite3') return db.prepare('SELECT * FROM transactions WHERE user_id=? ORDER BY transaction_date DESC').all(user_id);
    if (dbType === 'sqlite3') return await new Promise((res, rej) => db.all('SELECT * FROM transactions WHERE user_id=? ORDER BY transaction_date DESC', [user_id], (e, rows) => e ? rej(e) : res(rows)));
    return memoryStore.transactions.filter(t => t.user_id === Number(user_id)).sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
  },
  deleteTransaction: async (id, user_id) => {
    if (dbType === 'better-sqlite3') {
      const r = db.prepare('DELETE FROM transactions WHERE id=? AND user_id=?').run(id, user_id);
      return r.changes > 0;
    }
    if (dbType === 'sqlite3') {
      const r = await new Promise((res, rej) => db.run('DELETE FROM transactions WHERE id=? AND user_id=?', [id, user_id], function (e) { e ? rej(e) : res({ changes: this.changes }); }));
      return r.changes > 0;
    }
    const idx = memoryStore.transactions.findIndex(t => t.id === Number(id) && t.user_id === Number(user_id));
    if (idx === -1) return false;
    memoryStore.transactions.splice(idx, 1);
    saveMemory();
    return true;
  },
  // For backup/restore
  getAllDataForUser: async (user_id) => {
    const customers = await DB.getCustomersByUser(user_id);
    const transactions = await DB.getAllTransactionsByUser(user_id);
    return { customers, transactions };
  }
};

export default DB;
