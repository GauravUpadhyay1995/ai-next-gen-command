"use client";

import { useEffect, useState, useMemo } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import {
  Mail,
  Upload,
  FileText,
  Send,
  CheckCircle,
  AlertCircle,
  Database,
  Users,
  FileSpreadsheet,
  Paperclip,
  Edit3,
  BarChart3,
  MessageSquare,
  Loader2,
  ArrowLeft,
  Eye,
  Flame,
  Rocket,
  Download,
} from "lucide-react";

type ExcelRow = {
  email: string;
  name?: string;
  company?: string;
  role?: string;
  [key: string]: any;
};

type SendResult = {
  email: string;
  success: boolean;
  message: string;
  skipped?: boolean;
  reason?:
  | "invalid_email"
  | "duplicate_in_excel"
  | "already_sent"
  | "send_failed";
};

export default function BulkMailPage() {
  const [rows, setRows] = useState<ExcelRow[]>([]);
  const [resume, setResume] = useState<File | null>(null);
  const [subject, setSubject] = useState("Application for {{role}}");
  const [body, setBody] = useState(
    `Hello {{name}},

I hope you are doing well.

I am interested in the {{role}} opportunity at {{company}}.
Please find my resume attached for your consideration.

Regards,
Gaurav`
  );

  const [loading, setLoading] = useState(false);
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [ownerConnected, setOwnerConnected] = useState<boolean | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [results, setResults] = useState<SendResult[]>([]);
  const [error, setError] = useState("");
  const [previewEmail, setPreviewEmail] = useState<ExcelRow | null>(null);
  const [activeTab, setActiveTab] = useState("upload");

  useEffect(() => {
    checkGmailConnection();

    const style = document.createElement("style");
    style.textContent = `
      @keyframes float {
        0%, 100% { transform: translateY(0px) rotate(0deg); }
        50% { transform: translateY(-20px) rotate(5deg); }
      }
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
      @keyframes slideIn {
        from { opacity: 0; transform: translateX(-30px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-gradient { background-size: 200% 200%; animation: gradientShift 3s ease infinite; }
      .animate-slide-in { animation: slideIn 0.5s ease-out forwards; }
      .animate-fade-up { animation: fadeInUp 0.6s ease-out forwards; }
      .glass-card { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.15); }
      .hover-glow:hover { box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); transform: translateY(-2px); }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  const checkGmailConnection = async () => {
    try {
      setCheckingConnection(true);

      const res = await fetch("/api/gmail/status", {
        cache: "no-store",
      });

      const data = await res.json();
      setIsConnected(Boolean(data.connected));
      setConnectedEmail(data.email || "");
      setOwnerConnected(Boolean(data.ownerConnected));
      setOwnerEmail(data.ownerEmail || "");
    } catch {
      setIsConnected(false);
      setConnectedEmail("");
      setOwnerConnected(null);
      setOwnerEmail("");
    } finally {
      setCheckingConnection(false);
    }
  };

  const connectGmail = () => {
    window.location.href = "/api/auth/google";
  };

  const cleanEmail = (email: any) => {
    return String(email || "")
      .trim()
      .toLowerCase()
      .replace(/[<>"']/g, "");
  };

  const handleExcelUpload = async (file: File | null) => {
    try {
      setError("");
      setRows([]);
      setResults([]);

      if (!file) return;

      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];

      const jsonData = XLSX.utils.sheet_to_json<ExcelRow>(worksheet, {
        defval: "",
      });

      const cleanedRows = jsonData
        .map((row) => {
          const normalized: ExcelRow = {
            email: "",
          };

          Object.keys(row).forEach((key) => {
            normalized[key.trim().toLowerCase()] = row[key];
          });

          return {
            ...normalized,
            email: cleanEmail(normalized.email),
          };
        })
        .filter((row) => row.email && row.email.includes("@"));

      if (cleanedRows.length === 0) {
        setError("Excel file me email column required hai.");
        return;
      }

      setRows(cleanedRows);
      setActiveTab("resume");
    } catch (err: any) {
      setError(err.message || "Failed to read Excel file");
    }
  };

  const sendBulkEmails = async () => {
    try {
      setLoading(true);
      setError("");
      setResults([]);

      if (!isConnected) {
        setError("Gmail connected nahi hai. Pehle Gmail connect karo.");
        return;
      }

      if (rows.length === 0) {
        setError("Please upload Excel file first.");
        return;
      }

      if (!resume) {
        setError("Please upload resume file.");
        return;
      }

      if (!subject.trim()) {
        setError("Subject required hai.");
        return;
      }

      if (!body.trim()) {
        setError("Email body required hai.");
        return;
      }

      const formData = new FormData();
      formData.append("resume", resume);
      formData.append("rows", JSON.stringify(rows));
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

      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const replaceVariables = (text: string, row: ExcelRow) => {
    return text.replace(/{{\s*([^}]+)\s*}}/g, (_, key) => {
      const cleanKey = String(key).trim().toLowerCase();
      return row[cleanKey] ? String(row[cleanKey]) : "";
    });
  };

  const { excelUniqueCount, excelDuplicateCount } = useMemo(() => {
    const unique = new Set(rows.map((row) => cleanEmail(row.email))).size;
    return {
      excelUniqueCount: unique,
      excelDuplicateCount: rows.length - unique,
    };
  }, [rows]);

  const {
    successCount,
    skippedCount,
    failCount,
    alreadySentCount,
    duplicateCount,
    invalidEmailCount,
  } = useMemo(() => {
    return {
      successCount: results.filter((r) => r.success).length,
      skippedCount: results.filter((r) => r.skipped).length,
      failCount: results.filter((r) => !r.success && !r.skipped).length,
      alreadySentCount: results.filter((r) => r.reason === "already_sent").length,
      duplicateCount: results.filter((r) => r.reason === "duplicate_in_excel").length,
      invalidEmailCount: results.filter((r) => r.reason === "invalid_email").length,
    };
  }, [results]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"
          style={{ animationDelay: "4s" }}
        ></div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(139,92,246,0.15) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      <div className="relative z-10 px-4 py-8 mx-auto max-w-7xl">
        <div className="mb-8 text-center animate-fade-up">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 mb-6 glass-card rounded-full border border-purple-500/30">
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            <span className="text-sm font-semibold text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
              BULK EMAIL MASTERY
            </span>
            <Rocket className="w-4 h-4 text-purple-400" />
          </div>

          <h1 className="text-6xl md:text-7xl font-black mb-4 tracking-tighter">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
              Mass Mail
            </span>
            <br />
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent animate-gradient">
              Commander
            </span>
          </h1>

          <p className="text-xl text-purple-200 max-w-2xl mx-auto">
            Send only unique emails and automatically skip already-sent recipients.
          </p>
        </div>

        <div className="mb-6 animate-slide-in space-y-3">
          {checkingConnection ? (
            <div className="flex items-center gap-3 p-4 glass-card rounded-xl">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <span className="text-purple-200">
                Checking Gmail connection...
              </span>
            </div>
          ) : (
            <>
              {isConnected ? (
                <div className="flex items-center justify-between p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5" />
                    <span className="font-medium text-sm">
                      Logged in as {connectedEmail}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-3 text-red-300">
                    <AlertCircle className="w-5 h-5" />
                    <span>Gmail not connected</span>
                  </div>

                  <button
                    onClick={connectGmail}
                    className="px-5 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white font-medium hover:shadow-xl transition-all"
                  >
                    Connect Now
                  </button>
                </div>
              )}

              {ownerConnected === false && (
                <div className="flex items-center gap-3 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 text-xs animate-slide-in">
                  <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>
                    Owner Gmail is not connected. Duplicate checking and bulk campaigns will fail.
                  </span>
                </div>
              )}

              {ownerConnected === true && (
                <div className="flex items-center gap-3 p-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 text-xs animate-slide-in">
                  <CheckCircle className="w-4 h-4 text-purple-400 shrink-0" />
                  <span>
                    Campaigns will send and check duplicates via: <strong> {connectedEmail}</strong>
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 animate-slide-in flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex gap-2 mb-6 overflow-x-auto items-center">
          {[
            { id: "upload", icon: Upload, label: "Upload Data" },
            { id: "resume", icon: Paperclip, label: "Attachments" },
            { id: "content", icon: Edit3, label: "Email Content" },
            { id: "preview", icon: Eye, label: "Preview & Send" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium transition-all ${activeTab === tab.id
                ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg"
                : "glass-card text-purple-200 hover:bg-white/10"
                }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}

          <a
            href="/api/sample-file"
            download="SAMPLE.xlsx"
            className="ml-auto flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all glass-card text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/20 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20 whitespace-nowrap"
          >
            <Download className="w-4 h-4" />
            Download Sample File
          </a>
        </div>

        <div className="space-y-6">
          {activeTab === "upload" && (
            <div className="glass-card rounded-2xl p-8 animate-fade-up hover-glow transition-all">
              <div className="flex items-center gap-3 mb-4">
                <FileSpreadsheet className="w-8 h-8 text-purple-400" />
                <h2 className="text-2xl font-bold text-white">
                  Upload Excel File
                </h2>
              </div>

              <p className="text-purple-200 mb-4">
                Excel must contain{" "}
                <code className="px-2 py-1 bg-white/10 rounded">email</code>{" "}
                column. Optional: name, company, role.
              </p>

              <label className="relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-purple-500/50 rounded-xl cursor-pointer hover:border-purple-400 transition-all bg-white/5">
                <Upload className="w-12 h-12 text-purple-400 mb-3" />
                <span className="text-purple-200">
                  Click to upload Excel file
                </span>

                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(e) =>
                    handleExcelUpload(e.target.files?.[0] || null)
                  }
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>

              {rows.length > 0 && (
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="p-3 bg-emerald-500/20 rounded-lg text-emerald-300">
                    <div className="flex items-center gap-2">
                      <Database className="w-4 h-4" />
                      <span className="font-medium">
                        Total loaded: {rows.length}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-blue-500/20 rounded-lg text-blue-300">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      <span className="font-medium">
                        Unique in Excel: {excelUniqueCount}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-yellow-500/20 rounded-lg text-yellow-300">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">
                        Duplicates in Excel: {excelDuplicateCount}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "resume" && (
            <div className="glass-card rounded-2xl p-8 animate-fade-up hover-glow transition-all">
              <div className="flex items-center gap-3 mb-4">
                <Paperclip className="w-8 h-8 text-pink-400" />
                <h2 className="text-2xl font-bold text-white">
                  Upload Resume
                </h2>
              </div>

              <p className="text-purple-200 mb-4">
                Attach your resume PDF, DOC, or DOCX. It will be sent with every
                new email.
              </p>

              <label className="relative flex flex-col items-center justify-center w-full p-8 border-2 border-dashed border-pink-500/50 rounded-xl cursor-pointer hover:border-pink-400 transition-all bg-white/5">
                <FileText className="w-12 h-12 text-pink-400 mb-3" />
                <span className="text-purple-200">Click to upload resume</span>

                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={(e) => setResume(e.target.files?.[0] || null)}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>

              {resume && (
                <div className="mt-4 p-3 bg-emerald-500/20 rounded-lg">
                  <div className="flex items-center gap-2 text-emerald-300">
                    <CheckCircle className="w-4 h-4" />
                    <span className="font-medium">
                      Resume attached: {resume.name}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "content" && (
            <div className="glass-card rounded-2xl p-8 animate-fade-up hover-glow transition-all">
              <div className="flex items-center gap-3 mb-4">
                <Edit3 className="w-8 h-8 text-orange-400" />
                <h2 className="text-2xl font-bold text-white">
                  Dynamic Email Content
                </h2>
              </div>

              <p className="text-purple-200 mb-4">
                Use variables like{" "}
                <code className="px-2 py-1 bg-white/10 rounded">
                  {"{{name}}"}
                </code>
                ,{" "}
                <code className="px-2 py-1 bg-white/10 rounded">
                  {"{{company}}"}
                </code>
                ,{" "}
                <code className="px-2 py-1 bg-white/10 rounded">
                  {"{{role}}"}
                </code>{" "}
                from Excel.
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Subject Line
                  </label>

                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-purple-500"
                    placeholder="Application for {{role}}"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-purple-200 mb-2">
                    Email Body
                  </label>

                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    rows={12}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:border-purple-500 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "preview" && rows.length > 0 && (
            <div className="glass-card rounded-2xl p-8 animate-fade-up hover-glow transition-all">
              <div className="flex items-center gap-3 mb-4">
                <Eye className="w-8 h-8 text-indigo-400" />
                <h2 className="text-2xl font-bold text-white">
                  Preview & Send
                </h2>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-purple-200 mb-2">
                  Preview for recipient:
                </label>

                <select
                  onChange={(e) =>
                    setPreviewEmail(rows[Number(e.target.value)])
                  }
                  className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                  defaultValue=""
                >
                  <option className="text-black" value="">
                    Select a recipient to preview
                  </option>

                  {rows.map((row, idx) => (
                    <option className="text-black" key={idx} value={idx}>
                      {row.email} - {row.name || "No name"}
                    </option>
                  ))}
                </select>
              </div>

              {previewEmail && (
                <div className="mt-4 p-4 bg-black/30 rounded-lg border border-white/10">
                  <div className="text-sm text-purple-300 mb-2">
                    Subject: {replaceVariables(subject, previewEmail)}
                  </div>

                  <div className="whitespace-pre-wrap text-white/80 text-sm">
                    {replaceVariables(body, previewEmail)}
                  </div>
                </div>
              )}

              <div className="mt-5 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-yellow-200 text-sm">
                Before sending, system will check:
                <br />
                1. Duplicate emails inside Excel
                <br />
                2. Already sent emails in Gmail Sent folder
                <br />
                Only new unique emails will be sent.
              </div>

              <button
                onClick={sendBulkEmails}
                disabled={
                  loading ||
                  !isConnected ||
                  rows.length === 0 ||
                  !resume ||
                  !subject.trim() ||
                  !body.trim()
                }
                className="mt-6 w-full flex items-center justify-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 transition-all duration-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Checking & Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-5 h-5" />
                    Send Only New Unique Emails ({excelUniqueCount})
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        {rows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 animate-fade-up">
            <div className="glass-card rounded-xl p-4 text-center">
              <Users className="w-6 h-6 text-purple-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">{rows.length}</p>
              <p className="text-xs text-purple-300">Total Rows</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center">
              <Database className="w-6 h-6 text-blue-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {excelUniqueCount}
              </p>
              <p className="text-xs text-purple-300">Unique Emails</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center">
              <FileText className="w-6 h-6 text-pink-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {resume ? 1 : 0}
              </p>
              <p className="text-xs text-purple-300">Attachments</p>
            </div>

            <div className="glass-card rounded-xl p-4 text-center">
              <BarChart3 className="w-6 h-6 text-indigo-400 mx-auto mb-2" />
              <p className="text-2xl font-bold text-white">
                {excelDuplicateCount}
              </p>
              <p className="text-xs text-purple-300">Excel Duplicates</p>
            </div>
          </div>
        )}

        {results.length > 0 && (
          <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-up">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Send className="w-6 h-6 text-purple-400" />
                <h2 className="text-xl font-bold text-white">
                  Sending Results
                </h2>
              </div>

              <div className="flex gap-2 flex-wrap">
                <div className="px-3 py-1 bg-emerald-500/20 rounded-lg text-emerald-300 text-sm">
                  ✅ Sent: {successCount}
                </div>

                <div className="px-3 py-1 bg-yellow-500/20 rounded-lg text-yellow-300 text-sm">
                  ⏭️ Skipped: {skippedCount}
                </div>

                <div className="px-3 py-1 bg-blue-500/20 rounded-lg text-blue-300 text-sm">
                  📩 Already Sent: {alreadySentCount}
                </div>

                <div className="px-3 py-1 bg-purple-500/20 rounded-lg text-purple-300 text-sm">
                  🔁 Duplicate: {duplicateCount}
                </div>

                <div className="px-3 py-1 bg-orange-500/20 rounded-lg text-orange-300 text-sm">
                  ⚠️ Invalid: {invalidEmailCount}
                </div>

                <div className="px-3 py-1 bg-red-500/20 rounded-lg text-red-300 text-sm">
                  ❌ Failed: {failCount}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Message
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {results.map((result, idx) => (
                    <tr
                      key={`${result.email}-${idx}`}
                      className="border-t border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-white/60">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3 text-sm text-white">
                        {result.email}
                      </td>

                      <td className="px-4 py-3 text-sm">
                        {result.success ? (
                          <span className="text-emerald-400">✓ Sent</span>
                        ) : result.skipped ? (
                          <span className="text-yellow-400">⏭ Skipped</span>
                        ) : (
                          <span className="text-red-400">✗ Failed</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-white/60">
                        {result.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length > 0 && activeTab !== "preview" && (
          <div className="mt-6 glass-card rounded-2xl p-6 animate-fade-up">
            <div className="flex items-center gap-3 mb-4">
              <Database className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-bold text-white">
                Recipients List
              </h2>
            </div>

            <div className="overflow-x-auto max-h-80">
              <table className="w-full">
                <thead className="bg-white/5 sticky top-0">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      #
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Email
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Company
                    </th>
                    <th className="px-4 py-3 text-left text-sm text-purple-300">
                      Role
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {rows.slice(0, 10).map((row, idx) => (
                    <tr
                      key={`${row.email}-${idx}`}
                      className="border-t border-white/10 hover:bg-white/5 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-white/60">
                        {idx + 1}
                      </td>

                      <td className="px-4 py-3 text-sm text-white">
                        {row.email}
                      </td>

                      <td className="px-4 py-3 text-sm text-white/80">
                        {row.name || "-"}
                      </td>

                      <td className="px-4 py-3 text-sm text-white/80">
                        {row.company || "-"}
                      </td>

                      <td className="px-4 py-3 text-sm text-white/80">
                        {row.role || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {rows.length > 10 && (
                <p className="text-center text-white/40 text-sm mt-3">
                  + {rows.length - 10} more recipients
                </p>
              )}
            </div>
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/sent-emails"
            className="inline-flex items-center gap-2 px-6 py-3 glass-card rounded-full hover:bg-white/10 transition-all"
          >
            <ArrowLeft className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/80">
              Back to Sent Emails
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}