/* ═══════════════════════════════════════════════
   store.js — data layer (localStorage, shared by 2 members)
   ═══════════════════════════════════════════════ */

const DB_KEY = "alphaFinanceData_v1";
const SESSION_KEY = "alphaFinanceSession_v1";

/* ─── Categories & methods ─── */
const CATEGORIES = {
  expense: [
    { id: "food", icon: "🍔" }, { id: "groceries", icon: "🛒" }, { id: "transport", icon: "🚗" },
    { id: "rent", icon: "🏠" }, { id: "utilities", icon: "💡" }, { id: "bills", icon: "📱" },
    { id: "health", icon: "💊" }, { id: "education", icon: "📚" }, { id: "clothing", icon: "👕" },
    { id: "shopping", icon: "🛍️" }, { id: "entertainment", icon: "🎬" }, { id: "travel", icon: "✈️" },
    { id: "gifts", icon: "🎁" }, { id: "family", icon: "👨‍👩‍👧" }, { id: "beauty", icon: "💄" },
    { id: "other", icon: "🧾" }
  ],
  income: [
    { id: "salary", icon: "💼" }, { id: "business", icon: "🏪" }, { id: "freelance", icon: "💻" },
    { id: "investment", icon: "📈" }, { id: "rental", icon: "🏘️" }, { id: "bonus", icon: "🎉" },
    { id: "igift", icon: "🎁" }, { id: "iother", icon: "💰" }
  ]
};
const METHODS = [
  { id: "cash", icon: "💵" }, { id: "bkash", icon: "📲" }, { id: "nagad", icon: "📲" },
  { id: "rocket", icon: "🚀" }, { id: "card", icon: "💳" }, { id: "bank", icon: "🏦" }
];
const CURRENCIES = [
  { code: "BDT", symbol: "৳", name: "Bangladeshi Taka" },
  { code: "USD", symbol: "$", name: "US Dollar" },
  { code: "EUR", symbol: "€", name: "Euro" },
  { code: "GBP", symbol: "£", name: "British Pound" },
  { code: "INR", symbol: "₹", name: "Indian Rupee" },
  { code: "SAR", symbol: "﷼", name: "Saudi Riyal" }
];
const PALETTE = ["#6366f1","#8b5cf6","#ec4899","#f43f5e","#f97316","#eab308","#22c55e","#14b8a6","#06b6d4","#3b82f6","#a855f7","#f472b6","#fb7185","#fbbf24","#4ade80","#2dd4bf"];

