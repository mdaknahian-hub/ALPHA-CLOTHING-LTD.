import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Bot, 
  User, 
  Sparkles, 
  Brain, 
  Zap, 
  Trash2, 
  MessageSquare,
  BarChart,
  AlertTriangle,
  Lightbulb,
  Loader2,
  Table as TableIcon,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, ThinkingLevel } from "@google/genai";
import { cn } from '../lib/utils';
import { Order, ProductionEntry } from '../types';
import * as XLSX from 'xlsx';

interface Message {
  role: 'user' | 'model';
  text: string;
  type?: 'general' | 'analysis' | 'thinking' | 'report';
  reportData?: {
    title: string;
    headers: string[];
    rows: any[];
  };
}

interface AIAssistantProps {
  orders: Order[];
  entries: ProductionEntry[];
}

export default function AIAssistant({ orders, entries }: AIAssistantProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Hello! I am your AI Production Assistant. I can now generate custom reports for you. For example, try asking: "Show me a report for JCP buyer in April with PO, Color, and Poly qty."', type: 'general' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'flash' | 'pro' | 'thinking'>('pro');
  const scrollRef = useRef<HTMLDivElement>(null);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getContextString = () => {
    // Provide a more structured context for data extraction
    const ordersData = orders.map(o => ({
      buyer: o.buyer,
      style: o.style,
      po: o.poNo,
      color: o.color,
      qty: o.orderQty,
      shipDate: o.shipDate
    }));

    const entriesData = entries.map(e => ({
      date: e.date,
      po: e.poNo,
      color: e.color,
      cut: e.cut,
      sew: e.sewOut,
      poly: e.poly,
      ship: e.shipment
    }));

    return `DATABASE CONTEXT (JSON format for your internal processing):
ORDERS: ${JSON.stringify(ordersData.slice(0, 100))}
ENTRIES: ${JSON.stringify(entriesData.slice(0, 200))}
TOTAL_RECORDS: Orders(${orders.length}), Entries(${entries.length})`;
  };

  const handleSend = async (overridePrompt?: string) => {
    const prompt = overridePrompt || input;
    if (!prompt.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', text: prompt };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const context = getContextString();
      const systemInstruction = `You are an expert Production Manager Assistant for Alpha Clothing Ltd. 
      You have access to real-time production data.
      
      CRITICAL INSTRUCTION:
      If the user asks for a "report", "table", "chart", or specific data breakdown (e.g., "Show me JCP buyer data for April"):
      1. Analyze the provided DATABASE CONTEXT.
      2. Filter and aggregate the data as requested.
      3. YOU MUST RESPOND WITH A JSON OBJECT wrapped in triple backticks with the language 'json'.
      
      The JSON structure MUST be:
      {
        "type": "report",
        "text": "Here is the report you requested for [Summary]...",
        "report": {
          "title": "Report Title",
          "headers": ["Column 1", "Column 2", ...],
          "rows": [
            {"Column 1": "Value", "Column 2": "Value", ...},
            ...
          ]
        }
      }
      
      If it's a general question, just respond with plain text.
      Always be professional and accurate.
      Always use the date format 'dd-MMM-yy' (e.g., 16-Apr-26) in your responses and reports.
      
      ${context}`;

      let modelName = "gemini-3.1-pro-preview"; // Default to Pro for better data handling
      let config: any = { systemInstruction };

      if (mode === 'thinking') {
        config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      } else if (mode === 'flash') {
        modelName = "gemini-3.1-flash-lite-preview";
      }

      const chat = ai.chats.create({
        model: modelName,
        config,
        history: messages.filter(m => m.type !== 'report').map(m => ({ 
          role: m.role, 
          parts: [{ text: m.text }] 
        }))
      });

      const result = await chat.sendMessage({ message: prompt });
      const responseText = result.text || "";

      // Try to parse JSON if it looks like a report
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/{[\s\S]*?}/);
      
      if (jsonMatch) {
        try {
          const data = JSON.parse(jsonMatch[1] || jsonMatch[0]);
          if (data.type === 'report' && data.report) {
            setMessages(prev => [...prev, { 
              role: 'model', 
              text: data.text || "Report generated successfully.", 
              type: 'report',
              reportData: data.report
            }]);
            setIsLoading(false);
            return;
          }
        } catch (e) {
          console.warn("Failed to parse AI JSON response, falling back to text.");
        }
      }

      setMessages(prev => [...prev, { role: 'model', text: responseText, type: mode === 'thinking' ? 'thinking' : 'general' }]);
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'model', text: "Error: " + (error instanceof Error ? error.message : "Failed to connect to AI service."), type: 'general' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = (report: any) => {
    const ws = XLSX.utils.json_to_sheet(report.rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "AI_Report");
    XLSX.writeFile(wb, `${report.title.replace(/\s+/g, '_')}.xlsx`);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] max-w-6xl mx-auto bg-bg2/50 backdrop-blur-xl rounded-2xl border border-border overflow-hidden shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-border bg-bg2/80 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
            <Bot className="text-accent" size={24} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-fg">AI Production Assistant & Report Generator</h2>
            <p className="text-[10px] text-muted font-medium uppercase tracking-wider">Powered by Gemini 3.1 Pro</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <div className="flex bg-bg p-1 rounded-lg border border-border">
            <button 
              onClick={() => setMode('flash')}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5",
                mode === 'flash' ? "bg-accent text-slate-950" : "text-muted hover:text-fg"
              )}
            >
              <Zap size={12} /> Fast
            </button>
            <button 
              onClick={() => setMode('pro')}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5",
                mode === 'pro' ? "bg-accent text-slate-950" : "text-muted hover:text-fg"
              )}
            >
              <Sparkles size={12} /> Pro
            </button>
            <button 
              onClick={() => setMode('thinking')}
              className={cn(
                "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center gap-1.5",
                mode === 'thinking' ? "bg-accent text-slate-950" : "text-muted hover:text-fg"
              )}
            >
              <Brain size={12} /> Thinking
            </button>
          </div>
          <button 
            onClick={() => setMessages([{ role: 'model', text: 'Chat cleared. How can I help you now?', type: 'general' }])}
            className="p-2 text-muted hover:text-danger hover:bg-danger/10 rounded-lg transition-colors"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar"
      >
        {messages.map((m, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "flex gap-4",
              m.role === 'user' ? "ml-auto flex-row-reverse max-w-[80%]" : "max-w-[95%]"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-lg shrink-0 flex items-center justify-center shadow-lg",
              m.role === 'user' ? "bg-bg border border-border" : "bg-accent/20 border border-accent/30"
            )}>
              {m.role === 'user' ? <User size={16} className="text-muted" /> : <Bot size={16} className="text-accent" />}
            </div>
            <div className="space-y-3 flex-1">
              <div className={cn(
                "p-4 rounded-2xl text-[13px] leading-relaxed shadow-sm inline-block",
                m.role === 'user' 
                  ? "bg-accent text-slate-950 font-medium rounded-tr-none float-right" 
                  : "bg-bg border border-border text-fg rounded-tl-none"
              )}>
                {m.type === 'thinking' && (
                  <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-accent uppercase tracking-widest opacity-80">
                    <Brain size={12} /> Deep Thinking Mode
                  </div>
                )}
                <div className="whitespace-pre-wrap">{m.text}</div>
              </div>

              {/* Report Rendering */}
              {m.type === 'report' && m.reportData && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-bg border border-border rounded-xl overflow-hidden shadow-xl mt-4 w-full"
                >
                  <div className="bg-bg2 px-4 py-3 border-b border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TableIcon size={16} className="text-accent" />
                      <h3 className="text-xs font-bold text-fg uppercase tracking-wider">{m.reportData.title}</h3>
                    </div>
                    <button 
                      onClick={() => exportToExcel(m.reportData)}
                      className="flex items-center gap-1.5 px-3 py-1 bg-accent/10 hover:bg-accent/20 text-accent rounded-md text-[10px] font-bold transition-all"
                    >
                      <FileSpreadsheet size={12} /> Export Excel
                    </button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-bg2/50">
                          {m.reportData.headers.map((h, idx) => (
                            <th key={idx} className="px-4 py-3 text-[10px] font-bold text-muted uppercase tracking-wider border-b border-border">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {m.reportData.rows.map((row, rIdx) => (
                          <tr key={rIdx} className="hover:bg-accent/5 transition-colors">
                            {m.reportData!.headers.map((h, cIdx) => (
                              <td key={cIdx} className="px-4 py-3 text-[12px] text-fg border-b border-border/50">
                                {row[h] !== undefined ? row[h] : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        ))}
        {isLoading && (
          <div className="flex gap-4 max-w-[85%]">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/30 flex items-center justify-center animate-pulse">
              <Bot size={16} className="text-accent" />
            </div>
            <div className="bg-bg border border-border p-4 rounded-2xl rounded-tl-none flex items-center gap-3">
              <Loader2 size={16} className="animate-spin text-accent" />
              <span className="text-[12px] text-muted font-medium italic">Gemini is analyzing data and building your report...</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="px-6 py-3 bg-bg/30 border-t border-border flex gap-2 overflow-x-auto no-scrollbar">
        <button 
          onClick={() => handleSend("Generate a report for JCP buyer showing PO, Color, Order Qty, and Poly Qty for all entries.")}
          className="flex items-center gap-2 px-4 py-2 bg-bg border border-border hover:border-accent/50 rounded-full text-[11px] font-bold text-muted hover:text-accent transition-all whitespace-nowrap"
        >
          <TableIcon size={14} /> JCP Report
        </button>
        <button 
          onClick={() => handleSend("Show me a summary of production for the month of April.")}
          className="flex items-center gap-2 px-4 py-2 bg-bg border border-border hover:border-accent/50 rounded-full text-[11px] font-bold text-muted hover:text-accent transition-all whitespace-nowrap"
        >
          <BarChart size={14} /> April Summary
        </button>
        <button 
          onClick={() => handleSend("Which POs have the highest gap between Cutting and Poly?")}
          className="flex items-center gap-2 px-4 py-2 bg-bg border border-border hover:border-accent/50 rounded-full text-[11px] font-bold text-muted hover:text-accent transition-all whitespace-nowrap"
        >
          <AlertTriangle size={14} /> Gap Analysis
        </button>
      </div>

      {/* Input */}
      <div className="p-6 bg-bg2/80 border-t border-border">
        <div className="relative max-w-5xl mx-auto">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask for a report: 'Show me JCP buyer report for April with PO and Poly'..."
            className="w-full bg-bg border border-border focus:border-accent/50 rounded-xl px-5 py-4 pr-14 text-[13px] outline-none transition-all shadow-inner"
          />
          <button 
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={cn(
              "absolute right-2 top-2 bottom-2 w-10 rounded-lg flex items-center justify-center transition-all",
              input.trim() && !isLoading ? "bg-accent text-slate-950 shadow-lg shadow-accent/20" : "bg-bg2 text-muted cursor-not-allowed"
            )}
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
