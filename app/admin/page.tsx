"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  ShieldCheck,
  Users,
  UserPlus,
  UserCheck,
  UserX,
  Trash2,
  Lock,
  ArrowLeft,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  RefreshCw,
  Crown,
  Sparkles,
  KeyRound,
  Clock,
  Briefcase,
  FileText,
  Copy,
  Check,
  Play,
  Send,
  Database,
  Terminal,
  ExternalLink,
  ChevronRight,
  PauseCircle,
  PlayCircle,
  ShieldAlert,
  LogIn,
  Zap,
  Download,
  BarChart3,
  Flame,
  Activity,
  FileSpreadsheet,
  Mail,
  X
} from "lucide-react";

type CustomerProfile = {
  _id?: string;
  name: string;
  email: string;
  role: string;
  experience: string;
  location: string;
  dailyLimit: number;
  customerCategory?: "job_seeker" | "b2b_lead_finder" | "all";
  resumeName?: string;
  resumeBase64?: string;
  resumeMimeType?: string;
  encryptedRefreshToken?: string;
  encryptedAppPassword?: string;
  authMethod?: "app_password" | "oauth" | "both";
  status: "pending_auth" | "active" | "paused" | "blocked";
  connectToken: string;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  totalSentCount: number;
  notes?: string;
};

type SentHistoryLog = {
  _id: string;
  customerEmail: string;
  customerName?: string;
  recipientEmail: string;
  company?: string;
  role?: string;
  subject?: string;
  aiPitch?: string;
  dispatchedAt: string;
  dateString?: string;
  status?: string;
};