function catById(id) {
  return CATEGORIES.expense.find(c => c.id === id) || CATEGORIES.income.find(c => c.id === id) || { id: "other", icon: "❔" };
}
function catColor(id) {
  let h = 0; const s = String(id);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
function methodById(id) {
  return METHODS.find(m => m.id === id) || { id: "cash", icon: "💵" };
}

/* ─── Utilities ─── */
function uid(prefix) { return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function esc(str) {
  return String(str == null ? "" : str)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function pad2(n) { return String(n).padStart(2, "0"); }
function isoOf(d) { return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
function todayISO() { return isoOf(new Date()); }
function curYM() { return todayISO().slice(0, 7); }
function monthOf(iso) { return String(iso || "").slice(0, 7); }
function daysBetween(aISO, bISO) { return Math.round((new Date(bISO + "T00:00:00") - new Date(aISO + "T00:00:00")) / 86400000); }

/** money format: ৳ 12,50,000 (bn mode → Bengali digits) */
function fmtMoney(n, opts) {
  const d = getData();
  const sym = (opts && opts.noSymbol) ? "" : (d.settings.currency.symbol || "৳");
  const v = Number(n) || 0;
  const hasFrac = Math.abs(v % 1) > 0.004;
  const nf = new Intl.NumberFormat("en-IN", { maximumFractionDigits: hasFrac ? 2 : 0, minimumFractionDigits: 0 });
  const num = nf.format(Math.abs(v));
  const sign = v < 0 ? "-" : (opts && opts.forceSign && v > 0 ? "+" : "");
  return sign + sym + " " + locDigits(num);
}
/** compact for charts: 12.5k / 3.2L */
function fmtCompact(n) {
  const v = Math.abs(Number(n) || 0);
  const sign = Number(n) < 0 ? "-" : "";
  if (v >= 1e7) return sign + locDigits((v / 1e7).toFixed(1)) + "Cr";
  if (v >= 1e5) return sign + locDigits((v / 1e5).toFixed(1)) + (getLang() === "bn" ? "লা" : "L");
  if (v >= 1e3) return sign + locDigits((v / 1e3).toFixed(1)) + (getLang() === "bn" ? "হা" : "k");
  return sign + locDigits(Math.round(v));
}
/** date label: 12 Sep 2025 (bn: ১২ সেপ ২০২৫) */
function fmtDate(iso, style) {
  if (!iso) return "—";
  const y = +iso.slice(0, 4), m = +iso.slice(5, 7) - 1, d = +iso.slice(8, 10);
  const lang = getLang();
  if (style === "long") return locDigits(d) + " " + MONTHS[lang][m] + " " + locDigits(y);
  return locDigits(d) + " " + MONTHS_SHORT[lang][m] + " " + locDigits(y);
}
function fmtWeekday(iso) {
  const d = new Date(iso + "T00:00:00");
  return WEEKDAYS[getLang()][d.getDay()];
}
function monthLabel(ym, style) {
  const y = +ym.slice(0, 4), m = +ym.slice(5, 7) - 1;
  const lang = getLang();
  return (style === "short" ? MONTHS_SHORT[lang][m] : MONTHS[lang][m]) + " " + locDigits(y);
}

/* ─── Default / seed data ─── */
function defaultUsers() {
  return [
    { id: "u1", name: "Member 1", email: "member1@gmail.com", mobile: "+8801710000001", pin: "1234", color: "#6366f1" },
    { id: "u2", name: "Member 2", email: "member2@gmail.com", mobile: "+8801720000002", pin: "1234", color: "#ec4899" }
  ];
}
function defaultSettings() {
  return { familyName: "Alpha Family", currency: CURRENCIES[0], theme: "dark", language: "en", demo: false };
}
function freshData(withDemo) {
  const data = {
    version: 1,
    settings: defaultSettings(),
    users: defaultUsers(),
    transactions: [],
    budgets: [],
    goals: []
  };
  if (withDemo) applyDemoData(data);
  return data;
}

/* deterministic RNG so demo data looks natural but stable */
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedTransactions() {
  const rnd = mulberry32(90210);
  const pick = a => a[Math.floor(rnd() * a.length)];
  const ri = (min, max) => Math.floor(rnd() * (max - min + 1)) + min;
  const txs = [];
  const now = new Date();
  for (let back = 5; back >= 0; back--) {
    const base = new Date(now.getFullYear(), now.getMonth() - back, 1);
    const y = base.getFullYear(), m = base.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    const mk = (day, type, cat, amt, by, method, note) => {
      const dd = Math.min(day, lastDay);
      const dstr = y + "-" + pad2(m + 1) + "-" + pad2(dd);
      if (dstr > todayISO()) return;
      txs.push({ id: uid("t"), type, category: cat, amount: amt, date: dstr, method, note: note || "", by, createdAt: new Date(y, m, dd, 10).getTime() });
    };
    mk(5, "income", "salary", 45000, "u1", "bank", "Monthly salary");
    mk(3, "income", "business", 38000, "u2", "bkash", "Shop earnings");
    if (back === 2 || back === 5) mk(ri(10, 20), "income", "freelance", ri(8000, 15000), "u1", "bank", "Freelance project");
    if (back === 0) mk(8, "income", "bonus", 10000, "u2", "bank", "Bonus");
    mk(2, "expense", "rent", 13000, "u1", "cash", "House rent");
    [5, 12, 19, 26].forEach(day => mk(day, "expense", "groceries", ri(1800, 3200), "u2", "bkash", "Weekly bazar"));
    mk(15, "expense", "utilities", ri(3200, 4200), "u1", "bank", "Gas, electricity & water");
    mk(10, "expense", "bills", ri(900, 1400), "u2", "bkash", "Mobile & internet");
    const tN = ri(8, 10);
    for (let i = 0; i < tN; i++) mk(ri(1, 28), "expense", "transport", ri(60, 400), pick(["u1", "u2"]), "cash", "");
    const fN = ri(5, 7);
    for (let i = 0; i < fN; i++) mk(ri(1, 28), "expense", "food", ri(150, 900), pick(["u1", "u2"]), "cash", pick(["Lunch out", "Dinner", "Snacks", "Restaurant", ""]));
    if (back % 2 === 0) mk(ri(8, 22), "expense", "shopping", ri(2000, 6000), "u2", "card", "Shopping");
    mk(ri(6, 24), "expense", "entertainment", ri(300, 1500), pick(["u1", "u2"]), "cash", "");
    if (back === 1 || back === 4) mk(ri(5, 25), "expense", "health", ri(500, 2000), pick(["u1", "u2"]), "cash", "Medicine");
    if (back === 3) mk(ri(5, 25), "expense", "gifts", ri(1000, 3000), "u1", "cash", "Donation");
    if (back === 0 || back === 2) mk(ri(3, 20), "expense", "clothing", ri(1200, 4000), "u2", "card", "");
  }
  return txs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
function demoBudgets() {
  return [
    { id: uid("b"), category: "groceries", limit: 14000 },
    { id: uid("b"), category: "food", limit: 8000 },
    { id: uid("b"), category: "transport", limit: 5000 },
    { id: uid("b"), category: "utilities", limit: 5000 },
    { id: uid("b"), category: "bills", limit: 2000 },
    { id: uid("b"), category: "shopping", limit: 9000 }
  ];
}
function demoGoals() {
  const now = new Date();
  const plus = mo => isoOf(new Date(now.getFullYear(), now.getMonth() + mo, 15));
  return [
    { id: uid("g"), name: "Emergency Fund", icon: "🛟", target: 100000, saved: 42000, deadline: plus(8), note: "For rainy days" },
    { id: uid("g"), name: "Eid Shopping", icon: "🎉", target: 60000, saved: 18000, deadline: plus(4), note: "" },
    { id: uid("g"), name: "New Laptop", icon: "💻", target: 95000, saved: 12500, deadline: plus(10), note: "For work" }
  ];
}
function applyDemoData(data) {
  data.transactions = seedTransactions();
  data.budgets = demoBudgets();
  data.goals = demoGoals();
  data.settings.demo = true;
}

/* ─── Load / save ─── */
let _data = null;
function loadData() {
  if (_data) return _data;
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.users && parsed.settings) {
        _data = parsed;
        migrateData(_data);
        return _data;
      }
    }
  } catch (e) { /* corrupted → fresh */ }
  _data = freshData(true);
  saveData();
  return _data;
}
function migrateData(d) {
  if (!d.settings.currency || !d.settings.currency.symbol) d.settings.currency = CURRENCIES[0];
  if (!Array.isArray(d.transactions)) d.transactions = [];
  if (!Array.isArray(d.budgets)) d.budgets = [];
  if (!Array.isArray(d.goals)) d.goals = [];
  if (!Array.isArray(d.users) || d.users.length < 2) d.users = defaultUsers();
}
function saveData() {
  if (!_data) return;
  try { localStorage.setItem(DB_KEY, JSON.stringify(_data)); } catch (e) { /* storage full */ }
}
function getData() { return loadData(); }

/* ─── Session ─── */
function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.userId && getData().users.some(u => u.id === s.userId)) return s.userId;
  } catch (e) {}
  return null;
}
function setSession(userId) { localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, at: Date.now() })); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

