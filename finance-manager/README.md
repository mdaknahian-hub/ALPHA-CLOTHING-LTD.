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
| ☁️ **Cloud Sync** | Optional Firebase — real-time shared ledger between 2 devices, real Google (Gmail) login, family join code, offline-first |

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
- Optional Firebase cloud sync (real-time, offline-first) — no SDK download needed, loads on demand
- Data stored in `localStorage` of the browser — use **Export JSON** to move data between devices

## ▶️ Run

Open `index.html` directly, or serve the folder:

```bash
python3 -m http.server 8080
# → http://localhost:8080
```

---

## ☁️ Cloud Sync setup (Firebase) — দুই ডিভাইসে রিয়েল-টাইম শেয়ার

আপনি একা ব্যবহার করলে কিছু করতে হবে না — অ্যাপটি localStorage-এ পুরোপুরি চলে। কিন্তু **দুইজন সদস্য দুই ডিভাইস থেকে একই খাতা লাইভ দেখতে চাইলে** একবার Firebase কানেক্ট করতে হবে (ফ্রি):

### ধাপ ১ — Firebase প্রজেক্ট (৫ মিনিট)

1. [console.firebase.google.com](https://console.firebase.google.com) → **Add project** (ফ্রি প্ল্যানই যথেষ্ট)
2. **Build → Authentication → Get started → Google → Enable** করুন
3. **Build → Firestore Database → Create database** (production mode)
4. **Project settings (⚙) → Your apps → Web (</>)** → রেজিস্টার করে `firebaseConfig` অবজেক্টটি কপি করুন
5. **Authentication → Settings → Authorized domains**-এ আপনার সাইটের ডোমেইন যোগ করুন (localhost আগেই আছে)

> অ্যাপের কানেক্ট মোডালে রিপোজিটরির একটি Firebase প্রজেক্ট আগেই বসানো থাকে — চাইলে সেটিও ট্রাই করতে পারেন, নাহলে নিজেরটি পেস্ট করুন।

### ধাপ ২ — Security Rules (একবার)

Firebase Console → **Firestore Database → Rules**-এ [`firestore.rules`](./firestore.rules) ফাইলের কনটেন্ট পেস্ট করে **Publish** দিন।

> ⚠️ যদি এই ডেটাবেস রিপোর অন্য অ্যাপের (garment production tracker) সাথে শেয়ার্ড হয়, পুরো ফাইল রিপ্লেস না করে শুধু `match /ledgers/{ledgerId} { … }` ব্লকটি existing rules-এ যোগ করুন।

### ধাপ ৩ — অ্যাপে কানেক্ট

1. আগে **Settings → Member Profiles**-এ দুইজনের আসল Gmail বসিয়ে নিন (এই দুটি Gmail-ই ক্লাউডে অনুমোদিত হবে)
2. **Settings → Cloud Sync → Connect Firebase** (বা টপবারের ☁️ বাটন)
3. কনফিগ পেস্ট করুন → **Create new family ledger** → নিজের Gmail দিয়ে সাইন-ইন করুন
4. **Family code** (যেমন `AF-7K2M9X4Q`) কপি করে অন্য সদস্যকে পাঠান
5. অন্য সদস্য তার ডিভাইসে একইভাবে কানেক্ট করবেন, শুধু **Join with code** বেছে কোডটি দেবেন

ব্যস! এরপর এক ডিভাইসে কিছু যোগ/এডিট/ডিলিট করলেই অন্য ডিভাইসে **সাথে সাথে** দেখা যাবে। ইন্টারনেট কাটলে ডেটা ডিভাইসে থাকবে, নেট এলেই সিঙ্ক হয়ে যাবে।

**কীভাবে কাজ করে:**
- প্রতিটি পরিবারের খাতা = Firestore-এ একটি ডকুমেন্ট (`ledgers/{code}`)
- শুধু অনুমোদিত ২টি Gmail সেটি পড়া/লেখা করতে পারে (security rules দিয়ে বাধ্যতামূলক)
- PIN কখনো ক্লাউডে যায় না — প্রতিটি ডিভাইসে আলাদা থাকে
- Google সাইন-ইন করা থাকলে লগইন স্ক্রিনের "Continue with Google" বাটনটি সরাসরি আসল Google লগইন হয়ে যায়

---

> নোট: ডেটা ব্রাউজারের localStorage-এ থাকে, তাই দুই সদস্য একই ব্রাউজারে লগইন করলে একই খাতা দেখবেন। আলাদা ডিভাইস থেকে রিয়েল-টাইম সিঙ্কের জন্য উপরের Firebase সেটআপটি করুন।
