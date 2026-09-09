# 💰 Alpha Finance — Shared Finance Manager (2 Members)

দুইজন সদস্যের জন্য প্রিমিয়াম শেয়ার্ড ফাইন্যান্স ম্যানেজার — একটি খাতা, দুইজনের পূর্ণ অ্যাকসেস।
A premium shared finance manager for two members — one ledger, full access for both.

## ✨ Features

| Tab | What's inside |
|---|---|
| 🏠 **Dashboard** | Balance, monthly income/expense/savings, 6-month cash-flow chart, category donut, budget snapshot, recent transactions, per-member summary |
| 🧾 **Transactions** | Add/edit/delete income & expense, search + filters (type, category, member, method, date range), grouped by day |
| 🎯 **Budget** | Monthly category limits with progress, warning & over-budget states, overall summary |
| 🏆 **Savings Goals** | Shared goals, contribute/withdraw, deadlines, progress |
| 📊 **Reports** | Month + member filter, 6-month trend, savings line, daily spending, income sources, top expenses, CSV export |
| ⚙️ **Settings** | Profiles (Gmail/mobile/PIN per member), currency, dark/light theme, বাংলা/English, JSON backup & restore, demo data |

## 👥 Login (2 members share everything)

- Login with **Gmail** or **mobile number** + **PIN**
- Demo accounts (change these in Settings → Profiles):
  - `member1@gmail.com` / `+8801710000001` — PIN `1234`
  - `member2@gmail.com` / `+8801720000002` — PIN `1234`
- "Continue with Google" is a **demo** picker (no real OAuth client is configured)
- Both members see and edit the **same shared ledger**

## 🔧 Tech

- Zero-dependency static web app — plain HTML/CSS/JS (no build step)
- Custom SVG/CSS charts, i18n (EN + বাংলা), dark/light themes
- Data stored in `localStorage` of the browser — use **Export JSON** to move data between devices

## ▶️ Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

> নোট: ডেটা ব্রাউজারের localStorage-এ থাকে, তাই দুই সদস্য একই ব্রাউজারে লগইন করলে একই খাতা দেখবেন। আলাদা ডিভাইস থেকে রিয়েল-টাইম সিঙ্ক + আসল Google লগইন চাইলে Firebase/ব্যাকএন্ড যুক্ত করতে হবে।
