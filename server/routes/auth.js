import express from 'express';
import bcrypt from 'bcryptjs';
import DB from '../database.js';
import { signToken, authMiddleware } from '../middleware/auth.js';

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) return res.status(400).json({ error: 'সব ঘর পূরণ করুন' });
    if (password.length < 6) return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে' });
    const existing = await DB.findUserByEmail(email.toLowerCase());
    if (existing) return res.status(400).json({ error: 'এই ইমেইলে ইতিমধ্যে অ্যাকাউন্ট আছে' });
    const hashed = await bcrypt.hash(password, 10);
    const user = await DB.createUser({ name, email: email.toLowerCase(), password: hashed });
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.status(201).json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'সার্ভার ত্রুটি' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'ইমেইল ও পাসওয়ার্ড দিন' });
    const user = await DB.findUserByEmail(email.toLowerCase());
    if (!user) return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড' });
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: 'ভুল ইমেইল বা পাসওয়ার্ড' });
    const token = signToken({ id: user.id, email: user.email, name: user.name });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
  } catch (err) {
    res.status(500).json({ error: 'সার্ভার ত্রুটি' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  const user = await DB.findUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'ইউজার পাওয়া যায়নি' });
  res.json({ id: user.id, name: user.name, email: user.email, created_at: user.created_at });
});

// PUT /api/auth/profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'নাম ও ইমেইল দিন' });
    const updated = await DB.updateUser(req.user.id, { name, email: email.toLowerCase() });
    if (!updated) return res.status(404).json({ error: 'ইউজার পাওয়া যায়নি' });
    const token = signToken({ id: updated.id, email: updated.email, name: updated.name });
    res.json({ token, user: { id: updated.id, name: updated.name, email: updated.email } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
