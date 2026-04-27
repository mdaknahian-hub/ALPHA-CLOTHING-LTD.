import React, { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, FileSpreadsheet, FileText, Minimize2, Maximize2, Paperclip, Loader2, Lock, Zap, Brain, Settings2 } from 'lucide-react';
import { collection, getDocs, query, orderBy, doc, onSnapshot, limit } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import * as xlsx from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Component to render a table with export buttons permanently visible
const ExportableTable = ({ children, ...props }: any) => {
  const tableRef = useRef<HTMLTableElement>(null);

  const getReportTitle = () => {
    let reportTitle = "PRODUCTION REPORT";
    if (tableRef.current) {
      const container = tableRef.current.closest('.table-wrapper-container');
      if (container && container.previousElementSibling) {
        const prevText = container.previousElementSibling.textContent;
        if (prevText) {
          reportTitle = prevText.replace(/#/g, '').trim().toUpperCase();
        }
      }
    }
    return reportTitle;
  };

  const exportExcel = () => {
    if (!tableRef.current) return;
    const title = getReportTitle();
    
    // Extract data from table manually for best reliability
    const tableData: any[][] = [];
    const headerCells = tableRef.current.querySelectorAll('thead th');
    const headers: string[] = [];
    headerCells.forEach(th => headers.push(th.textContent?.trim() || ''));
    tableData.push(headers);

    const rows = tableRef.current.querySelectorAll('tbody tr');
    rows.forEach(tr => {
      const row: string[] = [];
      tr.querySelectorAll('td').forEach(td => row.push(td.textContent?.trim() || ''));
      tableData.push(row);
    });

    const ws = xlsx.utils.aoa_to_sheet([
      ["ALPHA CLOTHING LTD."],
      ["Address: 123 Industrial Area, Dhaka, Bangladesh"],
      [`Report Name: ${title}`],
      [`Generated On: ${new Date().toLocaleString('en-GB')}`],
      [`Prepared By: ${auth.currentUser?.email || 'System Admin'}`],
      [], // Empty row
      ...tableData
    ]);
    
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "AI_Report");
    xlsx.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportPDF = async () => {
    if (!tableRef.current) return;
    const title = getReportTitle();
    const doc = new jsPDF('p', 'mm', 'a4');
    
    // Header - matching the style of the app's Master Report
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("ALPHA CLOTHING LTD.", 14, 20);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(234, 179, 8); // amber-500
    doc.text("MASTER REPORT", 196, 20, { align: 'right' });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("The Best Look Anytime Anywhere", 14, 25);
    doc.text("Address: 123 Industrial Area, Dhaka, Bangladesh", 14, 29);
    
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    doc.text(`PREPARED BY: ${auth.currentUser?.email?.toUpperCase() || 'SYSTEM ADMIN'}`, 196, 25, { align: 'right' });
    doc.text(`DATE: ${new Date().toLocaleDateString('en-GB')} | TIME: ${new Date().toLocaleTimeString('en-GB')}`, 196, 29, { align: 'right' });
    
    // Aesthetic orange line just like in the screenshot
    doc.setDrawColor(234, 179, 8);
    doc.setLineWidth(1);
    doc.line(14, 34, 196, 34);

    // Title of the table
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(title, 105, 42, { align: 'center' });

    try {
      const headers: string[][] = [];
      const data: string[][] = [];
      
      const headRows = tableRef.current.querySelectorAll('thead tr');
      headRows.forEach(row => {
        const rowData: string[] = [];
        row.querySelectorAll('th').forEach(cell => rowData.push(cell.innerText.trim()));
        if (rowData.length > 0) headers.push(rowData);
      });

      const bodyRows = tableRef.current.querySelectorAll('tbody tr');
      bodyRows.forEach(row => {
        const rowData: string[] = [];
        row.querySelectorAll('td').forEach(cell => rowData.push(cell.innerText.trim()));
        if (rowData.length > 0) data.push(rowData);
      });

      autoTable(doc, {
        head: headers,
        body: data,
        startY: 48,
        theme: 'grid',
        styles: { 
          fontSize: 8, 
          cellPadding: 3, 
          font: "helvetica",
          textColor: [51, 65, 85],
          lineColor: [226, 232, 240], // slate-200
          lineWidth: 0.1,
        },
        headStyles: { 
          fillColor: [15, 23, 42], // slate-900 (matches screenshot)
          textColor: 255, 
          fontStyle: 'bold', 
          halign: 'center',
          valign: 'middle'
        },
        columnStyles: {
          0: { cellWidth: 10, halign: 'center' }
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { top: 48, left: 14, right: 14 },
      });

      doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('PDF তৈরি করতে সমস্যা হয়েছে।');
    }
  };

  return (
    <div className="table-wrapper-container my-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-border overflow-hidden">
      {/* Modern Action Bar Always Visible */}
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800/50 px-4 py-3 border-b border-border">
        <span className="text-xs font-black uppercase tracking-widest text-muted flex items-center gap-2">
          <FileText size={14} className="text-accent"/>
          Data Report
        </span>
        <div className="flex gap-2">
          <button 
            onClick={exportExcel} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 text-xs font-black uppercase tracking-tighter rounded-lg transition-all border border-emerald-500/20"
          >
            <FileSpreadsheet size={14} /> Excel
          </button>
          <button 
            onClick={exportPDF} 
            className="flex items-center gap-1.5 px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs font-black uppercase tracking-tighter rounded-lg transition-all border border-rose-500/20"
          >
            <FileText size={14} /> PDF
          </button>
        </div>
      </div>
      <div className="overflow-x-auto p-4 w-full block">
        <table ref={tableRef} className="w-full text-sm text-left align-middle border-collapse text-slate-800 dark:text-slate-100" {...props}>
          {children}
        </table>
      </div>
    </div>
  );
};



type Message = {
  role: 'user' | 'model';
  text: string;
  timestamp?: string;
};

const MarkdownTable = ({node, ...props}: any) => <ExportableTable {...props} />;

export const FloatingAgent: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('ai_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    return [
      { 
        role: 'model', 
        text: 'হ্যালো! আমি আপনার গারমেন্ট প্রোডাকশন সিস্টেমের স্মার্ট এআই (AI) অ্যাসিস্ট্যান্ট। আমি আপনার অর্ডার, প্রোডাকশন এবং অন্যান্য ডেটা এনালাইজ করে যেকোনো রিপোর্ট বা তথ্য দিতে পারি। আজ আপনাকে কীভাবে সাহায্য করতে পারি?',
        timestamp: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
      }
    ];
  });

  useEffect(() => {
    localStorage.setItem('ai_chat_history', JSON.stringify(messages));
  }, [messages]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // AI Settings State
  const [aiStatus, setAiStatus] = useState<'active' | 'frozen'>('active');
  const [aiConfig, setAiConfig] = useState({
    agentName: 'System AI Agent',
    agentIcon: 'Bot',
    systemPrompt: ''
  });

  // Dragging State
  const [position, setPosition] = useState<{ x: number, y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<{ startX: number, startY: number, initialX: number, initialY: number } | null>(null);

  const [sentiment, setSentiment] = useState<'neutral' | 'happy' | 'sad' | 'thinking'>('neutral');
  const [isMaximized, setIsMaximized] = useState(false);
  const [selectedModel, setSelectedModel] = useState<'gemini-3-flash-preview' | 'gemini-3.1-pro-preview'>('gemini-3-flash-preview');
  const [selectedAgent, setSelectedAgent] = useState<'analytics' | 'creative'>('analytics');
  const [showModelSettings, setShowModelSettings] = useState(false);

  useEffect(() => {
    // 1. If user is currently typing in the input box, AI thinks
    if (input.trim().length > 0) {
      setSentiment('thinking');
      return;
    }
    
    // 2. If AI is processing a request (loading API), AI thinks
    if (isTyping) {
       setSentiment('thinking');
       return;
    }

    // 3. Otherwise, check context of the chat
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      const lastUserMessage = [...messages].reverse().find(m => m.role === 'user');
      
      let isAngry = false;
      if (lastUserMessage) {
          const text = lastUserMessage.text.toLowerCase();
          if (/(slow|kharap|bad|boka|na|stupid|dur|faltu|late|kosto|virko|baje)/.test(text)) {
              isAngry = true;
          }
      }

      if (isAngry) {
          setSentiment('sad');
      } else if (lastMessage.role === 'model') {
          // If the last message is from the AI, it should look happy and proud (Answer dile face hasi thakbe)
          setSentiment('happy');
      } else {
          // Default to neutral (which is a slight smile now) when just waiting empty
          setSentiment('neutral');
      }
    } else {
       setSentiment('neutral');
    }
  }, [messages, isTyping, input]);

  // Existing scroll logic
  useEffect(() => {
    if (scrollRef.current && isOpen) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, isOpen]);

  useEffect(() => {
    const handleTrigger = (e: any) => {
      setIsOpen(true);
      setTimeout(() => {
        const text = e.detail.prompt;
        setInput(text);
        // We trigger handleSend slightly after to ensure UI is open
        setTimeout(() => {
            const btn = document.getElementById('ai-send-btn');
            if (btn) (btn as HTMLElement).click();
        }, 150);
      }, 400);
    };

    window.addEventListener('ai-trigger', handleTrigger);
    return () => window.removeEventListener('ai-trigger', handleTrigger);
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'ai_control'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.status) {
          setAiStatus(data.status);
          if (data.status === 'frozen') {
             setIsOpen(false);
          }
        }
        if (data.agentName) {
           setAiConfig(prev => ({ ...prev, agentName: data.agentName }));
        }
        if (data.agentIcon) {
           setAiConfig(prev => ({ ...prev, agentIcon: data.agentIcon }));
        }
        if (data.systemPrompt !== undefined) {
           setAiConfig(prev => ({ ...prev, systemPrompt: data.systemPrompt }));
        }
      }
    });
    return () => unsub();
  }, []);

  const fetchSystemData = async () => {
    try {
      // Optimized context fetch: Only pull metadata and most recent logs to save tokens
      const [orders, entries, finishing, excels] = await Promise.all([
        getDocs(query(collection(db, 'orders'), limit(100))),
        getDocs(query(collection(db, 'entries'), orderBy('date', 'desc'), limit(50))),
        getDocs(query(collection(db, 'finishing_tracking'), orderBy('date', 'desc'), limit(50))),
        getDocs(query(collection(db, 'excel_files'), orderBy('uploadedAt', 'desc'), limit(1)))
      ]);

      const data = {
        summary: {
          total_orders: orders.size,
          recent_production_count: entries.size,
          last_update: new Date().toISOString()
        },
        orders: orders.docs.map(d => d.data()),
        production_entries: entries.docs.map(d => d.data()),
        finishing_records: finishing.docs.map(d => d.data()),
        excel_library_files: excels.docs.map(d => {
           const row = d.data();
           return {
               fileName: row.fileName,
               uploadedBy: row.uploadedBy,
               data: typeof row.content === 'string' ? JSON.parse(row.content || '{}') : row.content
           }
        })
      };

      return JSON.stringify(data);
    } catch (error) {
      console.error("Error fetching context for AI:", error);
      return "Unable to fetch live database context right now.";
    }
  };

  const handleSend = async () => {
    if (!input.trim() || aiStatus === 'frozen') return;

    const userText = input.trim();
    const time = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    setMessages(prev => [...prev, { role: 'user', text: userText, timestamp: time }]);
    setInput('');
    setIsTyping(true);

    try {
      let dataContext = '';
      let systemInstruction = '';

      if (selectedAgent === 'analytics') {
        dataContext = await fetchSystemData();
        const defaultInstruction = `You are the specialized AI assistant for the ALPHA CLOTHING LTD. Garment Production Management System, AND a highly capable general-purpose AI.
You have direct access to live order, production, finishing, and upload data via your context to manage garment production.
However, if the user asks you about ANY general knowledge, ideas, or things completely unrelated to garment production, YOU MUST gladly and beautifully answer those questions.
Your persona is smart, precise, helpful, and friendly.
You MUST speak in professional but friendly Bengali by default, unless the user addresses you in English.
When explaining an idea or anything new, beautifully explain the entire concept in Bengali first.
If a big change is proposed, ask "আপনি বললে আমি কাজটি শুরু করব" before proceeding.
Always remember chat context. If the user refers to past instructions, confirm by asking back (e.g. "আপনি আগে একবার নতুন আইকন দিতে বলেছিলেন এখন ও কি নতুন আইকন দিব?").

You understand the following modules:
1. Order Master: Managing buyer orders, styles, and total quantities.
2. Production Entry: Tracking daily input, output, and losses (Cutting, Sewing, Wash, Finishing, Poly).
3. Finishing Tracker: Final stage monitoring.
4. Data Library: Bulk import handling.
5. Excel Analysis: 
   - You can read all uploaded Excel files.
   - When asked to list sheets, look at 'excel_library_files' in your context.
   - You DO NOT need to be told about Excel files beforehand; just ask me to upload them if you don't see any in the data provided.
   - When asked for reports from Excel, analyze the structure provided in 'data' within 'excel_library_files'.
   - ***CRITICAL MIMICRY RULE***: If asked to create a report for one month (e.g., MAY-26) based on the structure of another (e.g., APRIL-26), YOU MUST first scan the APRIL-26 data structure, IDENTIFY all columns, headers, and grouping logic used, and THEN apply that EXACT same structure to the MAY-26 data. DO NOT deviate from the structure of the source sheet.`;

        systemInstruction = `
${aiConfig.systemPrompt || defaultInstruction}

*** CRITICAL REPORTING RULE ***
Whenever the user asks you to generate ANY report or table (like WIP, Production, Order Status), you MUST follow these specific formatting rules:
1. Output an H3 (###) Title immediately ABOVE the Markdown Table.
2. The Title MUST follow this exact semantic logic (combine Month/Date and requested Departments).

3. BEFORE generating any report data, YOU MUST ASK THE BOSS (USER) FOR CONFIRMATION:
   - "বস, আপনি এই রিপোর্টে কোন কোন কলাম দেখতে চান? (যেমন: কাটিং, সুইং, ফিনিশিং, নাকি অন্য কিছু?) WIP-এর জন্য নির্দিষ্ট Logic বা BAL QTY-এর Calculation কি হবে?"
   - এরপর, একটি প্রিভিউ টেবিল তৈরি করবেন এবং জিজ্ঞাসা করবেন, "এই টেবিলটি কি ঠিক আছে? কনফার্ম করলে আমি ফাইনাল ডাউনলোড লিঙ্ক দিব।"

4. TABLE FORMATTING:
   - Use standard English characters for Table Headers (DO NOT use local encoding or unusual symbols).
   - Use these standardized headers where applicable: SL, BUYER, STYLE, PO NO, COLOR, ORDER QTY, CUTTING, SEWING, WASH, FINISHING, POLY, SHIP DATE.
   - For WIP, use headers like: BUYER, STYLE, PO NO, DEPT (WASH/SEWING), BAL QTY.
5. DO NOT use special characters like ┐, ┘, ├, ┤ in the headers or table cells as they break PDF generation.
6. Keep the data clean and aligned with the factory's standard Master Report format.

Here is the raw context of recent Orders, Production Entries, Finishing Records, and Uploaded Excel files in JSON format:
${dataContext}
`;
      } else {
        // Creative / General Agent (No Data Context to save tokens & boost speed)
        systemInstruction = `You are a Creative & General AI Assistant named "Creative AI".
You are fast, helpful, and you do not require factory data context. You are here to help the user write emails, translate text, brainstorm ideas, answer general questions, and assist with coding or creative writing.
You have a friendly, encouraging, and human-like persona.
You MUST speak in professional but friendly Bengali by default, unless the user addresses you in English.
Do not mention Garment Production unless the user asks about it generally. You do not have access to live database records.`;
      }

      // Pass previous context (simple memory)
      const chatHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));

      setIsTyping(true);

      const responseStream = await ai.models.generateContentStream({
        model: selectedModel,
        contents: chatHistory,
        config: {
          systemInstruction,
          temperature: 0.2, // Low temp for data accuracy
        }
      });

      let fullResponseText = '';
      let isFirstChunk = true;
      
      for await (const chunk of responseStream) {
        if (isFirstChunk) {
            setIsTyping(false); // Stop loader to show stream
            const responseTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
            setMessages(prev => [...prev, { role: 'model', text: '', timestamp: responseTime }]);
            isFirstChunk = false;
        }
        
        fullResponseText += chunk.text || '';
        setMessages(prev => {
           const next = [...prev];
           next[next.length - 1].text = fullResponseText;
           return next;
        });
      }
      
      if (isFirstChunk) {
           setIsTyping(false);
           setMessages(prev => [...prev, { role: 'model', text: fullResponseText }]);
      }

    } catch (error: any) {
      console.error("Agent Error:", JSON.stringify(error));
      let errorMessage = 'দুঃখিত, কোনো একটি সমস্যা হয়েছে সার্ভারের সাথে যোগাযোগ করতে। দয়া করে আবার চেষ্টা করুন।';
      if (error?.status === 429 || error?.message?.includes('429') || error?.status === 'RESOURCE_EXHAUSTED' || error?.error?.status === 'RESOURCE_EXHAUSTED') {
          errorMessage = 'দুঃখিত, বর্তমানে এআই-এর ব্যবহারের কোটা শেষ হয়ে গেছে। কিছুক্ষণ পর আবার চেষ্টা করুন। (Rate Limit Exceeded)';
      }
      setMessages(prev => {
        const next = [...prev];
        // Only modify last message if it's an empty model message
        if (next[next.length - 1]?.role === 'model' && next[next.length - 1]?.text === '') {
            next[next.length - 1].text = errorMessage;
        } else {
            next.push({ role: 'model', text: errorMessage });
        }
        return next;
      });
    } finally {
      setIsTyping(false);
    }
  };

  const renderIcon = (size: number) => {
    return (
      <div className="bg-indigo-500 text-white rounded-full flex items-center justify-center shadow-xl border border-indigo-400" style={{ width: size, height: size }}>
         <Brain size={size * 0.55} strokeWidth={2.5} />
      </div>
    );
  };

  return (
    <AnimatePresence>
      {!isOpen ? (
        <motion.button
          key="closed-agent"
          onClick={() => {
             if (aiStatus === 'frozen') {
                 alert('AI is currently frozen by the Administrator.');
                 return;
             }
             setIsOpen(true);
          }}
          className={`fixed z-50 top-3 lg:top-2 right-20 lg:right-64 p-0.5 rounded-full shadow-lg transition-all border border-white/5 opacity-60 hover:opacity-100 ${
             aiStatus === 'frozen' ? 'bg-bg cursor-not-allowed' : 'bg-transparent cursor-pointer'
          }`}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.5 }}
        >
          {aiStatus === 'frozen' ? (
             <div className="bg-muted/20 p-2 rounded-full text-foreground">
                <Lock size={20} />
             </div>
          ) : renderIcon(42)}
        </motion.button>
      ) : (
        <motion.div 
            key="open-agent"
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.2 }}
            className={`fixed ${isMaximized ? 'top-4 right-4 bottom-4 left-4 w-auto h-auto rounded-2xl' : 'top-14 right-[3%] lg:right-6 w-[94%] sm:w-[350px] h-[calc(100dvh-70px)] sm:h-[500px] rounded-b-2xl sm:rounded-3xl border-t-0 sm:border-t'} bg-bg shadow-2xl flex flex-col z-[100] border border-border overflow-hidden transition-all duration-300`}
        >
          {/* Header */}
          <div className="bg-bg border-b border-border p-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div 
                className="bg-accent/10 p-1.5 rounded-full border border-accent/20 cursor-pointer hover:bg-accent/20 transition-colors"
                onClick={() => setIsOpen(false)}
                title="Close AI Assistant"
              >
                {renderIcon(32)}
              </div>
              <div>
                <h3 className="font-bold text-sm tracking-wide text-fg leading-tight">
                  {selectedAgent === 'analytics' ? aiConfig.agentName : 'Creative AI'}
                </h3>
                <p className="text-[10px] text-success font-medium flex items-center gap-1 mt-0.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></span>
                   Active ({selectedModel === 'gemini-3.1-pro-preview' ? '3.1 Pro' : '3 Flash'})
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 z-10">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowModelSettings(!showModelSettings); }}
                className={`text-muted hover:text-fg hover:bg-border/50 p-2 rounded-full transition-all ${showModelSettings ? 'bg-border/50 text-fg' : ''}`}
                title="AI Settings"
              >
                <Settings2 size={18} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsMaximized(!isMaximized); }}
                className="text-muted hover:text-fg hover:bg-border/50 p-2 rounded-full transition-all"
              >
                {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="text-muted hover:text-fg hover:bg-border/50 p-2 rounded-full transition-all hover:rotate-90"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Model Settings Panel / Messages Area */}
          {showModelSettings ? (
            <div className="flex-1 overflow-y-auto p-4 bg-bg flex flex-col items-center justify-start py-8 space-y-6 custom-scrollbar">
               {/* Agent Persona Selection */}
               <div className="w-full max-w-[280px]">
                 <div className="text-center mb-4">
                   <h4 className="font-black text-sm uppercase tracking-widest text-fg">Agent Persona</h4>
                   <p className="text-[10px] uppercase text-muted tracking-wider mt-1">Choose AI behavior</p>
                 </div>
                 <div className="space-y-3">
                   <button 
                     onClick={() => setSelectedAgent('analytics')}
                     className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${selectedAgent === 'analytics' ? 'border-accent bg-accent/10' : 'border-border bg-card/50 hover:border-slate-500'}`}
                   >
                     <div className={`p-2 rounded-full ${selectedAgent === 'analytics' ? 'bg-accent/20 text-accent' : 'bg-bg border border-border text-muted'}`}>
                       <FileSpreadsheet size={16} />
                     </div>
                     <div className="text-left flex-1">
                       <div className={`font-black text-xs uppercase tracking-widest ${selectedAgent === 'analytics' ? 'text-accent' : 'text-fg'}`}>Data Analyst</div>
                       <div className="text-[9px] text-muted opacity-90 mt-0.5">Loads factory DB. Slower & uses more context.</div>
                     </div>
                   </button>

                   <button 
                     onClick={() => setSelectedAgent('creative')}
                     className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${selectedAgent === 'creative' ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card/50 hover:border-slate-500'}`}
                   >
                     <div className={`p-2 rounded-full ${selectedAgent === 'creative' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-bg border border-border text-muted'}`}>
                       <Brain size={16} />
                     </div>
                     <div className="text-left flex-1">
                       <div className={`font-black text-xs uppercase tracking-widest ${selectedAgent === 'creative' ? 'text-indigo-400' : 'text-fg'}`}>Creative AI</div>
                       <div className="text-[9px] text-muted opacity-90 mt-0.5">Fast, chatty. No DB loaded (Tokens saved).</div>
                     </div>
                   </button>
                 </div>
               </div>

               <div className="w-full max-w-[280px] h-px bg-border my-2"></div>

                 {/* Engine Selection */}
                <div className="w-full max-w-[280px]">
                  <div className="text-center mb-4">
                    <h4 className="font-black text-sm uppercase tracking-widest text-fg">AI Engine</h4>
                    <p className="text-[10px] uppercase text-muted tracking-wider mt-1">Select logic model</p>
                  </div>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={() => setSelectedModel('gemini-3-flash-preview')}
                      className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${selectedModel === 'gemini-3-flash-preview' ? 'border-accent bg-accent/10' : 'border-border bg-card/50 hover:border-slate-500'}`}
                    >
                      <div className={`p-1.5 rounded-full ${selectedModel === 'gemini-3-flash-preview' ? 'bg-accent/20 text-accent' : 'bg-bg border border-border text-muted'}`}>
                        <Zap size={14} />
                      </div>
                      <div className="text-left">
                        <div className={`font-black text-[11px] uppercase tracking-widest ${selectedModel === 'gemini-3-flash-preview' ? 'text-accent' : 'text-fg'}`}>Gemini 3 Flash</div>
                      </div>
                    </button>

                    <button 
                      onClick={() => setSelectedModel('gemini-3.1-pro-preview')}
                      className={`w-full p-3 rounded-2xl border-2 transition-all flex items-center gap-3 ${selectedModel === 'gemini-3.1-pro-preview' ? 'border-indigo-500 bg-indigo-500/10' : 'border-border bg-card/50 hover:border-slate-500'}`}
                    >
                      <div className={`p-1.5 rounded-full ${selectedModel === 'gemini-3.1-pro-preview' ? 'bg-indigo-500/20 text-indigo-400' : 'bg-bg border border-border text-muted'}`}>
                        <Zap size={14} />
                      </div>
                      <div className="text-left">
                        <div className={`font-black text-[11px] uppercase tracking-widest ${selectedModel === 'gemini-3.1-pro-preview' ? 'text-indigo-400' : 'text-fg'}`}>Gemini 3.1 Pro</div>
                      </div>
                    </button>
                  </div>
                </div>
               
               <button 
                 onClick={() => setShowModelSettings(false)}
                 className="w-full max-w-[280px] bg-fg text-bg py-3 rounded-xl font-bold uppercase tracking-wider text-xs mt-4 hover:opacity-90"
               >
                 Done
               </button>
            </div>
          ) : (
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-bg custom-scrollbar"
            >
        {messages.map((msg, i) => (
          <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div 
              className={`max-w-[85%] rounded-2xl p-4 shadow-sm text-sm ${
                msg.role === 'user' 
                  ? 'bg-accent text-accent-content rounded-br-none' 
                  : 'bg-bg text-fg border border-border rounded-bl-none'
              }`}
            >
              {msg.role === 'model' ? (
                 <div className="prose prose-sm dark:prose-invert max-w-none prose-table:border-collapse prose-th:bg-accent/5 prose-th:p-2 prose-td:p-2 prose-th:border prose-th:border-border prose-td:border prose-td:border-border marker:text-accent">
                    <ReactMarkdown 
                      remarkPlugins={[remarkGfm]}
                      components={{
                        table: MarkdownTable
                      }}
                    >
                      {msg.text}
                    </ReactMarkdown>
                 </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
            </div>
            {msg.timestamp && (
              <span className="text-[10px] text-muted font-bold mt-1 px-1 uppercase tracking-tighter opacity-60">
                {msg.timestamp}
              </span>
            )}
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-bg border border-border/50 py-2 px-4 rounded-2xl rounded-bl-none shadow-xl flex items-center gap-3">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                <span className="w-1.5 h-1.5 bg-accent rounded-full animate-bounce"></span>
              </div>
              <span className="text-muted text-[11px] font-bold tracking-tight opacity-90 uppercase">... Typing</span>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Suggestions */}
      {!isTyping && messages.length < 5 && (
        <div className="px-4 py-2 flex flex-wrap gap-2">
          {["আজকের প্রোডাকশন সামারি দিন", "WIP রিপোর্ট তৈরি করুন", "পেন্ডিং অর্ডারের তালিকা দেখান"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setInput(s);
              }}
              className="text-[10px] font-bold uppercase tracking-tight bg-accent/10 hover:bg-accent/20 text-accent border border-accent/20 px-3 py-1.5 rounded-full transition-all"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 bg-bg border-t border-border">
        <div className="flex items-end gap-2 bg-black/10 p-1 pl-4 rounded-3xl border border-border focus-within:ring-1 ring-accent/50 focus-within:border-accent/40 transition-all">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask AI anything... (e.g. WIP Report)"
            className="flex-1 bg-transparent py-3 max-h-32 focus:outline-none resize-none text-sm text-fg min-h-[44px]"
            rows={1}
          />
          <button
            id="ai-send-btn"
            onClick={handleSend}
            disabled={!input.trim() || isTyping || aiStatus === 'frozen'}
            className="bg-accent hover:opacity-90 active:scale-95 text-accent-content p-2.5 rounded-full mb-1 mr-1 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
    )}
    </AnimatePresence>
  );
};
