import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import customerRoutes from './routes/customers.js';
import transactionRoutes from './routes/transactions.js';
import dashboardRoutes from './routes/dashboard.js';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Smart Credit Ledger API চলছে', time: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Backup & restore
import DB from './database.js';
import { authMiddleware } from './middleware/auth.js';

app.get('/api/backup', authMiddleware, async (req, res) => {
  const data = await DB.getAllDataForUser(req.user.id);
  const user = await DB.findUserById(req.user.id);
  res.json({ user: { id: user.id, name: user.name, email: user.email }, ...data, exportedAt: new Date().toISOString() });
});

app.post('/api/restore', authMiddleware, async (req, res) => {
  try {
    const { customers = [], transactions = [] } = req.body;
    let imported = 0;
    for (const c of customers) {
      try {
        const exists = await DB.getCustomerById(c.id, req.user.id);
        if (!exists) {
          await DB.createCustomer({ user_id: req.user.id, name: c.name, phone: c.phone, address: c.address, email: c.email });
          imported++;
        }
      } catch {}
    }
    for (const t of transactions) {
      try {
        await DB.createTransaction({
          customer_id: t.customer_id,
          user_id: req.user.id,
          type: t.type,
          amount: t.amount,
          description: t.description,
          note: t.note,
          transaction_date: t.transaction_date
        });
      } catch {}
    }
    res.json({ message: `ব্যাকআপ রিস্টোর সম্পন্ন, ${imported} গ্রাহক ইমপোর্ট হয়েছে` });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Serve frontend build if exists (for single-container deploy)
const clientBuildPath = path.join(__dirname, '../client/dist');
const rootBuildPath = path.join(__dirname, '../dist');
import fs from 'fs';
let staticPath = null;
if (fs.existsSync(clientBuildPath)) staticPath = clientBuildPath;
else if (fs.existsSync(rootBuildPath)) staticPath = rootBuildPath;

if (staticPath) {
  app.use(express.static(staticPath));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  console.log('📁 Serving frontend from', staticPath);
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'সার্ভার ত্রুটি' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Smart Ledger Server running at http://0.0.0.0:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
});
