import React, { useState, useEffect } from 'react';
import { FileUp, FileSpreadsheet, Trash2, Calendar, User, Search, X, Loader2, Database, Layers } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as XLSX from 'xlsx';
import { db, auth, addAuditLog } from '../firebase';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { ExcelFile } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

export default function ExcelLibrary() {
  const [files, setFiles] = useState<ExcelFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Fetch files from Firestore
  useEffect(() => {
    const q = query(collection(db, 'excel_files'), orderBy('uploadedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const filesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ExcelFile));
      setFiles(filesData);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | null = null;
    if ('files' in e && e.files) {
      file = e.files[0];
    } else if (e.target && (e.target as HTMLInputElement).files) {
      file = (e.target as HTMLInputElement).files![0];
    }

    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        
        const allSheets: Record<string, any[]> = {};
        let totalRows = 0;
        
        wb.SheetNames.forEach(name => {
          const ws = wb.Sheets[name];
          // Get raw data as 2D array (header: 1)
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });
          
          if (rows.length === 0) return;

          // Keywords to look for in potential header rows
          const keywords = [
            'po', 'color', 'style', 'buyer', 'qty', 'date', 
            'cut', 'sew', 'wash', 'fin', 'poly', 'ship', 'line'
          ];

          // Find the header row (scan first 10 rows)
          let headerRowIdx = 0;
          let maxMatches = 0;

          for (let i = 0; i < Math.min(10, rows.length); i++) {
            const row = rows[i];
            if (!Array.isArray(row)) continue;
            
            let matches = 0;
            row.forEach(cell => {
              if (typeof cell === 'string') {
                const lowerCell = cell.toLowerCase().replace(/[^a-z]/g, '');
                if (keywords.some(k => lowerCell.includes(k))) {
                  matches++;
                }
              }
            });

            if (matches > maxMatches) {
              maxMatches = matches;
              headerRowIdx = i;
            }
          }

          // If we found a better header row, convert to objects using that row
          const header = rows[headerRowIdx];
          const data = rows.slice(headerRowIdx + 1).map(row => {
            const obj: any = {};
            header.forEach((key: any, idx: number) => {
              if (key !== undefined && key !== null) {
                obj[String(key)] = row[idx];
              }
            });
            return obj;
          }).filter(obj => Object.values(obj).some(v => v !== undefined && v !== null && v !== ''));

          if (data.length > 0) {
            allSheets[name] = data;
            totalRows += data.length;
          }
        });

        if (totalRows === 0) {
          throw new Error("Excel file is empty");
        }

        // Store in Firestore
        const fileData: Omit<ExcelFile, 'id'> = {
          fileName: file!.name,
          uploadedAt: new Date().toISOString(),
          uploadedBy: auth.currentUser?.email || 'Unknown',
          rowCount: totalRows,
          content: JSON.stringify(allSheets)
        };

        await addDoc(collection(db, 'excel_files'), fileData);
        await addAuditLog('UPLOAD', 'EXCEL', `Uploaded ${file!.name} with ${totalRows} rows across ${Object.keys(allSheets).length} sheets`, '/excel-library');
        
        setIsUploadModalOpen(false);
        setLoading(false);
      };
      reader.readAsBinaryString(file);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Failed to upload file. Please ensure it is a valid Excel file.");
      setLoading(false);
    }
  };

  const deleteFile = async (fileId: string, fileName: string) => {
    console.log("Commencing purge protocol for:", fileId, fileName);
    if (!fileId) {
      alert("System Critical Error: File ID is undefined. Library corrupted.");
      return;
    }
    
    setLoading(true);
    try {
      const fileRef = doc(db, 'excel_files', fileId);
      await deleteDoc(fileRef);
      await addAuditLog('DELETE', 'EXCEL', `Deleted Excel file: ${fileName}`, '/excel-library');
      setDeleteConfirmId(null);
      // Removed standard alert to prioritize UI flow
    } catch (error: any) {
      console.error("Purge failure:", error);
      alert(`ACCESS DENIED or SYSTEM ERROR: ${error.message || "Unknown anomaly"}`);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter(f => 
    f.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    f.uploadedBy.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 no-print">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2 text-fg">
            <FileSpreadsheet size={20} className="text-accent" />
            Excel Library
          </h2>
          <p className="text-[11px] text-muted">Manage your uploaded Excel reports for data collection</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={14} />
            <input
              type="text"
              placeholder="Search files..."
              className="fi pl-10 h-10 rounded-xl text-xs"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button 
            className="btn btn-p h-10 px-4 gap-2 rounded-xl"
            onClick={() => setIsUploadModalOpen(true)}
          >
            <FileUp size={16} /> <span>Upload New Excel</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {filteredFiles.map((file) => (
            <motion.div
              key={file.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-bg2/40 backdrop-blur-xl border border-border/50 rounded-2xl p-5 hover:border-accent/30 transition-all group relative overflow-hidden"
            >
              <div className="absolute top-2 right-2 z-[100]">
                <button 
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteConfirmId(file.id);
                    setDeleteConfirmName(file.fileName);
                  }}
                  className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all border border-white/20 flex items-center justify-center shadow-xl active:scale-90"
                  title="Remove Library Asset"
                >
                  <Trash2 size={20} />
                </button>
              </div>

              <div className="flex items-start gap-4 pr-10">
                <div className="w-12 h-12 bg-accent/10 rounded-xl flex items-center justify-center text-accent shrink-0">
                  <Database size={24} />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold truncate pr-8 text-fg" title={file.fileName}>
                    {file.fileName}
                  </h3>
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-muted">
                      <Layers size={12} />
                      <span className="text-[10px] font-black uppercase tracking-wider">{file.rowCount} Data Rows</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <Calendar size={12} />
                      <span className="text-[10px] uppercase tracking-wider">{format(new Date(file.uploadedAt), 'dd MMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted">
                      <User size={12} />
                      <span className="text-[10px] uppercase tracking-wider truncate">{file.uploadedBy}</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredFiles.length === 0 && !loading && (
          <div className="col-span-full py-20 bg-bg2/20 border border-dashed border-border/50 rounded-3xl flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center mb-4 text-muted/30">
              <FileSpreadsheet size={32} />
            </div>
            <h3 className="text-lg font-bold text-muted">No Excel Files Available</h3>
            <p className="text-sm text-muted/60 mt-2 max-w-xs mx-auto">
              {searchTerm ? "No files match your search criteria" : "Upload your Excel production reports to start collecting data from them"}
            </p>
            {!searchTerm && (
              <button 
                onClick={() => setIsUploadModalOpen(true)}
                className="mt-6 text-accent font-black text-[11px] uppercase tracking-widest hover:underline"
              >
                Upload File Now
              </button>
            )}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <div className="fixed inset-0 z-[5000] flex items-start justify-center p-4 overflow-y-auto pt-20 pb-20 no-scrollbar">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => !loading && setIsUploadModalOpen(false)}
              className="fixed inset-0 bg-black/95 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 40 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 40 }}
              className="relative w-full max-w-md bg-card border border-white/20 rounded-[2.5rem] shadow-3xl z-50 mb-auto"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-fg tracking-tighter">DATA INGESTION</h3>
                    <p className="text-[10px] text-muted font-bold uppercase tracking-[0.2em] opacity-80">Library Protocol: EN-X24</p>
                  </div>
                  <button 
                    onClick={() => setIsUploadModalOpen(false)} 
                    className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 text-muted hover:text-fg hover:bg-white/10 transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div 
                  className={cn(
                    "relative border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center text-center transition-all",
                    dragActive ? "border-accent bg-accent/5" : "border-border/50 hover:border-accent/30 bg-white/5",
                    loading && "opacity-50 pointer-events-none"
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e); }}
                >
                  {loading ? (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 size={40} className="text-accent animate-spin" />
                      <p className="text-sm font-bold text-fg">Parsing Knowledge Engine...</p>
                    </div>
                  ) : (
                    <>
                      <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-4 text-accent">
                        <FileUp size={32} />
                      </div>
                      <p className="text-sm font-bold text-fg mb-1">Drag and Drop File Here</p>
                      <p className="text-[11px] text-muted mb-6">Support files: .xls, .xlsx, .csv</p>
                      
                      <div className="relative">
                        <input 
                          type="file" 
                          id="file-upload" 
                          className="hidden" 
                          accept=".xlsx, .xls, .csv" 
                          onChange={handleFileUpload} 
                        />
                        <label 
                          htmlFor="file-upload" 
                          className="btn btn-p cursor-pointer rounded-xl px-8 h-12 flex items-center justify-center"
                        >
                          Select Local File
                        </label>
                      </div>
                    </>
                  )}
                </div>

                <div className="mt-8 p-4 bg-accent/5 rounded-xl border border-accent/20">
                  <h4 className="text-[10px] font-black text-accent uppercase tracking-widest mb-2">Integration Protocol</h4>
                  <p className="text-[11px] text-muted leading-relaxed">
                    Once uploaded, you can use the <span className="text-accent font-bold">"Collect from Excel"</span> button in Orders or Entry sections to fetch data automatically using the file's header columns.
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirmId && (
          <div className="fixed inset-0 z-[6000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmId(null)}
              className="fixed inset-0 bg-black/95 backdrop-blur-xl"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-sm bg-card border border-red-500/30 rounded-[2.5rem] p-8 shadow-3xl text-center z-50"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center text-red-500 mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-black text-fg tracking-tighter mb-2 uppercase">ERASE ASSET?</h3>
              <p className="text-xs text-muted leading-relaxed font-bold uppercase tracking-widest opacity-80 mb-8">
                Confirming will permanently remove <span className="text-red-500">{deleteConfirmName}</span> from the core repository.
              </p>
              
              <div className="flex gap-3 mt-4">
                <button 
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 h-12 bg-white/5 text-muted font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-white/10 transition-all"
                >
                  Abort
                </button>
                <button 
                  onClick={() => deleteFile(deleteConfirmId, deleteConfirmName)}
                  disabled={loading}
                  className="flex-1 h-12 bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
                >
                  {loading ? "Erase In Progress..." : "Confirm Erase"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
