import express from 'express';
import DB from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

router.use(authMiddleware);

// GET /api/customers?search=
router.get('/', async (req, res) => {
  try {
    const search = req.query.search || '';
    const customers = await DB.getCustomersByUser(req.user.id, search);
    // attach balance for each customer
    const withBalance = await Promise.all(customers.map(async (c) => {
      const txs = await DB.getTransactionsByCustomer(c.id, req.user.id);
      let balance = 0;
      let lastDate = null;
      let oldestCreditDate = null;
      for (const t of txs) {
        if (t.type === 'credit') {
          balance += Number(t.amount);
          if (!oldestCreditDate) oldestCreditDate = t.transaction_date;
        } else balance -= Number(t.amount);
        lastDate = t.transaction_date;
      }
      // overdue if balance>0 and oldest credit >30 days
      let isOverdue = false;
      if (balance > 0 && oldestCreditDate) {
        const diff = (Date.now() - new Date(oldestCreditDate).getTime()) / (1000*60*60*24);
        if (diff > 30) isOverdue = true;
      }
      return { ...c, balance, lastDate, isOverdue, transactionCount: txs.length };
    }));
    res.json(withBalance);
  } catch (err) {
    res.status(500).json({ error: 'গ্রাহক লোড করতে সমস্যা' });
  }
});

// POST /api/customers
router.post('/', async (req, res) => {
  try {
    const { name, phone, address, email } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'নাম ও মোবাইল আবশ্যক' });
    // phone validation: Bangladeshi format loose
    if (!/^[0-9+\- ]{8,16}$/.test(phone)) return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর দিন' });
    const customer = await DB.createCustomer({ user_id: req.user.id, name, phone, address, email });
    res.status(201).json(customer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/customers/:id
router.get('/:id', async (req, res) => {
  const customer = await DB.getCustomerById(req.params.id, req.user.id);
  if (!customer) return res.status(404).json({ error: 'গ্রাহক পাওয়া যায়নি' });
  const txs = await DB.getTransactionsByCustomer(customer.id, req.user.id);
  // compute balance and history with running balance
  let balance = 0;
  const history = txs.map(t => {
    if (t.type === 'credit') balance += Number(t.amount);
    else balance -= Number(t.amount);
    return { ...t, balance };
  });
  const totalCredit = txs.filter(t=>t.type==='credit').reduce((s,t)=>s+Number(t.amount),0);
  const totalPayment = txs.filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0);
  res.json({ ...customer, balance, totalCredit, totalPayment, history });
});

// PUT /api/customers/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, phone, address, email } = req.body;
    if (!name || !phone) return res.status(400).json({ error: 'নাম ও মোবাইল আবশ্যক' });
    const updated = await DB.updateCustomer(req.params.id, req.user.id, { name, phone, address, email });
    if (!updated) return res.status(404).json({ error: 'গ্রাহক পাওয়া যায়নি' });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', async (req, res) => {
  const ok = await DB.deleteCustomer(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'গ্রাহক পাওয়া যায়নি' });
  res.json({ message: 'গ্রাহক মুছে ফেলা হয়েছে' });
});

export default router;