type QueuedJob = {
  _id?: string;
  dateString: string;
  email: string;
  company: string;
  role: string;
  location: string;
  snippet: string;
  sourceUrl: string;
  sourceType: string;
  postedDate?: string;
  mxValid: boolean;
  mxDetails?: string;
  dispatchedTo: string[];
  fetchedAt: string;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"customers" | "crons" | "analytics" | "queue" | "settings">("customers");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminEmail, setSuperAdminEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // System Settings State
  const [allowCustomerLogin, setAllowCustomerLogin] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  // Customer Management States
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState("Software Engineer");
  const [formExperience, setFormExperience] = useState("1-3 Years");
  const [formLocation, setFormLocation] = useState("Remote");
  const [formDailyLimit, setFormDailyLimit] = useState(20);
  const [formCustomerCategory, setFormCustomerCategory] = useState<"job_seeker" | "b2b_lead_finder" | "all">("job_seeker");
  const [formAppPassword, setFormAppPassword] = useState("");
  const [showAppPass, setShowAppPass] = useState(false);
  const [formNotes, setFormNotes] = useState("");
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  // 1-Click Launch Modal & Real-time Logs
  const [launchingOutreachEmail, setLaunchingOutreachEmail] = useState<string | null>(null);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [liveLaunchLogs, setLiveLaunchLogs] = useState<string[]>([]);
  const [launchSummary, setLaunchSummary] = useState<any>(null);

  // Cron Simulator States
  const [cronRunning2am, setCronRunning2am] = useState(false);
  const [cronRunning9am, setCronRunning9am] = useState(false);
  const [logs2am, setLogs2am] = useState<string[]>([]);
  const [logs9am, setLogs9am] = useState<string[]>([]);
  const [customScrapeRole, setCustomScrapeRole] = useState("");
  const [simulateOnly9am, setSimulateOnly9am] = useState(false);
  const [selectedCustomerFor9am, setSelectedCustomerFor9am] = useState("");

  // Sent History States
  const [sentHistory, setSentHistory] = useState<SentHistoryLog[]>([]);
  const [loadingSentHistory, setLoadingSentHistory] = useState(false);
  const [sentHistorySearch, setSentHistorySearch] = useState("");
  const [sentStats, setSentStats] = useState({ totalSent: 0, uniqueRecipients: 0, uniqueCompanies: 0 });

  // Queue Inspector States
  const [queuedJobs, setQueuedJobs] = useState<QueuedJob[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      setLoading(true);
      setError("");

      // 1. Fetch Superadmin & Status
      const whitelistRes = await fetch("/api/admin/users", { cache: "no-store" });
      const whitelistData = await whitelistRes.json();
      if (!whitelistRes.ok) {
        if (whitelistRes.status === 403) {
          setIsSuperAdmin(false);
          throw new Error("Access Denied: You must be logged in as the Superadmin (OWNER_EMAIL) to view this console.");
        }
      } else {
        setIsSuperAdmin(true);
        setSuperAdminEmail(whitelistData.superAdminEmail || "");
      }

      // 2. Fetch Customers
      const custRes = await fetch("/api/admin/customers", { cache: "no-store" });
      const custData = await custRes.json();
      if (custRes.ok) {
        setCustomers(custData.customers || []);
      }

      // 3. Fetch System Settings
      const setRes = await fetch("/api/admin/settings", { cache: "no-store" });
      const setData = await setRes.json();
      if (setRes.ok && setData.settings) {
        setAllowCustomerLogin(Boolean(setData.settings.allowCustomerLogin));
      }

      // 4. Fetch Queue & Sent History
      fetchQueue();
      fetchSentHistory();
    } catch (err: any) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const fetchSentHistory = async () => {
    try {
      setLoadingSentHistory(true);
      const res = await fetch("/api/admin/sent-history", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.logs) {
        setSentHistory(data.logs);
        if (data.stats) setSentStats(data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch sent history:", err);
    } finally {
      setLoadingSentHistory(false);
    }
  };

  const fetchQueue = async () => {
    try {
      setLoadingQueue(true);
      const res = await fetch("/api/admin/queue", { cache: "no-store" });
      const data = await res.json();
      if (res.ok && data.jobs) {
        setQueuedJobs(data.jobs);
      }
    } catch (err) {
      console.error("Failed to fetch jobs queue:", err);
    } finally {
      setLoadingQueue(false);
    }
  };

  const handle1ClickLaunch = async (customerEmail?: string, simulateOnly: boolean = false) => {
    try {
      setLaunchingOutreachEmail(customerEmail || "ALL");
      setLiveLaunchLogs([
        `[${new Date().toLocaleTimeString()}] 🚀 Initializing 1-Click Auto-Pilot Dispatcher...`,
        `[${new Date().toLocaleTimeString()}] Target: ${customerEmail ? `Candidate "${customerEmail}"` : "ALL Active Candidates"}`,
        `[${new Date().toLocaleTimeString()}] Mode: ${simulateOnly ? "SIMULATION (No emails sent)" : "LIVE DISPATCH (Google SMTP:465 SSL)"}`,
        `[${new Date().toLocaleTimeString()}] Checking live matching jobs across Naukri, Indeed, LinkedIn, Remote streams...`,
      ]);
      setLaunchSummary(null);
      setLaunchModalOpen(true);

      const res = await fetch("/api/admin/outreach/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerEmail, simulateOnly }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Outreach execution failed");
      }

      setLiveLaunchLogs(data.logs || []);
      setLaunchSummary(data);
      setSuccessMsg(`✅ 1-Click Outreach Finished! Dispatched: ${data.totalEmailsDispatched} emails across candidates.`);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Outreach dispatch failed");
      setLiveLaunchLogs((prev) => [...prev, `[FATAL ERROR] ${err.message}`]);
    } finally {
      setLaunchingOutreachEmail(null);
    }
  };

  const exportSentHistoryToExcel = () => {
    if (sentHistory.length === 0) return;
    const exportData = sentHistory.map((item, idx) => ({
      "SL No": idx + 1,
      "Candidate Name": item.customerName || "-",
      "Candidate Email": item.customerEmail || "-",
      "Recipient HR Email": item.recipientEmail || "-",
      "Target Company": item.company || "-",
      "Target Role": item.role || "-",
      "Email Subject": item.subject || "-",
      "AI Personalized Pitch": item.aiPitch || "-",
      "Dispatched Date": item.dateString || (item.dispatchedAt ? new Date(item.dispatchedAt).toLocaleDateString() : "-"),
      "Dispatched Time": item.dispatchedAt ? new Date(item.dispatchedAt).toLocaleTimeString() : "-",
      "Status": item.status || "sent",
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sent Outreach Telemetry");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const dataBlob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(dataBlob, `CANDIDATE_OUTREACH_REPORT_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handleToggleCustomerLogin = async (enable: boolean) => {
    try {
      setSavingSettings(true);
      setError("");
      setSuccessMsg("");

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowCustomerLogin: enable }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update access control setting");
      }

      setAllowCustomerLogin(enable);
      setSuccessMsg(
        enable
          ? "🟢 Customer Login ENABLED. Candidates can log in to view their sent logs."
          : "🔒 Customer Login DISABLED (Superadmin Only Mode). Customers cannot login; only Superadmin has console access."
      );
    } catch (err: any) {
      setError(err.message || "Could not update setting.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formEmail.trim()) {
      setError("Candidate email is required.");
      return;
    }

    try {
      setCreatingCustomer(true);
      setError("");
      setSuccessMsg("");

      const formData = new FormData();
      formData.append("name", formName.trim() || "Candidate");
      formData.append("email", formEmail.trim().toLowerCase());
      formData.append("role", formRole.trim());
      formData.append("experience", formExperience);
      formData.append("location", formLocation.trim());
      formData.append("dailyLimit", String(formDailyLimit));
      formData.append("customerCategory", formCustomerCategory);
      formData.append("googleAppPassword", formAppPassword.trim());
      formData.append("notes", formNotes.trim());
      if (resumeFile) {
        formData.append("resume", resumeFile);
      }

      const res = await fetch("/api/admin/customers", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to create candidate profile");
      }

      const candidateName = data.customer?.name || data.profile?.name || formName || "Candidate";
      setSuccessMsg(
        formAppPassword.trim()
          ? `🎉 Candidate "${candidateName}" created and ACTIVATED with Google App Password!`
          : `🎉 Candidate profile "${candidateName}" registered! Share the 1-time connect link to activate.`
      );

      // Reset Form
      setFormName("");
      setFormEmail("");
      setFormRole("Software Engineer");
      setFormExperience("1-3 Years");
      setFormLocation("Remote");
      setFormDailyLimit(20);
      setFormCustomerCategory("job_seeker");
      setFormAppPassword("");
      setFormNotes("");
      setResumeFile(null);

      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to create candidate profile.");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const handleToggleCustomerStatus = async (email: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === "active" ? "paused" : "active";
      const res = await fetch("/api/admin/customers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, status: newStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Candidate ${email} status changed to "${newStatus.toUpperCase()}"`);
        loadAllData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCustomer = async (email: string) => {
    if (!confirm(`Are you sure you want to permanently delete candidate profile "${email}"?`)) return;
    try {
      const res = await fetch(`/api/admin/customers?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Customer ${email} deleted.`);
        loadAllData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const copyConnectLink = (token: string) => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const link = `${origin}/connect/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 3000);
  };

  const runSimulator2am = async () => {
    try {
      setCronRunning2am(true);
      setLogs2am([`[${new Date().toLocaleTimeString()}] Triggering Live Lead Scraper across 20 Streams...`]);
      const res = await fetch("/api/cron/fetch-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ forceRole: customScrapeRole || undefined }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server error (${res.status})`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Scraper execution failed");
      }
      setLogs2am(data.data?.logs || data.logs || []);
      setSuccessMsg(`✅ Scraper Queued ${data.data?.insertedCount || 0} fresh jobs!`);
      fetchQueue();
    } catch (err: any) {
      setLogs2am((prev) => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setCronRunning2am(false);
    }
  };

  const runSimulator9am = async () => {
    try {
      setCronRunning9am(true);
      setLogs9am([`[${new Date().toLocaleTimeString()}] Triggering Batch Email Dispatcher...`]);
      const res = await fetch("/api/cron/dispatch-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: selectedCustomerFor9am || undefined,
          simulateOnly: simulateOnly9am,
        }),
      });
      const text = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text || `Server error (${res.status})`);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Email dispatch failed");
      }
      setLogs9am(data.data?.logs || data.logs || []);
      setSuccessMsg(`✅ Batch Finished! Dispatched: ${data.data?.totalEmailsDispatched || 0}`);
      loadAllData();
    } catch (err: any) {
      setLogs9am((prev) => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setCronRunning9am(false);
    }
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers;
    const q = customerSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredSentHistory = useMemo(() => {
    if (!sentHistorySearch.trim()) return sentHistory;
    const q = sentHistorySearch.toLowerCase();
    return sentHistory.filter(
      (item) =>
        item.customerEmail?.toLowerCase().includes(q) ||
        item.recipientEmail?.toLowerCase().includes(q) ||
        item.company?.toLowerCase().includes(q) ||
        item.role?.toLowerCase().includes(q) ||
        item.subject?.toLowerCase().includes(q)
    );
  }, [sentHistory, sentHistorySearch]);

  const filteredQueue = useMemo(() => {
    if (!queueSearch.trim()) return queuedJobs;
    const q = queueSearch.toLowerCase();
    return queuedJobs.filter(
      (j) =>
        j.email.toLowerCase().includes(q) ||
        j.company.toLowerCase().includes(q) ||
        j.role.toLowerCase().includes(q) ||
        j.snippet.toLowerCase().includes(q)
    );
  }, [queuedJobs, queueSearch]);

  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === "active").length;
    const pending = customers.filter((c) => c.status === "pending_auth").length;
    const totalSent = customers.reduce((acc, c) => acc + (c.totalSentCount || 0), 0);
    return { total, active, pending, totalSent };
  }, [customers]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#03050c] text-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 className="w-10 h-10 text-purple-400 animate-spin mb-4" />
        <p className="font-mono text-xs text-slate-400">Authenticating Superadmin Autopilot Console...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#03050c] text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-mono">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 w-[30rem] h-[30rem] bg-rose-500/10 rounded-full filter blur-[140px] animate-aura-1"></div>
          <div className="absolute bottom-10 right-10 w-[36rem] h-[36rem] bg-purple-600/15 rounded-full filter blur-[150px] animate-aura-2"></div>
        </div>

        <div className="relative z-10 max-w-xl mx-auto w-full my-auto space-y-5 animate-fade-up">
          <div className="genz-glass-panel rounded-3xl p-6 sm:p-8 border border-rose-500/40 text-center space-y-5 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/40 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-950/50">
              <Crown className="w-8 h-8 text-amber-400" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 border border-rose-500/30 rounded-full text-rose-300 text-[10px] font-bold tracking-widest uppercase">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>RESTRICTED • SUPERADMIN LOGIN REQUIRED</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                SUPERADMIN CONSOLE LOCKED
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm leading-relaxed">
                This console contains sensitive candidate credentials, automated cron dispatchers, and global security switches. You must log in as the Superadmin to access this console.
              </p>
            </div>

            <div className="p-3.5 bg-black/60 rounded-xl border border-white/10 text-left text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Superadmin Access Only:</span>
              </div>
              <p className="text-[11px] pl-5 text-slate-400">• Registered owner email: <strong className="text-white">rupamsi007@gmail.com / OWNER_EMAIL</strong></p>
              <p className="text-[11px] pl-5 text-slate-400">• Customer and guest logins are strictly disabled without authorization</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => (window.location.href = "/api/auth/google")}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 hover:scale-[1.02] text-white font-bold text-xs rounded-xl shadow-xl shadow-purple-950/50 genz-shimmer-btn flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>LOGIN AS SUPERADMIN (GOOGLE OAUTH)</span>
              </button>
              <Link
                href="/"
                className="px-5 py-3 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Return to Station</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#03050c] text-slate-100 flex flex-col p-3 sm:p-5 relative overflow-x-hidden">
      {/* Background Glows */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-[28rem] h-[28rem] bg-purple-600/15 rounded-full filter blur-[120px] animate-aura-1"></div>
        <div className="absolute bottom-10 right-10 w-[32rem] h-[32rem] bg-cyan-600/15 rounded-full filter blur-[130px] animate-aura-2"></div>
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(168,85,247,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] w-full flex flex-col space-y-4">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 genz-glass-panel rounded-full text-purple-300 text-xs font-mono font-bold hover:border-purple-400 transition-all shadow-md self-start shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
              <span>COMMAND STATION</span>
            </Link>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-white via-purple-100 to-slate-300 bg-clip-text text-transparent">
                SUPERADMIN
              </span>{" "}
              <span className="genz-glow-purple font-mono tracking-tighter whitespace-nowrap text-purple-400">
                [ 1-CLICK AUTOPILOT COCKPIT ]
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
            {/* Master 1-Click Batch Button */}
            <button
              onClick={() => handle1ClickLaunch(undefined, false)}
              disabled={launchingOutreachEmail !== null}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 hover:scale-[1.03] text-white font-mono font-bold text-xs rounded-xl shadow-xl shadow-purple-950/50 genz-shimmer-btn flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40"
              title="Instantly execute outreach for all active candidates"
            >
              <Zap className="w-4 h-4 text-amber-300 fill-amber-300" />
              <span>🚀 1-CLICK LAUNCH ALL CANDIDATES</span>
            </button>

            {superAdminEmail && (
              <span className="px-3 py-1.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-300 font-bold flex items-center gap-1.5 truncate max-w-[240px]">
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="truncate">{superAdminEmail}</span>
              </span>
            )}
            <button
              onClick={loadAllData}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-slate-300 flex items-center gap-1 font-bold"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/15 border border-rose-500/40 rounded-xl text-rose-300 font-mono text-xs flex items-center gap-2 animate-slide-left">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 font-mono text-xs flex items-center gap-2 animate-slide-left">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Telemetry Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-fade-up">
          <div className="genz-glass-panel rounded-xl p-3 border border-purple-500/30 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">CANDIDATE PROFILES</p>
              <p className="text-xl font-mono font-black text-white">{stats.total}</p>
            </div>
            <Users className="w-5 h-5 text-purple-400" />
          </div>

          <div className="genz-glass-panel rounded-xl p-3 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">ACTIVE CANDIDATES</p>
              <p className="text-xl font-mono font-black text-emerald-400">{stats.active}</p>
            </div>
            <UserCheck className="w-5 h-5 text-emerald-400" />
          </div>

          <div className="genz-glass-panel rounded-xl p-3 border border-cyan-500/30 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">TOTAL SENT OUTREACH</p>
              <p className="text-xl font-mono font-black text-cyan-300">{sentStats.totalSent || stats.totalSent}</p>
            </div>
            <Send className="w-5 h-5 text-cyan-400" />
          </div>

          <div className="genz-glass-panel rounded-xl p-3 border border-amber-500/30 flex items-center justify-between">
            <div>
              <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">LIVE QUEUED JOBS</p>
              <p className="text-xl font-mono font-black text-amber-300">{queuedJobs.length}</p>
            </div>
            <Database className="w-5 h-5 text-amber-400" />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-white/10 pb-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "customers"
                ? "bg-purple-600/30 border border-purple-500/50 text-white shadow-lg shadow-purple-900/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Briefcase className="w-4 h-4 text-purple-400" />
            <span>1. Candidates & 1-Click Launchers ({customers.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("crons")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "crons"
                ? "bg-purple-600/30 border border-purple-500/50 text-white shadow-lg shadow-purple-900/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Play className="w-4 h-4 text-amber-400" />
            <span>2. Master Auto-Pilot & Batch Engines</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "analytics"
                ? "bg-purple-600/30 border border-purple-500/50 text-white shadow-lg shadow-purple-900/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>3. Sent History & Analytics ({sentHistory.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "queue"
                ? "bg-purple-600/30 border border-purple-500/50 text-white shadow-lg shadow-purple-900/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>4. Multi-Portal Live Job Radar ({queuedJobs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "settings"
                ? "bg-purple-600/30 border border-purple-500/50 text-white shadow-lg shadow-purple-900/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
          >
            <Lock className="w-4 h-4 text-pink-400" />
            <span>5. System Settings & Access Control</span>
          </button>
        </div>

        {/* TAB 1: CANDIDATES & 1-CLICK LAUNCHERS */}
        {activeTab === "customers" && (
          <div className="space-y-4 animate-fade-up">
            {/* Create Candidate Form */}
            <div className="genz-glass-panel rounded-2xl p-4 sm:p-5 border border-purple-500/30">
              <div className="text-xs font-mono font-bold text-purple-300 flex items-center gap-2 mb-3">
                <UserPlus className="w-4 h-4 text-purple-400" />
                <span>REGISTER NEW CANDIDATE AUTOPILOT PROFILE</span>
              </div>

              <form onSubmit={handleCreateCustomer} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">CANDIDATE NAME</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Gaurav Upadhyay"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">CANDIDATE GMAIL</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. gaurav@gmail.com"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">TARGET JOB ROLE</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. React / Full Stack Developer"
                      value={formRole}
                      onChange={(e) => setFormRole(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">EXPERIENCE LEVEL</label>
                    <select
                      value={formExperience}
                      onChange={(e) => setFormExperience(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono bg-slate-900"
                    >
                      <option value="Fresher">Fresher (0 Years)</option>
                      <option value="1-3 Years">1-3 Years Experience</option>
                      <option value="3-5 Years">3-5 Years Experience</option>
                      <option value="5+ Years">5+ Years Senior</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">TARGET LOCATION</label>
                    <input
                      type="text"
                      placeholder="e.g. Remote, India, USA"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">DAILY EMAIL QUOTA</label>
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={formDailyLimit}
                      onChange={(e) => setFormDailyLimit(Number(e.target.value))}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">CANDIDATE CATEGORY</label>
                    <select
                      value={formCustomerCategory}
                      onChange={(e) => setFormCustomerCategory(e.target.value as any)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono bg-slate-900"
                    >
                      <option value="job_seeker">🧑‍💻 Job Seeker (Multi-Portal Outreach)</option>
                      <option value="b2b_lead_finder">🏢 B2B Client Outreach</option>
                      <option value="all">🌟 Dual Access (All Channels)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">UPLOAD RESUME (PDF)</label>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                      className="w-full text-xs font-mono text-slate-300 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600/30 file:text-purple-300 hover:file:bg-purple-600/50 cursor-pointer"
                    />
                  </div>
                </div>

                {/* Google App Password Box */}
                <div className="p-3.5 bg-gradient-to-r from-amber-950/30 via-slate-900/60 to-purple-950/30 rounded-xl border border-amber-500/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                      <span>GOOGLE 16-DIGIT APP PASSWORD (RECOMMENDED FOR INSTANT 1-CLICK SEND)</span>
                    </label>
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 underline"
                    >
                      <span>Generate from Google</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  <div className="relative">
                    <input
                      type={showAppPass ? "text" : "password"}
                      placeholder="e.g. abcd efgh ijkl mnop (16-digit Google App Password)"
                      value={formAppPassword}
                      onChange={(e) => setFormAppPassword(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-amber-200 text-xs font-mono pr-20 tracking-wider placeholder:text-slate-600 bg-black/40 border-amber-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAppPass(!showAppPass)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-mono px-2 py-0.5 rounded bg-white/10 hover:bg-white/20 text-slate-300 cursor-pointer"
                    >
                      {showAppPass ? "Hide" : "Show"}
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">
                    ⚡ Candidate ka 16-digit App Password enter karne se candidate instantly 🟢 ACTIVE ho jayega aur 1-Click Launch se seedhe unke Gmail se live outreach send hoga!
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
                  <div className="text-[11px] text-slate-400 font-mono">
                    💡 App Password daalne par instant active ho jayega. Agar khali chhodenge toh candidate ko 1-time link bhej kar connect karwa sakte hain.
                  </div>

                  <button
                    type="submit"
                    disabled={creatingCustomer || !formEmail.trim()}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg genz-shimmer-btn flex items-center justify-center gap-2 disabled:opacity-40 shrink-0 cursor-pointer"
                  >
                    {creatingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                    <span>Create & Activate Profile</span>
                  </button>
                </div>
              </form>
            </div>

            {/* Candidates Profiles Cards Vault */}
            <div className="genz-glass-panel rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <Users className="w-4 h-4 text-purple-400" />
                  <span>CANDIDATE PROFILES & 1-CLICK LAUNCHERS ({filteredCustomers.length})</span>
                </div>

                <div className="relative min-w-[260px]">
                  <input
                    type="text"
                    placeholder="Search candidate name, email, role..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3 py-1.5 genz-input rounded-xl text-white text-xs font-mono pl-8"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-purple-400" />
                </div>
              </div>

              <div className="space-y-3">
                {filteredCustomers.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-mono text-xs">
                    No candidate profiles registered yet. Fill out the form above to add your first customer.
                  </div>
                ) : (
                  filteredCustomers.map((c, idx) => {
                    const isCandidateActive = c.status === "active";
                    const isLaunching = launchingOutreachEmail === c.email || launchingOutreachEmail === "ALL";

                    return (
                      <div
                        key={c.email}
                        className="genz-glass-interactive rounded-xl p-4 border border-white/10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 font-mono text-xs shadow-lg hover:border-purple-500/40 transition-all"
                      >
                        <div className="space-y-2 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap text-[11px]">
                            <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 rounded text-purple-300 font-bold">
                              #{idx + 1}
                            </span>
                            <span className="font-bold text-white text-sm">{c.name}</span>
                            <span className="text-slate-400">({c.email})</span>

                            {/* Category Badge */}
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              c.customerCategory === "b2b_lead_finder"
                                ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                                : c.customerCategory === "all"
                                ? "bg-cyan-500/15 text-cyan-300 border-cyan-500/30"
                                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                            }`}>
                              {c.customerCategory === "b2b_lead_finder" ? "🏢 B2B Leads" : c.customerCategory === "all" ? "🌟 Dual Access" : "🧑‍💻 Job Seeker"}
                            </span>

                            {c.encryptedAppPassword ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 flex items-center gap-1 font-bold text-[10px]">
                                <KeyRound className="w-3 h-3 text-amber-400" />
                                🟢 ACTIVE (App Password)
                              </span>
                            ) : c.encryptedRefreshToken ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/20 border border-emerald-500/40 rounded-full text-emerald-300 flex items-center gap-1 font-bold text-[10px]">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                🟢 ACTIVE (OAuth 2.0)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-amber-500/20 border border-amber-500/40 rounded-full text-amber-300 flex items-center gap-1 font-bold text-[10px]">
                                <Clock className="w-3 h-3 text-amber-400" />
                                🟡 PENDING 1-TIME AUTH
                              </span>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-300 pt-1">
                            <div>
                              <span className="text-slate-500 block text-[9px]">TARGET ROLE</span>
                              <span className="font-semibold text-purple-300">{c.role}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">EXPERIENCE & LOC</span>
                              <span className="font-semibold text-cyan-300">{c.experience} • {c.location}</span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">PDF RESUME</span>
                              <span className="font-semibold text-emerald-400 truncate block">
                                {c.resumeName ? `📄 ${c.resumeName}` : "⚠️ No Resume"}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-500 block text-[9px]">DAILY TARGET</span>
                              <span className="font-semibold text-white">
                                {c.totalSentCount || 0} sent ({c.dailyLimit || 20}/day)
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* 1-Click Launch Button & Actions */}
                        <div className="flex flex-wrap items-center gap-2 self-start lg:self-center shrink-0">
                          <button
                            onClick={() => handle1ClickLaunch(c.email, false)}
                            disabled={!isCandidateActive || isLaunching}
                            className="px-4 py-2 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-500 hover:scale-[1.03] text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-cyan-950/50 genz-shimmer-btn flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Auto-match live jobs from Naukri, Indeed, LinkedIn and send tailored emails with resume"
                          >
                            {isLaunching ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                            )}
                            <span>⚡ Launch Today&apos;s Outreach ({c.dailyLimit || 20} Mails)</span>
                          </button>

                          <button
                            onClick={() => copyConnectLink(c.connectToken)}
                            className="p-2 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 border border-indigo-500/30 text-indigo-300 font-bold transition-all shadow"
                            title="Copy 1-Time Onboarding Link"
                          >
                            {copiedToken === c.connectToken ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleToggleCustomerStatus(c.email, c.status)}
                            className={`p-2 rounded-lg font-bold border transition-all ${
                              c.status === "active"
                                ? "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/40 text-amber-300"
                                : "bg-emerald-500/15 hover:bg-emerald-500/25 border-emerald-500/40 text-emerald-300"
                            }`}
                            title={c.status === "active" ? "Pause Candidate" : "Activate Candidate"}
                          >
                            {c.status === "active" ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            onClick={() => handleDeleteCustomer(c.email)}
                            className="p-2 bg-slate-900 hover:bg-rose-500/20 border border-white/10 text-slate-400 hover:text-rose-400 rounded-lg transition-all cursor-pointer"
                            title="Delete Profile"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MASTER AUTOPILOT & CRON ENGINES */}
        {activeTab === "crons" && (
          <div className="space-y-4 animate-fade-up">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phase 1: Night Scraper */}
              <div className="genz-glass-panel rounded-2xl p-5 border border-cyan-500/30 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>PHASE 1: MULTI-PORTAL JOB HARVESTER (2:00 AM)</span>
                    </span>
                    <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 rounded text-[10px] font-mono">
                      20 STREAMS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono leading-relaxed">
                    Scrapes live hiring posts across <strong>Naukri, Indeed, LinkedIn, WorkIndia, RemoteOK, Jobicy</strong>, verifies DNS MX host records, and inserts fresh leads into the daily queue.
                  </p>

                  <div className="pt-2">
                    <label className="text-[10px] font-mono text-slate-400 block mb-1">OVERRIDE SEARCH ROLE (OPTIONAL)</label>
                    <input
                      type="text"
                      placeholder="e.g. React Developer, Node.js"
                      value={customScrapeRole}
                      onChange={(e) => setCustomScrapeRole(e.target.value)}
                      className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={runSimulator2am}
                    disabled={cronRunning2am}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg genz-shimmer-btn flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {cronRunning2am ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span>Run Phase 1 Job Harvester Now</span>
                  </button>

                  <div className="p-3 bg-black/60 rounded-xl border border-white/10 font-mono text-[11px] h-36 overflow-y-auto custom-scrollbar text-slate-300 space-y-1">
                    <div className="text-slate-500 text-[10px] border-b border-white/10 pb-1">LIVE LOG STREAM:</div>
                    {logs2am.length === 0 ? (
                      <span className="text-slate-600 italic">No execution logs yet. Click button to run.</span>
                    ) : (
                      logs2am.map((l, i) => <div key={i}>{l}</div>)
                    )}
                  </div>
                </div>
              </div>

              {/* Phase 2: Morning Dispatcher */}
              <div className="genz-glass-panel rounded-2xl p-5 border border-purple-500/30 space-y-4 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-purple-300 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-purple-400" />
                      <span>PHASE 2: MORNING EMAIL OUTREACH (9:00 AM)</span>
                    </span>
                    <span className="px-2 py-0.5 bg-purple-500/15 border border-purple-500/30 text-purple-300 rounded text-[10px] font-mono">
                      DIRECT SMTP
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono leading-relaxed">
                    Matches candidate profiles with today&apos;s scraped jobs, creates <strong>AI-personalized pitch emails</strong>, attaches stored <strong>PDF resumes</strong>, and dispatches via <strong>Google App Password (SMTP SSL)</strong>.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">TARGET CANDIDATE</label>
                      <select
                        value={selectedCustomerFor9am}
                        onChange={(e) => setSelectedCustomerFor9am(e.target.value)}
                        className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono bg-slate-900"
                      >
                        <option value="">All Active Candidates ({stats.active})</option>
                        {customers.filter((c) => c.status === "active").map((c) => (
                          <option key={c.email} value={c.email}>{c.name} ({c.email})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end pb-1">
                      <label className="flex items-center gap-2 text-xs font-mono text-amber-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={simulateOnly9am}
                          onChange={(e) => setSimulateOnly9am(e.target.checked)}
                          className="w-4 h-4 accent-amber-400 rounded"
                        />
                        <span>Simulate Only (Dry Run)</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-3 pt-2">
                  <button
                    onClick={runSimulator9am}
                    disabled={cronRunning9am}
                    className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg genz-shimmer-btn flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
                  >
                    {cronRunning9am ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span>{simulateOnly9am ? "Run Dry Simulation" : "Execute Morning Email Dispatcher Now"}</span>
                  </button>

                  <div className="p-3 bg-black/60 rounded-xl border border-white/10 font-mono text-[11px] h-36 overflow-y-auto custom-scrollbar text-slate-300 space-y-1">
                    <div className="text-slate-500 text-[10px] border-b border-white/10 pb-1">LIVE LOG STREAM:</div>
                    {logs9am.length === 0 ? (
                      <span className="text-slate-600 italic">No execution logs yet. Click button to run.</span>
                    ) : (
                      logs9am.map((l, i) => <div key={i}>{l}</div>)
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: SENT HISTORY & ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="space-y-4 animate-fade-up">
            {/* Analytics Header Bar */}
            <div className="genz-glass-panel rounded-2xl p-4 sm:p-5 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-emerald-300 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>SENT OUTREACH TELEMETRY & DELIVERABILITY AUDIT</span>
                </div>
                <p className="text-xs text-slate-400 font-mono mt-1">
                  Total Dispatched: <strong className="text-white">{sentStats.totalSent || sentHistory.length}</strong> • Unique HR Leads: <strong className="text-cyan-300">{sentStats.uniqueRecipients}</strong> • Unique Companies: <strong className="text-purple-300">{sentStats.uniqueCompanies}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={fetchSentHistory}
                  disabled={loadingSentHistory}
                  className="px-3.5 py-2 genz-glass-panel border border-white/10 text-slate-300 rounded-xl font-mono text-xs font-bold flex items-center gap-1.5 hover:bg-white/10"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSentHistory ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={exportSentHistoryToExcel}
                  disabled={sentHistory.length === 0}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white rounded-xl font-mono text-xs font-bold flex items-center gap-2 shadow-lg shadow-emerald-950/40 cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel Report (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Sent Table */}
            <div className="genz-glass-panel rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="text-xs font-mono text-slate-400 flex items-center gap-2">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>DISPATCHED OUTREACH LOGS ({filteredSentHistory.length})</span>
                </div>

                <div className="relative min-w-[280px]">
                  <input
                    type="text"
                    placeholder="Search recipient, company, candidate, role..."
                    value={sentHistorySearch}
                    onChange={(e) => setSentHistorySearch(e.target.value)}
                    className="w-full px-3 py-1.5 genz-input rounded-xl text-white text-xs font-mono pl-8"
                  />
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-emerald-400" />
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">CANDIDATE</th>
                      <th className="py-2.5 px-3">RECIPIENT HR / LEAD</th>
                      <th className="py-2.5 px-3">COMPANY & ROLE</th>
                      <th className="py-2.5 px-3">EMAIL SUBJECT</th>
                      <th className="py-2.5 px-3">TIME</th>
                      <th className="py-2.5 px-3">STATUS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filteredSentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                          No sent outreach records found yet. Run 1-Click Launch or Morning Dispatcher to populate history.
                        </td>
                      </tr>
                    ) : (
                      filteredSentHistory.map((item) => (
                        <tr key={item._id} className="hover:bg-white/5 transition-all">
                          <td className="py-2.5 px-3 font-semibold text-purple-300">
                            <div>{item.customerName || "Candidate"}</div>
                            <div className="text-[10px] text-slate-500">{item.customerEmail}</div>
                          </td>
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">{item.recipientEmail}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-white font-semibold">{item.company || "Hiring Team"}</span>
                            <span className="block text-[10px] text-slate-400">{item.role || "Target Role"}</span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[280px] truncate text-slate-300" title={item.subject}>
                            {item.subject || "Job Application"}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {item.dispatchedAt ? new Date(item.dispatchedAt).toLocaleString() : item.dateString || "-"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded text-[10px] font-bold">
                              ✓ SENT (SMTP)
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: QUEUED JOBS RADAR */}
        {activeTab === "queue" && (
          <div className="space-y-4 animate-fade-up">
            <div className="genz-glass-panel rounded-2xl p-4 sm:p-5 border border-cyan-500/30 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-mono font-bold text-cyan-300 flex items-center gap-2">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>DAILY JOBS QUEUE RADAR ({queuedJobs.length} JOBS AVAILABLE)</span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    Live verified jobs ready to be dispatched during candidate outreach.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative min-w-[240px]">
                    <input
                      type="text"
                      placeholder="Search queue role, company..."
                      value={queueSearch}
                      onChange={(e) => setQueueSearch(e.target.value)}
                      className="w-full px-3 py-1.5 genz-input rounded-xl text-white text-xs font-mono pl-8"
                    />
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400" />
                  </div>
                  <button
                    onClick={fetchQueue}
                    className="p-2 bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 text-slate-300"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar max-h-[450px]">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="sticky top-0 bg-slate-950 text-slate-400 border-b border-white/10">
                    <tr>
                      <th className="py-2.5 px-3">ROLE & TITLE</th>
                      <th className="py-2.5 px-3">COMPANY</th>
                      <th className="py-2.5 px-3">VERIFIED EMAIL</th>
                      <th className="py-2.5 px-3">LOCATION</th>
                      <th className="py-2.5 px-3">SOURCE</th>
                      <th className="py-2.5 px-3">DISPATCHED TO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {filteredQueue.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                          No jobs in today&apos;s queue. Click &ldquo;Run Phase 1 Job Harvester&rdquo; in Tab 2 to populate live leads.
                        </td>
                      </tr>
                    ) : (
                      filteredQueue.map((job, idx) => (
                        <tr key={idx} className="hover:bg-white/5 transition-all">
                          <td className="py-2.5 px-3 font-semibold text-white">{job.role}</td>
                          <td className="py-2.5 px-3 text-purple-300">{job.company}</td>
                          <td className="py-2.5 px-3 text-cyan-300 font-bold">{job.email}</td>
                          <td className="py-2.5 px-3 text-slate-400">{job.location}</td>
                          <td className="py-2.5 px-3 text-[10px] text-slate-500 uppercase">{job.sourceType}</td>
                          <td className="py-2.5 px-3">
                            {job.dispatchedTo && job.dispatchedTo.length > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded text-[10px]">
                                {job.dispatchedTo.length} Candidate(s)
                              </span>
                            ) : (
                              <span className="text-slate-600 text-[10px]">Pending</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: SYSTEM SETTINGS */}
        {activeTab === "settings" && (
          <div className="space-y-4 animate-fade-up">
            <div className="genz-glass-panel rounded-2xl p-5 border border-pink-500/30 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/30 flex items-center justify-center text-pink-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">GLOBAL ACCESS SECURITY SWITCH</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Control whether candidate logins are enabled or restricted exclusively to Superadmin.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-black/60 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-mono text-xs">
                    <span className="font-bold text-white">CUSTOMER LOGIN STATUS:</span>
                    {allowCustomerLogin ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded text-[10px] font-bold">
                        🟢 ENABLED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-500/20 text-rose-300 border border-rose-500/40 rounded text-[10px] font-bold">
                        🔒 DISABLED (SUPERADMIN ONLY)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    {allowCustomerLogin
                      ? "Customers can log in with Google OAuth to track their sent email history."
                      : "Customer logins are blocked. Only the Superadmin can log in. All outreach runs via Superadmin Autopilot."}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleCustomerLogin(!allowCustomerLogin)}
                  disabled={savingSettings}
                  className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all shadow-xl flex items-center gap-2 cursor-pointer ${
                    allowCustomerLogin
                      ? "bg-rose-600 hover:bg-rose-500 text-white shadow-rose-950/50"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-950/50"
                  }`}
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>{allowCustomerLogin ? "Disable Customer Login" : "Enable Customer Login"}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 1-CLICK LAUNCH REAL-TIME LOGS MODAL */}
      {launchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="genz-glass-panel max-w-2xl w-full rounded-3xl p-6 border border-purple-500/40 shadow-2xl space-y-4 animate-fade-up relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/30 text-purple-300">
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white font-mono">1-CLICK AUTOPILOT OUTREACH ENGINE</h3>
                  <p className="text-[10px] text-slate-400 font-mono">Real-time live multi-portal scraping & SMTP dispatching</p>
                </div>
              </div>

              <button
                onClick={() => setLaunchModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Terminal Logs Window */}
            <div className="p-4 bg-black/80 rounded-2xl border border-white/10 font-mono text-xs h-64 overflow-y-auto custom-scrollbar text-slate-300 space-y-1.5 shadow-inner">
              <div className="text-purple-400 text-[10px] font-bold border-b border-white/10 pb-1 flex items-center justify-between">
                <span>LIVE TELEMETRY STREAM:</span>
                {launchingOutreachEmail && <span className="text-amber-400 animate-pulse">PROCESSING...</span>}
              </div>
              {liveLaunchLogs.map((log, i) => (
                <div key={i} className="leading-relaxed">
                  {log.includes("✅") ? (
                    <span className="text-emerald-400 font-semibold">{log}</span>
                  ) : log.includes("❌") || log.includes("ERROR") ? (
                    <span className="text-rose-400 font-semibold">{log}</span>
                  ) : log.includes("⚡") ? (
                    <span className="text-cyan-300 font-semibold">{log}</span>
                  ) : (
                    log
                  )}
                </div>
              ))}
            </div>

            {/* Summary Footer */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs font-mono text-slate-400">
                {launchSummary ? (
                  <span className="text-emerald-300 font-bold">
                    ✓ Total Dispatched: {launchSummary.totalEmailsDispatched} emails ({launchSummary.totalCustomers} Candidate Profiles)
                  </span>
                ) : (
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Outreach pipeline in progress...</span>
                  </span>
                )}
              </div>

              <button
                onClick={() => setLaunchModalOpen(false)}
                className="px-5 py-2.5 bg-gradient-to-r from-purple-600 to-cyan-500 hover:opacity-90 text-white font-mono font-bold text-xs rounded-xl shadow-lg cursor-pointer"
              >
                Done / Close Stream
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
