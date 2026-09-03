import express from 'express';
import DB from '../database.js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  try {
    const customers = await DB.getCustomersByUser(req.user.id);
    const transactions = await DB.getAllTransactionsByUser(req.user.id);

    let totalDue = 0;
    const customerBalances = [];
    const todayStr = new Date().toISOString().slice(0,10);
    let todayCredit = 0;
    let todayPayment = 0;

    for (const c of customers) {
      const txs = transactions.filter(t=>t.customer_id===c.id);
      let bal = 0;
      let oldest = null;
      for (const t of txs) {
        if (t.type==='credit') bal+=Number(t.amount); else bal-=Number(t.amount);
        if (t.type==='credit' && !oldest) oldest = t.transaction_date;
        if (t.transaction_date===todayStr) {
          if (t.type==='credit') todayCredit+=Number(t.amount); else todayPayment+=Number(t.amount);
        }
      }
      totalDue += bal;
      let isOverdue = false;
      if (bal>0 && oldest) {
        const diff = (Date.now()-new Date(oldest).getTime())/(1000*60*60*24);
        if (diff>30) isOverdue = true;
      }
      customerBalances.push({ ...c, balance: bal, isOverdue, lastTx: txs[txs.length-1]?.transaction_date || c.created_at });
    }

    const topDebtors = [...customerBalances].filter(c=>c.balance>0).sort((a,b)=>b.balance-a.balance).slice(0,5);
    const overdueList = customerBalances.filter(c=>c.isOverdue).sort((a,b)=>b.balance-a.balance);

    // weekly/monthly aggregates for chart
    const last7Days = [];
    for (let i=6;i>=0;i--) {
      const d = new Date(); d.setDate(d.getDate()-i);
      const iso = d.toISOString().slice(0,10);
      const dayTxs = transactions.filter(t=>t.transaction_date===iso);
      const credit = dayTxs.filter(t=>t.type==='credit').reduce((s,t)=>s+Number(t.amount),0);
      const payment = dayTxs.filter(t=>t.type==='payment').reduce((s,t)=>s+Number(t.amount),0);
      last7Days.push({ date: iso, credit, payment });
    }

    res.json({
      totalCustomers: customers.length,
      totalDue,
      todayCredit,
      todayPayment,
      topDebtors,
      overdueList,
      last7Days,
      recentTransactions: transactions.slice(0,10)
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'ড্যাশবোর্ড লোড করতে সমস্যা' });
  }
});

export default router;