/* ─── Auth helpers ─── */
function findUserByIdentifier(identifier) {
  const s = String(identifier || "").trim().toLowerCase();
  if (!s) return null;
  const digits = s.replace(/\D/g, "");
  return getData().users.find(u => {
    if (u.email && u.email.toLowerCase() === s) return true;
    if (digits.length >= 10) {
      const mDigits = String(u.mobile || "").replace(/\D/g, "");
      if (mDigits && mDigits.endsWith(digits.slice(-10))) return true;
    }
    return false;
  }) || null;
}

/* ─── Transaction queries ─── */
function filterTxs(f) {
  const d = getData();
  let list = d.transactions.slice();
  if (f.type) list = list.filter(x => x.type === f.type);
  if (f.category) list = list.filter(x => x.category === f.category);
  if (f.userId) list = list.filter(x => x.by === f.userId);
  if (f.method) list = list.filter(x => x.method === f.method);
  if (f.from) list = list.filter(x => x.date >= f.from);
  if (f.to) list = list.filter(x => x.date <= f.to);
  if (f.ym) list = list.filter(x => monthOf(x.date) === f.ym);
  if (f.search) {
    const q = f.search.toLowerCase();
    list = list.filter(x =>
      (x.note || "").toLowerCase().includes(q) ||
      t("cat." + x.category).toLowerCase().includes(q) ||
      (d.users.find(u => u.id === x.by) || { name: "" }).name.toLowerCase().includes(q)
    );
  }
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : (b.createdAt || 0) - (a.createdAt || 0)));
}
function sumBy(list, type) {
  return list.filter(x => x.type === type).reduce((s, x) => s + (Number(x.amount) || 0), 0);
}
function totals(list) { return { income: sumBy(list, "income"), expense: sumBy(list, "expense") }; }
function monthTotals(ym, userId) { return totals(filterTxs({ ym: ym, userId: userId || undefined })); }
/** category → total for a list */
function byCategory(list, type) {
  const map = {};
  list.filter(x => x.type === type).forEach(x => { map[x.category] = (map[x.category] || 0) + (Number(x.amount) || 0); });
  return Object.keys(map)
    .map(k => ({ category: k, total: map[k] }))
    .sort((a, b) => b.total - a.total);
}
/** last N months ending at ym (inclusive) → [{ym, label, income, expense, savings}] */
function lastMonths(n, endYM, userId) {
  const out = [];
  const y = +endYM.slice(0, 4), m = +endYM.slice(5, 7) - 1;
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(y, m - i, 1);
    const ym = d.getFullYear() + "-" + pad2(d.getMonth() + 1);
    const tt = monthTotals(ym, userId);
    out.push({ ym, label: monthLabel(ym, "short"), income: tt.income, expense: tt.expense, savings: tt.income - tt.expense });
  }
  return out;
}

