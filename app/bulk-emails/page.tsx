"use client";

import { useState, useEffect } from "react";
import DateRangePicker from "../components/DateRangePicker";
import * as XLSX from "xlsx";
import Link from "next/link";
import {
  Upload,
  Paperclip,
  Send,
  Loader2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
  FileText,
  Trash2,
  Users,
  Database,
  Info,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  Radio,
  Download,
  Flame,
  Terminal,
  Activity,
  Code,
  Edit3,
  Eye,
  ArrowLeft,
  X,
  Play,
  RefreshCw,
  Calendar,
  Rocket
} from "lucide-react";

const BATCH_SIZE = 8; // Parallel send batching size

export default function BulkEmailsPage() {
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const [loading, setLoading] = useState(false);
  const [sendProgress, setSendProgress] = useState<{
    sent: number;
    total: number;
  }>({ sent: 0, total: 0 });

  const [results, setResults] = useState<
    { email: string; success: boolean; message?: string; skipped?: boolean }[]
  >([]);

  const [error, setError] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [ownerConnected, setOwnerConnected] = useState<boolean | null>(null);
  const [checkingConnection, setCheckingConnection] = useState(true);

  // In-Page Gmail Auto Fetcher States
  const [inPageStartDate, setInPageStartDate] = useState("");
  const [inPageEndDate, setInPageEndDate] = useState("");
  const [inPageFetching, setInPageFetching] = useState(false);
  const [autoLoadedSource, setAutoLoadedSource] = useState(false);
  const [ingestMode, setIngestMode] = useState<"gmail" | "excel">("gmail");

  // Stepper tab state
  const [activeTab, setActiveTab] = useState<
    "upload" | "resume" | "content" | "preview"
  >("upload");

  useEffect(() => {
    checkGmailConnection();

    // Auto-load contacts from sessionStorage if passed from sent-emails page
    try {
      const saved = sessionStorage.getItem("auto_loaded_contacts");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRows(parsed);
          setAutoLoadedSource(true);
          setActiveTab("resume");
        }
      }
    } catch (e) {
      console.error("Failed to read auto_loaded_contacts from sessionStorage:", e);
    }
  }, []);

  const checkGmailConnection = async () => {
    try {
      setCheckingConnection(true);
      const res = await fetch("/api/gmail/status", { cache: "no-store" });
      const data = await res.json();
      setIsConnected(Boolean(data.connected));
      setConnectedEmail(data.email || "");
      setOwnerConnected(Boolean(data.ownerConnected));
    } catch {
      setIsConnected(false);
      setConnectedEmail("");
      setOwnerConnected(null);
    } finally {
      setCheckingConnection(false);
    }
  };

  const fetchContactsInPage = async () => {
    try {
      setInPageFetching(true);
      setError("");

      let pageToken = "";
      let allFetched: any[] = [];
      let page = 1;
      const MAX_PAGES = 5;

      do {
        let url = `/api/gmail/sent-emails?limit=100`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        if (inPageStartDate) url += `&startDate=${inPageStartDate}`;
        if (inPageEndDate) url += `&endDate=${inPageEndDate}`;

        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to fetch contacts from mail logs");

        const newEmails = data.emails || [];
        allFetched = [...allFetched, ...newEmails];

        const nextToken = data.nextPageToken || "";
        pageToken = nextToken;
        page++;

        if (page > MAX_PAGES) break;
        if (pageToken) await new Promise((r) => setTimeout(r, 150));
      } while (pageToken);

      const normalized = allFetched
        .filter((e: any) => e.to && e.to.trim())
        .map((e: any) => ({
          email: e.to.trim(),
          subject: e.subject || "",
          snippet: e.snippet || "",
          date: e.date || "",
        }));

      if (normalized.length === 0) {
        setError("No recipient contacts found in mail logs for selected date range.");
        return;
      }

      setRows(normalized);
      setAutoLoadedSource(true);
      sessionStorage.setItem("auto_loaded_contacts", JSON.stringify(normalized));
      setActiveTab("resume");
    } catch (err: any) {
      setError(err.message || "Failed to fetch contacts from mail logs");
    } finally {
      setInPageFetching(false);
    }
  };

  const clearContacts = () => {
    setRows([]);
    setAutoLoadedSource(false);
    sessionStorage.removeItem("auto_loaded_contacts");
  };

  const connectGmail = () => {
    window.location.href = "/api/auth/google";
  };

  const handleExcelUpload = (file: File | null) => {
    if (!file) return;
    setError("");

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (rawData.length === 0) {
          setError("Excel file is empty.");
          return;
        }

        const firstRow = rawData[0];
        const keys = Object.keys(firstRow);
        const hasEmail = keys.some((k) => k.toLowerCase() === "email");

        if (!hasEmail) {
          setError("Excel file must contain an 'email' column header.");
          return;
        }

        const normalizedData = rawData.map((row) => {
          const newRow: Record<string, any> = {};
          for (const key in row) {
            newRow[key.toLowerCase()] = row[key];
          }
          return newRow;
        });

        setRows(normalizedData);
        setActiveTab("resume");
      } catch (err: any) {
        setError("Failed to parse Excel file: " + err.message);
      }
    };

    reader.readAsBinaryString(file);
  };

  const insertVariable = (tag: string) => {
    setBody((prev) => prev + ` {{${tag}}}`);
  };

  // Compute duplicate email stats
  const excelEmailList = rows.map((r) => r.email).filter(Boolean);
  const excelUniqueCount = new Set(excelEmailList).size;
  const excelDuplicateCount = excelEmailList.length - excelUniqueCount;

  const handleSubmit = async () => {
    try {
      setError("");
      setResults([]);
      setSendProgress({ sent: 0, total: rows.length });

      if (rows.length === 0) {
        setError("Upload an Excel file first.");
        return;
      }
      if (!resume) {
        setError("Please upload your PDF Resume attachment.");
        return;
      }
      if (!subject.trim()) {
        setError("Subject line required.");
        return;
      }
      if (!body.trim()) {
        setError("Email body required.");
        return;
      }

      setLoading(true);
      const totalBatches = Math.ceil(rows.length / BATCH_SIZE);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const start = batchIndex * BATCH_SIZE;
        const batchRows = rows.slice(start, start + BATCH_SIZE);

        const formData = new FormData();
        formData.append("resume", resume);
        formData.append("rows", JSON.stringify(batchRows));
        formData.append("subject", subject);
        formData.append("body", body);

        const res = await fetch("/api/gmail/send-bulk", {
          method: "POST",
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to send bulk emails");
        }

        setResults((prev) => [...prev, ...(data.results || [])]);
        setSendProgress({
          sent: Math.min(start + BATCH_SIZE, rows.length),
          total: rows.length,
        });
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen md:h-screen md:max-h-screen relative overflow-x-hidden md:overflow-hidden bg-[#03050c] text-slate-100 flex flex-col justify-between p-3 sm:p-5">
      {/* Dynamic Background Cyber Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-[24rem] sm:w-[36rem] h-[24rem] sm:h-[36rem] bg-cyan-500/15 rounded-full filter blur-[100px] sm:blur-[140px] animate-aura-1"></div>
        <div className="absolute bottom-10 right-10 w-[28rem] sm:w-[42rem] h-[28rem] sm:h-[42rem] bg-purple-600/15 rounded-full filter blur-[110px] sm:blur-[150px] animate-aura-2"></div>
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,240,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] w-full flex flex-col md:h-full space-y-3">
        {/* Compact Top Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 genz-glass-panel rounded-full text-cyan-300 text-xs font-mono font-bold hover:border-cyan-400 transition-all shadow-md self-start shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>COMMAND STATION</span>
            </Link>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                MASS MAIL
              </span>{" "}
              <span className="genz-glow-cyan font-mono tracking-tighter whitespace-nowrap">
                [ COMMANDER ]
              </span>
            </h1>
          </div>

          {/* Quick Header Actions */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono w-full sm:w-auto">
            {isConnected ? (
              <span className="text-emerald-400 font-bold px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg flex items-center gap-1.5 truncate max-w-[220px] sm:max-w-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="truncate">{connectedEmail ? `AUTH: ${connectedEmail}` : "CONNECTED"}</span>
              </span>
            ) : (
              <button
                onClick={connectGmail}
                className="px-3.5 py-1 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white rounded-lg font-bold shadow-md genz-shimmer-btn"
              >
                Connect Your Account
              </button>
            )}

            <a
              href="/api/sample-file"
              download="SAMPLE.xlsx"
              className="px-3.5 py-1 genz-glass-panel text-emerald-300 border border-emerald-500/40 rounded-lg font-bold flex items-center gap-1.5 hover:bg-emerald-500/20"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>SAMPLE MATRIX</span>
            </a>
          </div>
        </div>

        {error && (
          <div className="p-2.5 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 font-mono text-xs animate-slide-left flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>ERR: {error}</span>
          </div>
        )}

        {/* Gen Z Stepper Navigation Rail */}
        <div className="flex gap-2 overflow-x-auto items-center pb-1.5 custom-scrollbar w-full">
          {[
            { id: "upload", icon: Users, label: "01. LOAD CONTACTS" },
            { id: "resume", icon: Paperclip, label: "02. ATTACHMENT VAULT" },
            { id: "content", icon: Edit3, label: "03. TEMPLATE SYNTAX" },
            { id: "preview", icon: Eye, label: "04. DISPATCH PREVIEW" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-xs font-bold transition-all duration-300 shrink-0 whitespace-nowrap ${activeTab === tab.id
                ? "bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white border border-cyan-400/50 shadow-lg shadow-cyan-500/30 scale-[1.02]"
                : "genz-glass-interactive text-slate-300 hover:text-white"
                }`}
            >
              <tab.icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Scrollable Workstation Container */}
        <div className="flex-1 md:min-h-0 rounded-2xl genz-glass-panel p-4 sm:p-5 border border-white/10 overflow-y-auto custom-scrollbar">
          {activeTab === "upload" && (
            <div className="space-y-4 animate-fade-up">
              {/* Auto-Loaded Status Banner */}
              {autoLoadedSource && rows.length > 0 && (
                <div className="p-3.5 bg-gradient-to-r from-cyan-500/20 via-purple-600/20 to-pink-500/20 border border-cyan-500/40 rounded-2xl flex flex-wrap items-center justify-between gap-3 font-mono text-xs shadow-lg shadow-cyan-950/40">
                  <div className="flex items-center gap-3">
                    <Sparkles className="w-5 h-5 text-cyan-300 animate-pulse shrink-0" />
                    <div>
                      <div className="text-white font-bold flex items-center gap-2">
                        <span>⚡ {rows.length} RECIPIENT CONTACTS AUTO-LOADED FROM LOGS</span>
                      </div>
                      <div className="text-cyan-300/80 text-[11px]">Ready for template composition & campaign execution</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab("resume")}
                      className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-xl flex items-center gap-1.5 shadow-md hover:scale-105 transition-transform"
                    >
                      <span>Proceed to Attachment</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={clearContacts}
                      className="px-2.5 py-1.5 bg-slate-900/80 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 border border-white/10 rounded-xl transition-all flex items-center gap-1 text-[11px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Reset</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Mode Selection Sub-Tabs */}
              <div className="flex items-center gap-2 p-1 bg-slate-950/80 rounded-xl border border-white/10 w-fit text-xs font-mono">
                <button
                  onClick={() => setIngestMode("gmail")}
                  className={`px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 ${ingestMode === "gmail"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <RefreshCw className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Fetch Direct from Mail Logs</span>
                </button>
                <button
                  disabled
                  className="px-3.5 py-1.5 rounded-lg font-bold flex items-center gap-1.5 text-slate-600 opacity-40 cursor-not-allowed bg-slate-900/50"
                  title="Upload Custom Excel File (Disabled)"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-slate-600" />
                  <span>Upload Custom Excel File</span>
                </button>
              </div>

              {ingestMode === "gmail" ? (
                <div className="p-5 genz-glass-panel rounded-2xl border border-cyan-500/30 space-y-4 overflow-visible relative">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400">
                      <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-bold text-white">Fetch by Date Range</h2>
                      <p className="text-slate-400 text-xs font-mono">Pulls Mails</p>
                    </div>
                  </div>

                  <div className="space-y-2 font-mono text-xs">
                    <label className="text-cyan-300 font-bold text-[11px] flex items-center justify-between">
                      <span>SELECT CALENDAR DATE RANGE</span>
                      <span className="text-[10px] text-amber-300 font-medium">⚠️ Max 7 days can be fetched per query</span>
                    </label>
                    <DateRangePicker
                      startDate={inPageStartDate}
                      endDate={inPageEndDate}
                      onChange={(start, end) => {
                        setInPageStartDate(start);
                        setInPageEndDate(end);
                      }}
                      placeholder="Click to pick range (e.g. 1 - 20)"
                    />
                  </div>

                  {/* Compact Right-Aligned Action Button */}
                  <div className="flex justify-end pt-1">
                    {(() => {
                      const isAccountConnected = isConnected || Boolean(connectedEmail);
                      const isDateRangeSelected = Boolean(inPageStartDate && inPageEndDate);
                      const canInPageFetch = isAccountConnected && isDateRangeSelected;
                      return (
                        <button
                          onClick={fetchContactsInPage}
                          disabled={inPageFetching || !canInPageFetch}
                          className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white rounded-xl font-bold font-mono text-xs flex items-center gap-2 shadow-md shadow-cyan-500/20 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105 transition-all genz-shimmer-btn"
                          title={
                            !isAccountConnected
                              ? "Please connect your account first"
                              : !isDateRangeSelected
                              ? "Please select a date range first"
                              : "Fetch contacts"
                          }
                        >
                          {inPageFetching ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin text-cyan-200" />
                              <span>FETCHING MAIL CONTACTS...</span>
                            </>
                          ) : (
                            <>
                              <Rocket className="w-3.5 h-3.5 text-cyan-200" />
                              <span>FETCH & AUTO-LOAD CONTACTS</span>
                            </>
                          )}
                        </button>
                      );
                    })()}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 sm:p-3 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400">
                      <FileSpreadsheet className="w-5 sm:w-6 h-5 sm:h-6" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-white">Excel Data Ingestion</h2>
                      <p className="text-slate-400 text-xs font-mono">
                        Mandatory column: <code className="px-1.5 py-0.5 bg-purple-500/15 text-purple-300 rounded font-bold">email</code>
                      </p>
                    </div>
                  </div>

                  <label className="relative flex flex-col items-center justify-center w-full p-6 sm:p-8 border-2 border-dashed border-purple-500/40 rounded-2xl cursor-pointer hover:border-purple-400 hover:bg-purple-500/5 transition-all bg-slate-950/70 group">
                    <Upload className="w-7 sm:w-8 h-7 sm:h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                    <span className="text-white font-bold text-xs sm:text-sm mb-1 font-mono text-center">
                      DROP EXCEL RECIPIENT FILE HERE
                    </span>
                    <span className="text-slate-400 text-[10px] sm:text-xs font-mono">Supports .xlsx, .xls, .csv</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => handleExcelUpload(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                </div>
              )}

              {rows.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-3 font-mono text-xs">
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 flex items-center gap-2.5">
                    <Database className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-emerald-400/80">TOTAL ROWS</div>
                      <div className="font-bold">{rows.length} records</div>
                    </div>
                  </div>

                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-300 flex items-center gap-2.5">
                    <Users className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-cyan-400/80">UNIQUE RECIPIENTS</div>
                      <div className="font-bold">{excelUniqueCount} contacts</div>
                    </div>
                  </div>

                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 flex items-center gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-[10px] text-amber-400/80">FILE DUPLICATES</div>
                      <div className="font-bold">{excelDuplicateCount} rows</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "resume" && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400">
                  <Paperclip className="w-5 sm:w-6 h-5 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Attachment Vault (PDF Resume)</h2>
                  <p className="text-slate-400 text-xs font-mono">PDF will be attached to every outgoing email</p>
                </div>
              </div>

              <label className="relative flex flex-col items-center justify-center w-full p-6 sm:p-8 border-2 border-dashed border-purple-500/40 rounded-2xl cursor-pointer hover:border-purple-400 hover:bg-purple-500/5 transition-all bg-slate-950/70 group">
                <FileText className="w-7 sm:w-8 h-7 sm:h-8 text-purple-400 mb-2 group-hover:scale-110 transition-transform" />
                <span className="text-white font-bold text-xs sm:text-sm mb-1 font-mono text-center">UPLOAD RESUME PDF ATTACHMENT</span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setResume(f);
                    if (f) setActiveTab("content");
                  }}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>

              {resume && (
                <div className="p-3.5 bg-purple-500/10 border border-purple-500/30 rounded-xl text-purple-300 flex items-center justify-between font-mono text-xs">
                  <div className="flex items-center gap-2 truncate pr-2">
                    <FileText className="w-4 h-4 text-purple-400 shrink-0" />
                    <span className="font-bold text-white truncate">{resume.name}</span>
                    <span className="text-slate-400 shrink-0">({(resume.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <button onClick={() => setResume(null)} className="text-rose-400 hover:text-rose-300 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === "content" && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex items-center gap-3">
                <div className="p-2.5 sm:p-3 bg-pink-500/15 border border-pink-500/30 rounded-xl text-pink-400">
                  <Edit3 className="w-5 sm:w-6 h-5 sm:h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white">Email Subject & Dynamic Template</h2>
                  <p className="text-slate-400 text-xs font-mono">Use variable chips to auto-fill column values from Excel</p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 mb-1">SUBJECT LINE</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="e.g. Application for {{role}} position at {{company}}"
                    className="w-full px-3.5 py-2.5 genz-input rounded-xl text-white text-xs font-mono"
                  />
                </div>

                {/* Variable tag injectors */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-mono font-bold text-slate-300">DYNAMIC VARIABLE TAG INJECTOR</label>
                    <span className="text-[10px] font-mono text-cyan-400">CLICK CHIP TO APPEND</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {["name", "company", "role", "email"].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => insertVariable(tag)}
                        className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl font-mono text-xs font-bold transition-all shadow-md"
                      >
                        +{`{{${tag}}}`}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono font-bold text-slate-300 mb-1">BODY TEMPLATE</label>
                  <textarea
                    rows={5}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder="Hi {{name}}, I am excited to apply for the {{role}} opening at {{company}}..."
                    className="w-full px-3.5 py-2.5 genz-input rounded-xl text-white text-xs font-mono leading-relaxed resize-none"
                  ></textarea>
                </div>

                <button
                  onClick={() => setActiveTab("preview")}
                  className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-md genz-shimmer-btn flex items-center justify-center gap-2"
                >
                  <span>PROCEED TO PREVIEW & DISPATCH</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {activeTab === "preview" && (
            <div className="space-y-4 animate-fade-up">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-white/10 pb-3">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-white font-mono">Dispatch Preview & Execution</h2>
                  <p className="text-slate-400 text-xs font-mono">Verify campaign configuration before sending</p>
                </div>

                {(() => {
                  const isCompleted = results.length > 0 && sendProgress.sent === sendProgress.total;
                  const isBtnDisabled = loading || rows.length === 0 || isCompleted;

                  return (
                    <button
                      onClick={handleSubmit}
                      disabled={isBtnDisabled}
                      className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-emerald-500 via-cyan-500 to-purple-600 text-white rounded-xl text-xs font-mono font-bold uppercase tracking-wider shadow-lg disabled:opacity-40 disabled:cursor-not-allowed genz-shimmer-btn flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      <span>
                        {loading
                          ? "DISPATCHING CAMPAIGN..."
                          : isCompleted
                            ? "DISPATCH COMPLETED"
                            : "START BULK DISPATCH"}
                      </span>
                    </button>
                  );
                })()}
              </div>

              {/* Terminal progress monitor */}
              {(loading || results.length > 0) && (
                <div className="p-3.5 bg-slate-950/90 rounded-xl font-mono text-xs space-y-2 border border-cyan-500/30 shadow-xl">
                  <div className="flex items-center justify-between text-cyan-400 border-b border-cyan-500/20 pb-2">
                    <span className="font-bold flex items-center gap-2 truncate">
                      <Terminal className="w-4 h-4 text-cyan-400 animate-pulse shrink-0" />
                      DISPATCH TERMINAL MONITOR
                    </span>
                    <span className="shrink-0">{sendProgress.sent} / {sendProgress.total} PROCESSED</span>
                  </div>

                  <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/30">
                    <div
                      className="h-full bg-gradient-to-r from-cyan-400 to-pink-500 transition-all duration-300"
                      style={{ width: `${sendProgress.total ? (sendProgress.sent / sendProgress.total) * 100 : 0}%` }}
                    ></div>
                  </div>

                  <div className="max-h-40 overflow-y-auto space-y-1 pt-2 custom-scrollbar text-[11px]">
                    {results.map((res, i) => (
                      <div key={i} className="flex items-center gap-2 truncate">
                        {res.skipped ? (
                          <span className="text-amber-400 font-bold shrink-0">[SKIPPED]</span>
                        ) : res.success ? (
                          <span className="text-emerald-400 font-bold shrink-0">[SENT]</span>
                        ) : (
                          <span className="text-rose-400 font-bold shrink-0">[FAILED]</span>
                        )}
                        <span className="text-white truncate">{res.email}</span>
                        {res.message && <span className="text-slate-400 truncate">({res.message})</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Data Row Table Preview */}
              {rows.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-mono font-bold text-slate-300">PARSED RECIPIENTS ({rows.length} ROWS)</h3>
                  <div className="max-h-48 overflow-y-auto overflow-x-auto border border-white/10 rounded-xl custom-scrollbar">
                    <table className="w-full text-left text-xs font-mono min-w-[500px]">
                      <thead className="bg-slate-950 text-cyan-300 border-b border-white/10 sticky top-0">
                        <tr>
                          <th className="p-2.5">#</th>
                          <th className="p-2.5">Email</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Company</th>
                          <th className="p-2.5">Role</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {rows.map((r, i) => (
                          <tr key={i} className="hover:bg-white/5 text-slate-300">
                            <td className="p-2.5 font-bold text-cyan-400">{i + 1}</td>
                            <td className="p-2.5 text-white">{r.email || "-"}</td>
                            <td className="p-2.5">{r.name || "-"}</td>
                            <td className="p-2.5">{r.company || "-"}</td>
                            <td className="p-2.5">{r.role || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Badge Bar */}
        <div className="text-center pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 genz-glass-panel rounded-full border border-white/10 text-[9px] sm:text-[10px] font-mono text-slate-400">
            <Flame className="w-3 h-3 text-cyan-400" />
            <span className="truncate">POWERED BY HYPER-QUANTUM DISPATCH MATRIX</span>
            <Sparkles className="w-3 h-3 text-purple-400" />
          </div>
        </div>
      </div>
    </div>
  );
}