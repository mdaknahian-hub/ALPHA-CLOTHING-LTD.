import express from 'express';
import DB from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

// POST /api/transactions
router.post('/', async (req, res) => {
  try {
    const { customer_id, type, amount, description, note, transaction_date } = req.body;
    if (!customer_id || !type || !amount || !transaction_date) return res.status(400).json({ error: 'সব প্রয়োজনীয় তথ্য দিন' });
    if (!['credit','payment'].includes(type)) return res.status(400).json({ error: 'লেনদেনের ধরন ভুল' });
    if (Number(amount) <= 0) return res.status(400).json({ error: 'টাকার পরিমাণ ০ এর বেশি হতে হবে' });
    const customer = await DB.getCustomerById(customer_id, req.user.id);
    if (!customer) return res.status(404).json({ error: 'গ্রাহক পাওয়া যায়নি' });
    const tx = await DB.createTransaction({
      customer_id,
      user_id: req.user.id,
      type,
      amount: Number(amount),
      description: description || (type==='credit' ? 'বাকি দেওয়া' : 'টাকা জমা'),
      note: note || '',
      transaction_date
    });
    res.status(201).json(tx);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions?customer_id=  OR  GET all for user if no customer_id
router.get('/', async (req, res) => {
  try {
    const { customer_id } = req.query;
    if (customer_id) {
      const list = await DB.getTransactionsByCustomer(customer_id, req.user.id);
      // add running balance
      let bal = 0;
      const withBal = list.map(t=>{
        if (t.type==='credit') bal+=Number(t.amount); else bal-=Number(t.amount);
        return {...t, balance: bal};
      });
      res.json(withBal);
    } else {
      const list = await DB.getAllTransactionsByUser(req.user.id);
      res.json(list);
    }
  } catch (err) {
    res.status(500).json({ error: 'লেনদেন লোড করতে সমস্যা' });
  }
});

// DELETE /api/transactions/:id
router.delete('/:id', async (req, res) => {
  const ok = await DB.deleteTransaction(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: 'লেনদেন পাওয়া যায়নি' });
  res.json({ message: 'লেনদেন মুছে ফেলা হয়েছে' });
});

export default router;
