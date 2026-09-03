# স্মার্ট বাকি খাতা (Smart Credit Ledger)

> দোকানের জন্য ডিজিটাল বাকি খাতা — গ্রাহক, বাকি, জমা ও লেজার ব্যবস্থাপনার সহজ সমাধান।

![Smart Ledger](https://img.shields.io/badge/Version-1.0.0-skyblue) ![React](https://img.shields.io/badge/React-19-61dafb) ![Node](https://img.shields.io/badge/Node-Express-68a063) ![SQLite](https://img.shields.io/badge/SQLite-3-003b57)

---

## ✨ মূল ফিচার

### ১) ইউজার ম্যানেজমেন্ট
- দোকান মালিক রেজিস্টার ও লগইন (JWT ভিত্তিক)
- শুধু লগইন করা ইউজার ড্যাশবোর্ড দেখতে পারবে
- প্রোফাইল আপডেট (নাম, ইমেইল)

### ২) গ্রাহক ম্যানেজমেন্ট
- নতুন গ্রাহক যোগ (নাম, মোবাইল, ঠিকানা, ইমেইল ঐচ্ছিক)
- সব গ্রাহকের তালিকা (নাম + মোবাইল + বাকি)
- নাম/মোবাইল দিয়ে সার্চ
- এডিট ও ডিলিট

### ৩) বাকি ও লেনদেন (সবচেয়ে গুরুত্বপূর্ণ)
- প্রতিটি গ্রাহকের আলাদা **লেজার**
- **বাকি দেওয়া (Credit)**: তারিখ, টাকা, বিবরণ (কী পণ্য) + নোট
- **টাকা জমা (Payment)**: তারিখ, টাকা + নোট
- প্রতিটি লেনদেনের পর **অটো ব্যালেন্স আপডেট**
- ইতিহাসে তারিখ, বিবরণ, টাকা, আপডেটেড ব্যালেন্স

### ৪) ড্যাশবোর্ড
- মোট গ্রাহক, মোট বাকি, আজকের জমা, আজকের বাকি
- সবচেয়ে বেশি বাকি রাখা ৫ জনের তালিকা
- ৩০ দিনের বেশি পুরনো বাকি (Overdue) আলাদা তালিকা
- শেষ ৭ দিনের বাকি vs জমা **Bar Chart**
- বাকি বিতরণ **Pie Chart**

### ৫) রিপোর্ট ও শেয়ারিং
- যেকোনো গ্রাহকের সম্পূর্ণ লেজার **PDF ডাউনলোড** (jsPDF + autoTable)
- **WhatsApp** এ রিমাইন্ডার পাঠানো (wa.me লিংক)
- লেজারের **স্ক্রিনশট** ডাউনলোড (html2canvas)
- দৈনিক / সাপ্তাহিক / মাসিক রিপোর্ট

### ৬) অতিরিক্ত
- 🌙 **ডার্ক মোড**
- 📝 প্রতিটি লেনদেনে নোট/কমেন্ট
- 💾 **ব্যাকআপ ও রিস্টোর** (JSON)
- 📱 সম্পূর্ণ **Responsive** ও **বাংলা ইন্টারফেস**

---

## 🗄️ ডেটাবেজ স্ট্রাকচার

```sql
Users: id, name, email, password (hashed), created_at
Customers: id, user_id, name, phone, address, email, created_at
Transactions: id, customer_id, user_id, type (credit/payment), amount, description, note, transaction_date, created_at
```

---

## 📁 ফোল্ডার স্ট্রাকচার

```
project-root/
├── client/           # React ফ্রন্টএন্ড (Vite + Tailwind)
│   ├── src/
│   │   ├── components/  # CustomerCard, LedgerTable, TransactionForm
│   │   ├── pages/       # Dashboard, Customers, Ledger, Reports, Profile
│   │   ├── context/     # AuthContext (JWT)
│   │   └── App.jsx
│   └── package.json
├── server/           # Node.js ব্যাকএন্ড (Express + SQLite + JWT)
│   ├── routes/       # auth, customers, transactions, dashboard
│   ├── models/       # User, Customer, Transaction schema
│   ├── middleware/   # JWT verification
│   ├── database.js   # SQLite connection (better-sqlite3 / sqlite3)
│   └── package.json
├── Dockerfile
└── README.md
```

---

## 🚀 লোকালে চালানোর নিয়ম

### প্রি-রিকোয়ারমেন্ট
- Node.js 18+

### ১) শুধু ফ্রন্টএন্ড (ডেমো, লোকালস্টোরেজে চলবে, সার্ভার ছাড়াই)

```bash
git clone https://github.com/mdaknahian-hub/ALPHA-CLOTHING-LTD..git
cd ALPHA-CLOTHING-LTD.
npm install
npm run dev
# http://localhost:3000
```

> **নোট:** এই মোডে ডেটা ব্রাউজারের `localStorage` এ থাকে। রিফ্রেশে থাকবে, কিন্তু ব্রাউজার ক্লিয়ার করলে মুছে যাবে। সার্ভার চালালে SQLite এ স্থায়ী হবে।

### ২) ফুল-স্ট্যাক (Client + Server + SQLite)

```bash
# টার্মিনাল ১ - ব্যাকএন্ড
cd server
npm install
# .env তৈরি করুন (ঐচ্ছিক)
cp .env.example .env
# PORT=4000, JWT_SECRET=your-secret
npm run dev
# http://localhost:4000/api/health

# টার্মিনাল ২ - ফ্রন্টএন্ড
cd ..
npm install
npm run dev
# http://localhost:3000  (API প্রক্সি /api -> 4000)
```

> ফ্রন্টএন্ডে `localStorage` ফলব্যাক আছে, তাই সার্ভার না চললেও অ্যাপ কাজ করবে। সার্ভার চললে JWT দিয়ে API কল করবে।

### ৩) Docker দিয়ে

```bash
docker build -t smart-ledger .
docker run -p 4000:4000 smart-ledger
# http://localhost:4000  (API + Frontend একসাথে serve করবে)
```

---

## 🔐 API ডকুমেন্টেশন

Base URL: `http://localhost:4000/api`

### Auth
| Method | Endpoint | Body | Header |
|--------|----------|------|--------|
| POST | `/auth/register` | `{name, email, password}` | - |
| POST | `/auth/login` | `{email, password}` | - |
| GET | `/auth/me` | - | `Authorization: Bearer <token>` |
| PUT | `/auth/profile` | `{name, email}` | `Bearer` |

### Customers
| Method | Endpoint | Query/Body | Header |
|--------|----------|------------|--------|
| GET | `/customers?search=` | search=name/phone | Bearer |
| POST | `/customers` | `{name, phone, address?, email?}` | Bearer |
| GET | `/customers/:id` | - | Bearer |
| PUT | `/customers/:id` | `{name, phone, address?, email?}` | Bearer |
| DELETE | `/customers/:id` | - | Bearer |

### Transactions
| Method | Endpoint | Body | Header |
|--------|----------|------|--------|
| POST | `/transactions` | `{customer_id, type, amount, description?, note?, transaction_date}` | Bearer |
| GET | `/transactions?customer_id=` | - | Bearer |
| DELETE | `/transactions/:id` | - | Bearer |

### Dashboard & Backup
| Method | Endpoint | Header |
|--------|----------|--------|
| GET | `/dashboard` | Bearer |
| GET | `/backup` | Bearer |
| POST | `/restore` | Bearer |

---

## 🎨 UI/UX

- **ভাষা:** সম্পূর্ণ বাংলা (বাটন, লেবেল, মেসেজ)
- **রেসপনসিভ:** মোবাইল-ফার্স্ট, গ্রিড লেআউট
- **থিম:** Light/Dark, Tailwind CSS, গ্লাসমরফিজম কার্ড
- **চার্ট:** Recharts (Bar + Pie)
- **ফন্ট:** Noto Sans Bengali + Inter

---

## 🧪 টেস্ট

```bash
npm run test
```

---

## 📦 ডিপ্লয়মেন্ট

- **Vercel / Netlify** (Frontend): `npm run build` -> `dist/`
- **Render / Railway / Fly.io** (Full-stack): `Dockerfile` ব্যবহার করুন
- **VPS**: `pm2 start server/index.js --name smart-ledger`

---

## 🤝 কন্ট্রিবিউশন

1. Fork করুন
2. Feature branch তৈরি করুন (`git checkout -b feature/amazing`)
3. Commit করুন (`git commit -m 'Add amazing'`)
4. Push করুন (`git push origin feature/amazing`)
5. Pull Request খুলুন

---

## 📄 লাইসেন্স

MIT

---

**তৈরি করেছেন:** Smart Ledger Team | দোকানদারের ডিজিটাল সঙ্গী 📚
