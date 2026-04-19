import React from 'react';
import { 
  ShieldCheck, 
  Cpu, 
  Database, 
  Layout as LayoutPanelIcon, 
  Zap, 
  Settings, 
  FileBox, 
  Workflow, 
  Paintbrush, 
  LineChart, 
  Box as PackageIcon, 
  ShieldAlert,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function AboutSection() {
  const categories = [
    {
      title: "Project Identity & Branding",
      icon: LayoutPanelIcon,
      color: "text-accent",
      items: [
        { label: "Company Name", value: "ALPHA CLOTHING LTD." },
        { label: "Tagline", value: "The Best Look Anytime Anywhere" },
        { label: "Corporate Address", value: "Tenguri, BKSP, Ashulia, Savar, Dhaka" },
        { label: "Visual Identity", value: "Modern Industrial (Slate & Indigo with Gold Accents)" }
      ]
    },
    {
      title: "Technical Architecture",
      icon: Cpu,
      color: "text-indigo-400",
      items: [
        { label: "Frontend Framework", value: "React 18 + Vite" },
        { label: "Logic Engine", value: "TypeScript (Strict Typing)" },
        { label: "Real-time Backend", value: "Firebase Firestore + Auth" },
        { label: "Design System", value: "Tailwind CSS + Glassmorphism" },
        { label: "Motion Engine", value: "Framer Motion (motion/react)" }
      ]
    },
    {
      title: "Functional Modules (A-Z)",
      icon: Workflow,
      color: "text-success",
      items: [
        { label: "Order Master", value: "Centralized PO, Style & Buyer Repository" },
        { label: "Finishing Tracker", value: "Line-wise input/output monitoring" },
        { label: "DPR Engine", value: "Automated Daily Production Reporting" },
        { label: "WIP Analyzer", value: "Work-in-progress bottleneck detection" },
        { label: "Custom Report Builder", value: "Dynamic column drag-and-drop & formula editor" }
      ]
    },
    {
      title: "Data Intelligence",
      icon: Database,
      color: "text-info",
      items: [
        { label: "Formula Wizard", value: "Manual WIP logic configuration via UI" },
        { label: "Violation System", value: "Cross-check logic to prevent entry errors" },
        { label: "Dynamic Subtotals", value: "Context-aware summary calculation" },
        { label: "Achievement Tracker", value: "Real-time order completion percentage" }
      ]
    }
  ];

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-[40px] border border-border bg-bg2/40 p-10 md:p-20 shadow-2xl backdrop-blur-3xl ring-1 ring-white/5">
        <div className="absolute -top-20 -right-20 h-96 w-96 rounded-full bg-accent/10 blur-[120px]" />
        <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        
        <div className="relative z-10 max-w-4xl">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="mb-6 flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent/20 border border-accent/20">
              <Zap size={20} className="text-accent" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.5em] text-accent">Production Intelligence v2.5</span>
          </motion.div>
          
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl font-black leading-none tracking-tighter text-fg md:text-6xl lg:text-7xl"
          >
            THE ULTIMATE <br />
            <span className="bg-gradient-to-r from-accent to-indigo-400 bg-clip-text text-transparent">APP BLUEPRINT</span>
          </motion.h2>
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-8 max-w-2xl text-lg font-medium leading-relaxed text-muted"
          >
            This application is a cutting-edge Production ERP designed for high-density manufacturing environments. 
            Built with real-time synchronization and a deep logic validation engine to ensure zero-error reporting.
          </motion.p>
        </div>
      </div>

      {/* Grid Blueprint */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categories.map((cat, idx) => (
          <motion.div
            key={cat.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className="group relative rounded-[32px] border border-border bg-card/40 p-8 shadow-xl backdrop-blur-xl transition-all hover:border-accent/30 hover:bg-card/60"
          >
            <div className="mb-8 flex items-center justify-between">
              <div className={cn("flex items-center gap-4")}>
                <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl bg-bg border border-border", cat.color)}>
                  <cat.icon size={24} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight text-white">{cat.title}</h3>
              </div>
              <ChevronRight size={20} className="text-muted opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
            </div>

            <div className="space-y-4">
              {cat.items.map((item) => (
                <div key={item.label} className="border-b border-border/50 pb-3 last:border-0 last:pb-0">
                  <div className="text-[10px] font-black uppercase tracking-widest text-muted/60">{item.label}</div>
                  <div className="mt-1 text-sm font-bold text-fg/90">{item.value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* NEW: Detailed Sheet-by-Sheet Operation Guide */}
      <div className="space-y-8">
        <div className="flex items-center gap-4 border-l-4 border-accent pl-6">
          <h3 className="text-3xl font-black uppercase tracking-tighter">Sheet Geography & Operations Guide</h3>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {[
            {
              tab: "Order Master (অর্ডার মাস্টার)",
              desc: "এটি অ্যাপের প্রধান ডাটাবেস। এখানে সব নতুন কার্যাদেশ (Orders) জমা থাকে।",
              data: "বায়ার (Buyer), স্টাইল (Style), পিও (PO), শিপমেন্ট ডেট এবং কালার ওয়াইজ কোয়ান্টিটি (Order Qty)।",
              how: "ম্যানুয়ালি একটি একটি করে অথবা Excel ফাইল আপলোড করে হাজার হাজার ডাটা এক সেকেন্ডে যোগ করা যায়।",
              download: "উপরে থাকা 'Download Area' থেকে Excel ফরম্যাটে পুরো মাস্টার লিস্ট ডাউনলোড করা যায়।"
            },
            {
              tab: "Data Entry (প্রোডাকশন এন্ট্রি)",
              desc: "প্রতিদিনের প্রোডাকশন ডাটা ইনপুট করার জায়গা। এটি ডাইনামিক এবং ভ্যালিডেটেড।",
              data: "কাটিং (Cutting), সুইং ইনপুট/আউটপুট, ওয়াশ এবং পলি ডাটা।",
              how: "প্রথমে পিও (PO) সার্চ করুন, তারপর নির্দিষ্ট কালারের বিপরীতে কোয়ান্টিটি লিখে 'Save' বাটনে ক্লিক করুন।",
              download: "এন্ট্রি লিস্টের নিচে থাকা হিস্ট্রি টেবিল থেকে ফিল্টার করে ডাটা দেখা যায়।"
            },
            {
              tab: "Finishing Tracking (ফিনিশিং স্টেশন)",
              desc: "স্টাইল ভিত্তিক ফিনিশিং প্রোডাকশন ট্র্যাকার। এটি বাল্ক ডাটা এন্ট্রির জন্য সেরা।",
              data: "কালার, লাইন নম্বর, ইনপুট এবং আউটপুট কোয়ান্টিটি।",
              how: "স্টাইল সিলেক্ট করে 'Batch Entry' মোডে গিয়ে একসাথে অনেকগুলো রো (Rows) অ্যাড করে ডাটা সেভ করা যায়।",
              download: "উপরে ডানদিকে থাকা 'Download' বাটনে ক্লিক করলে প্রফেশনাল Excel রিপোর্ট সেভ হবে।"
            },
            {
              tab: "Custom Report (রিপোর্ট বিল্ডার)",
              desc: "আপনার প্রয়োজন অনুযায়ী কাস্টম কলাম দিয়ে রিপোর্ট তৈরির জাদুর বাক্স।",
              data: "পছন্দমতো যেকোনো কলাম এবং নিজেই তৈরি করা ক্যালকুলেটেড WIP কলাম।",
              how: "কলাম লিস্ট থেকে ড্র্যাগ করে ডানদিকে সাজান, পিরিয়ড সিলেক্ট করুন এবং 'Generate Report' দিন।",
              download: "প্রফেশনাল 'Excel' অথবা ব্র্যান্ডেড 'PDF' হিসেবে হাই-কোয়ালিটি ডাউনলোড করা যায়।"
            },
            {
              tab: "Order Status (অর্ডার স্ট্যাটাস)",
              desc: "প্রতিটি পিও-র বর্তমান অবস্থা এক পলকে দেখার ট্র্যাকার।",
              data: "অর্ডার কোয়ান্টিটির বিপরীতে কতটুকু কাটিং বা সুইং সম্পন্ন হয়েছে তার শতাংশ (%)।",
              how: "এটি পুরোপুরি অটোমেটিক। Master এবং Entry এর ডাটা থেকে এটি রিয়েল-টাইম ক্যালকুলেট হয়।",
              download: "এটি মূলত ভিজ্যুয়াল ট্র্যাকার, তবে মেইন ড্যাশবোর্ড থেকে এর সামারি পাওয়া যায়।"
            },
            {
              tab: "DPR / WIP Reports",
              desc: "অফিসিয়াল ডেইলি প্রোডাকশন এবং রিস্ক অ্যানালাইসিস রিপোর্ট।",
              data: "দৈনিক প্রোডাকশন সামারি এবং শিপমেন্ট রিস্ক (High/Low) স্ট্যাটাস।",
              how: "অটোমেটিক জেনারেটেড লজিক। আপনি শুধু তারিখ বা বায়ার ফিল্টার করবেন।",
              download: "ব্র্যান্ডেড PDF প্রিন্ট অথবা Excel ডাউনলোড করার বাটন প্রতিটি শিটের উপরে থাকে।"
            }
          ].map((sheet, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.98 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              className="rounded-3xl border border-border bg-bg2/20 p-8 hover:bg-bg2/40 transition-all border-l-8 border-l-accent"
            >
              <h4 className="text-xl font-black text-accent uppercase mb-4">{sheet.tab}</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <div className="text-[10px] font-black uppercase text-muted mb-1">উদ্দেশ্য (Purpose)</div>
                  <div className="text-xs font-bold text-fg/80">{sheet.desc}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-muted mb-1">কি ডাটা থাকে (Data)</div>
                  <div className="text-xs font-bold text-fg/80">{sheet.data}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-muted mb-1">কিভাবে এন্ট্রি হয় (Flow)</div>
                  <div className="text-xs font-bold text-fg/80">{sheet.how}</div>
                </div>
                <div>
                  <div className="text-[10px] font-black uppercase text-muted mb-1">ডাউনলোড প্রক্রিয়া (Export)</div>
                  <div className="text-xs font-bold text-fg/80">{sheet.download}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Deep Logic & Animation Details */}
      <div className="rounded-[40px] border border-border bg-gradient-to-br from-bg to-bg2 p-10 shadow-2xl">
        <div className="mb-12 flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
            <Zap size={24} />
          </div>
          <div>
            <h3 className="text-2xl font-black uppercase tracking-tight">Core System Intelligence</h3>
            <p className="text-xs font-bold text-muted mt-1 uppercase tracking-widest">Under-the-hood micro-features and interactions</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-6">
            <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-accent">
              <Paintbrush size={16} /> UI & UX Design
            </h4>
            <div className="space-y-3 text-xs font-medium text-muted/80 leading-relaxed">
              <p>• <span className="text-fg font-bold">Glassmorphism:</span> Real-time background blurring using CSS backdrop filters for a premium feel.</p>
              <p>• <span className="text-fg font-bold">Mobile First:</span> Fully responsive layout using Tailwind Flex and Grid systems.</p>
              <p>• <span className="text-fg font-bold">Typography:</span> Multi-font strategy combining high-weight display fonts with tabular monospace fonts.</p>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-indigo-400">
              <Settings size={16} /> Animation Logic
            </h4>
            <div className="space-y-3 text-xs font-medium text-muted/80 leading-relaxed">
              <p>• <span className="text-fg font-bold">AnimatePresence:</span> Smooth component removal transitions for tabs and modals.</p>
              <p>• <span className="text-fg font-bold">Spring Physics:</span> Non-linear animation curves for a natural, tactile interface feel.</p>
              <p>• <span className="text-fg font-bold">Layout Reordering:</span> Seamless cross-fade animations during column dragging.</p>
            </div>
          </div>

          <div className="space-y-6">
            <h4 className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-success">
              <ShieldCheck size={16} /> Backend & Safety
            </h4>
            <div className="space-y-3 text-xs font-medium text-muted/80 leading-relaxed">
              <p>• <span className="text-fg font-bold">Snapshot Sync:</span> WebSocket-based live updates from Firestore to all connected devices.</p>
              <p>• <span className="text-fg font-bold">Memoized Lookups:</span> O(1) complexity lookup maps for high-performance aggregate calculations.</p>
              <p>• <span className="text-fg font-bold">CSS Sanitization:</span> Dynamic removal of unsupported PDF color functions (Oklab/Oklch).</p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Identity */}
      <div className="flex flex-col items-center justify-center pt-10 text-center">
        <div className="mb-4 h-1 w-20 rounded-full bg-accent/20" />
        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-muted">
          ALPHA CLOTHING LTD. PRO-TECH SERIES
        </p>
        <p className="mt-2 text-[9px] font-bold text-muted/40 uppercase">
          Build v2.5.42 — SAVAR, DHAKA PREMISES
        </p>
      </div>
    </div>
  );
}