/* ─── CRUD ─── */
function addTx(tx) {
  const d = getData();
  d.transactions.push(Object.assign({ id: uid("t"), createdAt: Date.now() }, tx));
  saveData();
}
function updateTx(id, patch) {
  const x = getData().transactions.find(v => v.id === id);
  if (x) Object.assign(x, patch);
  saveData();
}
function deleteTx(id) {
  const d = getData();
  d.transactions = d.transactions.filter(v => v.id !== id);
  saveData();
}
function addBudget(catId, limit) {
  const d = getData();
  d.budgets.push({ id: uid("b"), category: catId, limit: Number(limit) || 0 });
  saveData();
}
function updateBudget(id, patch) {
  const b = getData().budgets.find(v => v.id === id);
  if (b) Object.assign(b, patch);
  saveData();
}
function deleteBudget(id) {
  const d = getData();
  d.budgets = d.budgets.filter(v => v.id !== id);
  saveData();
}
function addGoal(goal) {
  getData().goals.push(Object.assign({ id: uid("g"), saved: 0, note: "" }, goal));
  saveData();
}
function updateGoal(id, patch) {
  const g = getData().goals.find(v => v.id === id);
  if (g) Object.assign(g, patch);
  saveData();
}
function deleteGoal(id) {
  const d = getData();
  d.goals = d.goals.filter(v => v.id !== id);
  saveData();
}
function updateUser(id, patch) {
  const u = getData().users.find(v => v.id === id);
  if (u) Object.assign(u, patch);
  saveData();
}

/* ─── Budget progress (current month) ─── */
function budgetProgress() {
  const d = getData();
  const ym = curYM();
  return d.budgets.map(b => {
    const spent = sumBy(filterTxs({ ym, category: b.category, type: "expense" }), "expense");
    const pct = b.limit > 0 ? Math.min(999, Math.round((spent / b.limit) * 100)) : 0;
    return Object.assign({}, b, { spent, pct, state: pct >= 100 ? "over" : pct >= 80 ? "warn" : "ok" });
  }).sort((a, b) => b.pct - a.pct);
}

/* ─── Export / import ─── */
function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime || "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 800);
}
function exportJSON() {
  downloadFile("alpha-finance-backup-" + todayISO() + ".json", JSON.stringify(getData(), null, 2), "application/json");
}
function exportCSV(ym, userId) {
  const d = getData();
  const f = {};
  if (ym) f.ym = ym;
  if (userId) f.userId = userId;
  const list = filterTxs(f);
  const head = ["Date", "Type", "Category", "Amount", "Method", "Member", "Note"];
  const rows = list.map(x => [
    x.date, x.type, t("cat." + x.category), Number(x.amount), t("method." + x.method),
    (d.users.find(u => u.id === x.by) || {}).name || "", (x.note || "").replace(/"/g, '""')
  ]);
  const csv = [head].concat(rows)
    .map(r => r.map(c => (typeof c === "string" && /[",\n]/.test(c)) ? '"' + c + '"' : c).join(","))
    .join("\r\n");
  downloadFile("alpha-finance-" + (ym || "all") + ".csv", "\ufeff" + csv, "text/csv;charset=utf-8");
  return list.length;
}
function importJSON(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !parsed.users || !parsed.settings || !Array.isArray(parsed.transactions)) throw new Error("bad backup");
  migrateData(parsed);
  _data = parsed;
  saveData();
}
function clearAllData() {
  _data = freshData(false);
  saveData();
}
function loadDemoData() {
  _data = freshData(true);
  saveData();
}
