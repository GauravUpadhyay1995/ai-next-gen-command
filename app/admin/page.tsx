"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  ShieldCheck,
  Users,
  UserPlus,
  UserCheck,
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
  Copy,
  Check,
  Play,
  Send,
  Database,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Zap,
  Download,
  BarChart3,
  Activity,
  Mail,
  X,
  Target,
  FileText,
  Sliders,
  ChevronRight,
  Filter,
  CheckCircle,
  Settings,
  HelpCircle,
  Building2,
  Eye,
  EyeOff,
  Pencil,
  ShieldAlert
} from "lucide-react";
import DbLeadsSection from "./components/DbLeadsSection";

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
  appPassword?: string;
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
  score?: number;
  dispatchedTo: string[];
  fetchedAt: string;
};

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"customers" | "dbleads" | "crons" | "analytics" | "queue" | "settings">("customers");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [superAdminEmail, setSuperAdminEmail] = useState("");
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // System Settings State
  const [allowCustomerLogin, setAllowCustomerLogin] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [emailsPerMinute, setEmailsPerMinute] = useState<number>(10);
  const [rateInput, setRateInput] = useState<string>("10");
  const [savingRateLimit, setSavingRateLimit] = useState<boolean>(false);

  // Customer Management States
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStatusFilter, setCustomerStatusFilter] = useState<"all" | "active" | "pending" | "paused">("all");
  
  // Add Candidate Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [authMethodChoice, setAuthMethodChoice] = useState<"app_password" | "link">("app_password");
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
  const [lastTargetEmail, setLastTargetEmail] = useState<string | null>(null);
  const [launchModalOpen, setLaunchModalOpen] = useState(false);
  const [liveLaunchLogs, setLiveLaunchLogs] = useState<string[]>([]);
  const [launchSummary, setLaunchSummary] = useState<any>(null);

  // Edit Raw App Password Modal State
  const [editingPasswordCust, setEditingPasswordCust] = useState<CustomerProfile | null>(null);
  const [editAppPasswordInput, setEditAppPasswordInput] = useState("");
  const [showEditAppPass, setShowEditAppPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Full Candidate Edit Modal State (all creation fields)
  const [editingCustomer, setEditingCustomer] = useState<CustomerProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("Software Engineer");
  const [editExperience, setEditExperience] = useState("1-3 Years");
  const [editLocation, setEditLocation] = useState("Remote");
  const [editDailyLimit, setEditDailyLimit] = useState(20);
  const [editCustomerCategory, setEditCustomerCategory] = useState<"job_seeker" | "b2b_lead_finder" | "all">("job_seeker");
  const [editAuthMethod, setEditAuthMethod] = useState<"app_password" | "link">("app_password");
  const [editCustomerAppPassword, setEditCustomerAppPassword] = useState("");
  const [showEditCustomerPass, setShowEditCustomerPass] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<"active" | "paused" | "pending_auth" | "blocked">("active");
  const [editResumeFile, setEditResumeFile] = useState<File | null>(null);
  const [savingEditCustomer, setSavingEditCustomer] = useState(false);

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
  const [scanningBounces, setScanningBounces] = useState(false);
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
        const rate = Number(setData.settings.emailsPerMinute) || 10;
        setEmailsPerMinute(rate);
        setRateInput(String(rate));
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

  const handleScanBounces = async () => {
    try {
      setScanningBounces(true);
      setError("");
      setSuccessMsg("");
      const res = await fetch("/api/admin/outreach/bounces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Bounce check failed");
      }
      setSuccessMsg(
        `🛡️ Bounce Scan Complete: Scanned ${data.data?.scannedAccounts || 0} mailboxes, flagged ${data.data?.newBouncesFlagged || 0} dead email bounces.`
      );
      fetchSentHistory();
    } catch (err: any) {
      setError(err.message || "Failed to scan bounces.");
    } finally {
      setScanningBounces(false);
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
      setLastTargetEmail(customerEmail || "ALL");
      setLaunchingOutreachEmail(customerEmail || "ALL");
      setLiveLaunchLogs([
        `[${new Date().toLocaleTimeString()}] 🚀 Initializing Auto-Pilot Dispatcher...`,
        `[${new Date().toLocaleTimeString()}] Target: ${customerEmail ? `Candidate "${customerEmail}"` : "ALL Active Candidates"}`,
        `[${new Date().toLocaleTimeString()}] Mode: ${simulateOnly ? "SIMULATION (No emails sent)" : "LIVE DISPATCH (Google SMTP:465 SSL)"}`,
        `[${new Date().toLocaleTimeString()}] Verifying active jobs across multi-portal stream...`,
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
      setSuccessMsg(`✅ Outreach Completed! Dispatched: ${data.totalEmailsDispatched} emails.`);
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sent Outreach History");
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
          ? "🟢 Candidate Login Enabled. Candidates can log in to view their sent logs."
          : "🔒 Candidate Login Disabled. Restricted to SuperAdmin only."
      );
    } catch (err: any) {
      setError(err.message || "Could not update setting.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateRateLimit = async (newRate: number) => {
    if (isNaN(newRate) || newRate < 1 || newRate > 60) {
      setError("Please specify a dispatch rate between 1 and 60 emails per minute.");
      return;
    }
    try {
      setSavingRateLimit(true);
      setError("");
      setSuccessMsg("");

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailsPerMinute: newRate }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update email dispatch rate");
      }

      setEmailsPerMinute(newRate);
      setRateInput(String(newRate));
      const intervalSec = Math.round(60 / newRate);
      setSuccessMsg(`⚡ Dispatch Rate updated: ${newRate} email(s) per minute (${intervalSec}s delay between emails)`);
    } catch (err: any) {
      setError(err.message || "Could not update dispatch rate.");
    } finally {
      setSavingRateLimit(false);
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
      formData.append("googleAppPassword", authMethodChoice === "app_password" ? formAppPassword.trim() : "");
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
        formAppPassword.trim() && authMethodChoice === "app_password"
          ? `🎉 Candidate "${candidateName}" created & activated with Google App Password!`
          : `🎉 Candidate "${candidateName}" registered! Share their 1-time onboarding link to connect.`
      );

      // Reset Form & Close Modal
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
      setIsAddModalOpen(false);

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
        setSuccessMsg(`Candidate ${email} is now ${newStatus.toUpperCase()}`);
        loadAllData();
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteCustomer = async (email: string) => {
    if (!confirm(`Are you sure you want to permanently delete candidate "${email}"?`)) return;
    try {
      const res = await fetch(`/api/admin/customers?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSuccessMsg(`Candidate ${email} deleted.`);
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

  const handleSaveAppPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPasswordCust) return;
    setSavingPassword(true);
    try {
      const res = await fetch("/api/admin/customers", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editingPasswordCust.email,
          appPassword: editAppPasswordInput.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update app password");
      }
      setSuccessMsg(`Google App Password (raw format) saved for ${editingPasswordCust.email}`);
      setEditingPasswordCust(null);
      setEditAppPasswordInput("");
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to update app password");
    } finally {
      setSavingPassword(false);
    }
  };

  const openEditCustomerModal = (c: CustomerProfile) => {
    setEditingCustomer(c);
    setEditName(c.name || "");
    setEditRole(c.role || "Software Engineer");
    setEditExperience(c.experience || "1-3 Years");
    setEditLocation(c.location || "Remote");
    setEditDailyLimit(c.dailyLimit || 20);
    setEditCustomerCategory(c.customerCategory || "job_seeker");
    setEditAuthMethod(c.appPassword || c.encryptedAppPassword ? "app_password" : "link");
    setEditCustomerAppPassword(c.appPassword || c.encryptedAppPassword || "");
    setShowEditCustomerPass(false);
    setEditNotes(c.notes || "");
    setEditStatus(c.status || "active");
    setEditResumeFile(null);
  };

  const handleUpdateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCustomer) return;
    setSavingEditCustomer(true);
    setError("");
    setSuccessMsg("");

    try {
      const formData = new FormData();
      formData.append("email", editingCustomer.email);
      formData.append("name", editName.trim() || editingCustomer.name);
      formData.append("role", editRole.trim() || "Software Engineer");
      formData.append("experience", editExperience);
      formData.append("location", editLocation.trim() || "Remote");
      formData.append("dailyLimit", String(editDailyLimit));
      formData.append("customerCategory", editCustomerCategory);
      formData.append("notes", editNotes.trim());
      formData.append("status", editStatus);
      if (editAuthMethod === "app_password") {
        formData.append("googleAppPassword", editCustomerAppPassword.trim());
      }
      if (editResumeFile) {
        formData.append("resume", editResumeFile);
      }

      const res = await fetch("/api/admin/customers", {
        method: "PUT",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to update candidate profile");
      }

      setSuccessMsg(`🎉 Candidate "${editName.trim() || editingCustomer.name}" updated successfully!`);
      setEditingCustomer(null);
      loadAllData();
    } catch (err: any) {
      setError(err.message || "Failed to update candidate profile");
    } finally {
      setSavingEditCustomer(false);
    }
  };

  const runSimulator2am = async () => {
    try {
      setCronRunning2am(true);
      setLogs2am([`[${new Date().toLocaleTimeString()}] Running multi-portal job harvester across all streams...`]);
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
      setSuccessMsg(`✅ Harvester queued ${data.data?.insertedCount || 0} fresh verified jobs!`);
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
      setLogs9am([`[${new Date().toLocaleTimeString()}] Triggering scheduled email dispatcher...`]);
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
      const logs = [...(data.data?.logs || data.logs || [])];
      if (data.data?.hasMorePending) {
        logs.push(`[BATCH INFO] Chunk complete (${data.data.totalEmailsDispatched} emails sent). ${data.data.remainingQueueJobs} jobs remain in queue. Run again to dispatch next batch.`);
      }
      setLogs9am(logs);
      setSuccessMsg(
        data.data?.hasMorePending
          ? `⚡ Chunk completed! Dispatched ${data.data?.totalEmailsDispatched || 0} emails (${data.data.remainingQueueJobs} remaining in queue)`
          : `✅ Batch completed! Dispatched: ${data.data?.totalEmailsDispatched || 0} emails`
      );
      loadAllData();
    } catch (err: any) {
      setLogs9am((prev) => [...prev, `[ERROR] ${err.message}`]);
    } finally {
      setCronRunning9am(false);
    }
  };

  // Filtered lists
  const filteredCustomers = useMemo(() => {
    let list = customers;
    if (customerStatusFilter === "active") list = list.filter((c) => c.status === "active");
    else if (customerStatusFilter === "pending") list = list.filter((c) => c.status === "pending_auth");
    else if (customerStatusFilter === "paused") list = list.filter((c) => c.status === "paused");

    if (!customerSearch.trim()) return list;
    const q = customerSearch.toLowerCase();
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.role.toLowerCase().includes(q) ||
        c.location.toLowerCase().includes(q)
    );
  }, [customers, customerSearch, customerStatusFilter]);

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
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4">
          <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
        </div>
        <p className="text-sm font-medium text-slate-400">Loading SuperAdmin Dashboard...</p>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-[#111726] border border-rose-500/30 rounded-2xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-bold text-white">SuperAdmin Access Restricted</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            This administration console is exclusively restricted to the system owner. Please log in with the designated owner email.
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Command Station</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-16">
      {/* Top Ambient Glow (Subtle & Elegant) */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-indigo-600/10 blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-6 space-y-6">
        
        {/* TOP BAR / HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3.5">
            <Link
              href="/"
              className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 transition-all shrink-0"
              title="Return to Main Station"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-xl font-bold text-white tracking-tight">SuperAdmin Console</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
                  Autopilot Engine
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Centralized candidate outreach, lead harvesting, and automated delivery pipeline
              </p>
            </div>
          </div>

          {/* Header Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {superAdminEmail && (
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <Crown className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="font-mono text-[11px] text-slate-400 truncate max-w-[190px]">{superAdminEmail}</span>
              </div>
            )}

            <button
              onClick={loadAllData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 flex items-center gap-1.5 transition-all cursor-pointer"
              title="Refresh all data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Sync</span>
            </button>

            {/* Primary Action Button */}
            <button
              onClick={() => handle1ClickLaunch(undefined, false)}
              disabled={launchingOutreachEmail !== null || stats.active === 0}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-xs font-semibold shadow-lg shadow-indigo-950/50 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              title="Launch outreach for all active candidates"
            >
              <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
              <span>Launch Outreach (All {stats.active} Candidates)</span>
            </button>
          </div>
        </header>

        {/* Global Notifications */}
        {error && (
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError("")} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center justify-between gap-2 animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg("")} className="text-slate-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* 4 STATS OVERVIEW CARDS */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Candidates</p>
              <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{stats.pending} pending auth</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Users className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Active Candidates</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.active}</p>
              <p className="text-[11px] text-emerald-400/80 mt-0.5">Ready for auto-send</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <UserCheck className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Sent Outreach</p>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{sentStats.totalSent || stats.totalSent}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">{sentStats.uniqueRecipients} unique leads</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <Send className="w-5 h-5" />
            </div>
          </div>

          <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Verified Jobs in Queue</p>
              <p className="text-2xl font-bold text-amber-400 mt-1">{queuedJobs.length}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">DNS MX validated</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
          </div>
        </section>

        {/* NAVIGATION TABS */}
        <nav className="flex items-center gap-1.5 p-1 bg-[#111726] border border-slate-800/80 rounded-2xl overflow-x-auto">
          <button
            onClick={() => setActiveTab("customers")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "customers"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Candidates</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "customers" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>
              {customers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("dbleads")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "dbleads"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Target className="w-4 h-4 text-cyan-400" />
            <span>Targeted Leads</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-cyan-500/20 text-cyan-300 font-bold">
              DB
            </span>
          </button>

          <button
            onClick={() => setActiveTab("crons")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "crons"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Play className="w-4 h-4 text-amber-400" />
            <span>Auto-Pilot & Crons</span>
          </button>

          <button
            onClick={() => setActiveTab("analytics")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "analytics"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Outreach History</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "analytics" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>
              {sentHistory.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("queue")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "queue"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Database className="w-4 h-4 text-cyan-400" />
            <span>Job Radar Queue</span>
            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeTab === "queue" ? "bg-white/20 text-white" : "bg-slate-800 text-slate-400"}`}>
              {queuedJobs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all shrink-0 cursor-pointer ${
              activeTab === "settings"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            <Settings className="w-4 h-4 text-slate-300" />
            <span>Settings</span>
          </button>
        </nav>

        {/* TAB 1: CANDIDATES MANAGEMENT */}
        {activeTab === "customers" && (
          <div className="space-y-4">
            {/* Filter & Action Bar */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Status Filter Pills */}
                <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium">
                  <button
                    onClick={() => setCustomerStatusFilter("all")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      customerStatusFilter === "all" ? "bg-slate-800 text-white font-semibold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    All ({customers.length})
                  </button>
                  <button
                    onClick={() => setCustomerStatusFilter("active")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      customerStatusFilter === "active" ? "bg-emerald-500/20 text-emerald-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Active ({stats.active})
                  </button>
                  <button
                    onClick={() => setCustomerStatusFilter("pending")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      customerStatusFilter === "pending" ? "bg-amber-500/20 text-amber-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Pending ({stats.pending})
                  </button>
                  <button
                    onClick={() => setCustomerStatusFilter("paused")}
                    className={`px-3 py-1.5 rounded-lg transition-all ${
                      customerStatusFilter === "paused" ? "bg-rose-500/20 text-rose-300 font-semibold" : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Paused
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {/* Search Bar */}
                <div className="relative flex-1 md:w-72">
                  <input
                    type="text"
                    placeholder="Search candidate name, role, email..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>

                {/* Primary Add Candidate Button */}
                <button
                  onClick={() => setIsAddModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-950/40 transition-all shrink-0 cursor-pointer"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>+ Add Candidate</span>
                </button>
              </div>
            </div>

            {/* Candidate Cards Grid */}
            {filteredCustomers.length === 0 ? (
              <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-12 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto text-indigo-400">
                  <Users className="w-6 h-6" />
                </div>
                <h3 className="text-base font-semibold text-white">No candidates found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {customerSearch ? "No profiles match your current search criteria." : "Start by registering your first candidate to automate job applications."}
                </p>
                {!customerSearch && (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold transition-all cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>Register Candidate</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3.5">
                {filteredCustomers.map((c) => {
                  const isCandidateActive = c.status === "active";
                  const isLaunching = launchingOutreachEmail === c.email || launchingOutreachEmail === "ALL";
                  const initials = c.name
                    ? c.name
                        .split(" ")
                        .map((n) => n[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase()
                    : "CA";

                  return (
                    <div
                      key={c.email}
                      className="bg-[#111726] border border-slate-800/80 hover:border-slate-700/80 rounded-2xl p-4 sm:p-5 transition-all shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      {/* Left: Avatar & Candidate Information */}
                      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-sm shrink-0 shadow-md shadow-indigo-950/40">
                          {initials}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-white text-sm truncate">{c.name}</span>
                            <span className="text-xs text-slate-400 truncate">({c.email})</span>

                            {/* Category Badge */}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                                c.customerCategory === "b2b_lead_finder"
                                  ? "bg-amber-500/10 text-amber-300 border-amber-500/20"
                                  : c.customerCategory === "all"
                                  ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/20"
                                  : "bg-indigo-500/10 text-indigo-300 border-indigo-500/20"
                              }`}
                            >
                              {c.customerCategory === "b2b_lead_finder"
                                ? "🏢 B2B Leads"
                                : c.customerCategory === "all"
                                ? "🌟 Dual Channel"
                                : "🧑‍💻 Job Seeker"}
                            </span>

                            {/* Auth Status Pill */}
                            {c.appPassword || c.encryptedAppPassword ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active (App Password)
                              </span>
                            ) : c.encryptedRefreshToken ? (
                              <span className="px-2.5 py-0.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active (OAuth)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/20 rounded-full text-amber-300 text-[10px] font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                                Pending Link Connect
                              </span>
                            )}
                          </div>

                          {/* Secondary Specs Strip */}
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-0.5">
                            <span className="text-slate-300 font-medium">{c.role}</span>
                            <span>•</span>
                            <span>{c.experience}</span>
                            <span>•</span>
                            <span>{c.location}</span>
                            <span>•</span>
                            <span className={c.resumeName ? "text-slate-300" : "text-amber-400/80"}>
                              {c.resumeName ? `📄 ${c.resumeName}` : "⚠️ No resume attached"}
                            </span>
                            <span>•</span>
                            <span className="text-slate-300 font-medium">
                              {c.totalSentCount || 0} sent (Limit: {c.dailyLimit || 20}/day)
                            </span>
                            {(c.appPassword || c.encryptedAppPassword) && (
                              <>
                                <span>•</span>
                                <span
                                  className="text-emerald-300 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40 inline-flex items-center gap-1 text-[11px]"
                                  title="Candidate Raw App Password"
                                >
                                  <KeyRound className="w-3 h-3 text-emerald-400" />
                                  <span>{c.appPassword || c.encryptedAppPassword}</span>
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800">
                        {/* Primary Launch Button for Candidate */}
                        <button
                          onClick={() => handle1ClickLaunch(c.email, false)}
                          disabled={!isCandidateActive || isLaunching}
                          className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-xs font-semibold shadow-md shadow-indigo-950/40 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                          title={`Launch outreach for ${c.name}`}
                        >
                          {isLaunching ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Zap className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                          )}
                          <span>Launch Outreach ({c.dailyLimit || 20} Mails)</span>
                        </button>

                        {/* Copy 1-Time Connect Link */}
                        <button
                          onClick={() => copyConnectLink(c.connectToken)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                          title="Copy 1-Time Onboarding Link for Candidate"
                        >
                          {copiedToken === c.connectToken ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {/* Edit Candidate Profile (All Fields) */}
                        <button
                          onClick={() => openEditCustomerModal(c)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-indigo-400 transition-all cursor-pointer"
                          title="Edit Candidate Profile (All Fields)"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        {/* Set / Edit Raw Google App Password */}
                        <button
                          onClick={() => {
                            setEditingPasswordCust(c);
                            setEditAppPasswordInput(c.appPassword || c.encryptedAppPassword || "");
                            setShowEditAppPass(false);
                          }}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-all cursor-pointer"
                          title="Set / Edit Raw App Password"
                        >
                          <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                        </button>

                        {/* Pause / Resume Button */}
                        <button
                          onClick={() => handleToggleCustomerStatus(c.email, c.status)}
                          className={`p-2 rounded-xl border transition-all cursor-pointer ${
                            c.status === "active"
                              ? "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/20 text-amber-300"
                              : "bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 text-emerald-300"
                          }`}
                          title={c.status === "active" ? "Pause Outreach" : "Activate Outreach"}
                        >
                          {c.status === "active" ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                        </button>

                        {/* Delete Button */}
                        <button
                          onClick={() => handleDeleteCustomer(c.email)}
                          className="p-2 rounded-xl bg-slate-900 hover:bg-rose-500/20 border border-slate-800 hover:border-rose-500/30 text-slate-400 hover:text-rose-400 transition-all cursor-pointer"
                          title="Delete Candidate Profile"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: TARGETED LEADS */}
        {activeTab === "dbleads" && (
          <DbLeadsSection
            customers={customers}
            onOutreachComplete={() => {
              fetchSentHistory();
              loadAllData();
            }}
          />
        )}

        {/* TAB 3: AUTO-PILOT & CRONS */}
        {activeTab === "crons" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Harvester Engine */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      <span>Phase 1: Multi-Portal Job Harvester (2:00 AM)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                      20 Streams
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Scrapes live verified jobs across <strong>Naukri, Indeed, LinkedIn, WorkIndia, RemoteOK, and Jobicy</strong>, performs DNS MX host verification, and inserts fresh leads into the daily queue.
                  </p>

                  <div className="pt-1">
                    <label className="text-[11px] font-medium text-slate-400 block mb-1">
                      Override Role Filter (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. React Developer, Node.js"
                      value={customScrapeRole}
                      onChange={(e) => setCustomScrapeRole(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-3">
                  <button
                    onClick={runSimulator2am}
                    disabled={cronRunning2am}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {cronRunning2am ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span>Run Phase 1 Job Harvester Now</span>
                  </button>

                  {/* Terminal Log */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-[11px] h-36 overflow-y-auto custom-scrollbar text-slate-300 space-y-1">
                    <div className="text-slate-500 text-[10px] border-b border-slate-800 pb-1">EXECUTION LOGS:</div>
                    {logs2am.length === 0 ? (
                      <span className="text-slate-600 italic">No execution logs yet. Click button to run.</span>
                    ) : (
                      logs2am.map((l, i) => <div key={i}>{l}</div>)
                    )}
                  </div>
                </div>
              </div>

              {/* Email Dispatcher Engine */}
              <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-sm">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Send className="w-4 h-4 text-violet-400" />
                      <span>Phase 2: Morning Email Outreach (9:00 AM)</span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-violet-500/10 border border-violet-500/20 text-violet-400">
                      Direct SMTP
                    </span>
                  </div>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    Matches candidate profiles with today&apos;s scraped jobs, generates <strong>AI personalized pitch emails</strong>, attaches PDF resumes, and dispatches via authenticated Google SMTP.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <div>
                      <label className="text-[11px] font-medium text-slate-400 block mb-1">Target Candidate</label>
                      <select
                        value={selectedCustomerFor9am}
                        onChange={(e) => setSelectedCustomerFor9am(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-violet-500"
                      >
                        <option value="">All Active Candidates ({stats.active})</option>
                        {customers.filter((c) => c.status === "active").map((c) => (
                          <option key={c.email} value={c.email}>{c.name} ({c.email})</option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-end pb-1.5">
                      <label className="flex items-center gap-2 text-xs text-amber-300 cursor-pointer">
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

                <div className="space-y-3 pt-3">
                  <button
                    onClick={runSimulator9am}
                    disabled={cronRunning9am}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {cronRunning9am ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                    <span>{simulateOnly9am ? "Run Dry Simulation" : "Execute Email Outreach Now"}</span>
                  </button>

                  {/* Terminal Log */}
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 font-mono text-[11px] h-36 overflow-y-auto custom-scrollbar text-slate-300 space-y-1">
                    <div className="text-slate-500 text-[10px] border-b border-slate-800 pb-1">EXECUTION LOGS:</div>
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

        {/* TAB 4: SENT OUTREACH HISTORY */}
        {activeTab === "analytics" && (
          <div className="space-y-4">
            {/* Header / Stats */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span>Outreach Telemetry & Sent Logs</span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Total Dispatched: <strong className="text-white">{sentStats.totalSent || sentHistory.length}</strong> • Unique HR Leads: <strong className="text-cyan-400">{sentStats.uniqueRecipients}</strong> • Unique Companies: <strong className="text-violet-400">{sentStats.uniqueCompanies}</strong>
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  onClick={fetchSentHistory}
                  disabled={loadingSentHistory}
                  className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingSentHistory ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>

                <button
                  onClick={handleScanBounces}
                  disabled={scanningBounces}
                  className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Scan candidate mailboxes for Mailer-Daemon delivery failure notifications"
                >
                  <ShieldAlert className={`w-3.5 h-3.5 text-rose-400 ${scanningBounces ? "animate-spin" : ""}`} />
                  <span>{scanningBounces ? "Scanning Mailboxes..." : "Scan Dead Bounces"}</span>
                </button>

                <button
                  onClick={exportSentHistoryToExcel}
                  disabled={sentHistory.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-emerald-950/40 transition-all cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Excel Report (.xlsx)</span>
                </button>
              </div>
            </div>

            {/* Logs Table */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                  <Mail className="w-4 h-4 text-emerald-400" />
                  <span>Dispatched Outreach Records ({filteredSentHistory.length})</span>
                </div>

                <div className="relative min-w-[280px]">
                  <input
                    type="text"
                    placeholder="Search candidate, recipient, company..."
                    value={sentHistorySearch}
                    onChange={(e) => setSentHistorySearch(e.target.value)}
                    className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar max-h-[500px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#0d121f] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Candidate</th>
                      <th className="py-2.5 px-3 font-medium">Recipient Lead</th>
                      <th className="py-2.5 px-3 font-medium">Company & Role</th>
                      <th className="py-2.5 px-3 font-medium">Email Subject</th>
                      <th className="py-2.5 px-3 font-medium">Dispatched Time</th>
                      <th className="py-2.5 px-3 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredSentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-500 italic">
                          No sent outreach records found yet.
                        </td>
                      </tr>
                    ) : (
                      filteredSentHistory.map((item) => (
                        <tr key={item._id} className="hover:bg-slate-800/30 transition-all">
                          <td className="py-2.5 px-3 font-medium text-slate-200">
                            <div>{item.customerName || "Candidate"}</div>
                            <div className="text-[11px] text-slate-500">{item.customerEmail}</div>
                          </td>
                          <td className="py-2.5 px-3 text-cyan-300 font-mono text-[11px]">{item.recipientEmail}</td>
                          <td className="py-2.5 px-3">
                            <span className="text-white font-medium">{item.company || "Hiring Team"}</span>
                            <span className="block text-[11px] text-slate-400">{item.role || "Target Role"}</span>
                          </td>
                          <td className="py-2.5 px-3 max-w-[280px] truncate text-slate-300" title={item.subject}>
                            {item.subject || "Job Application"}
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-400 whitespace-nowrap">
                            {item.dispatchedAt ? new Date(item.dispatchedAt).toLocaleString() : item.dateString || "-"}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            {item.status === "bounced" ? (
                              <span className="px-2 py-0.5 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-full text-[10px] font-semibold flex items-center gap-1 w-fit">
                                <ShieldAlert className="w-3 h-3 text-rose-400" />
                                <span>Bounced (Dead Mail)</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px] font-medium">
                                Sent (SMTP)
                              </span>
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

        {/* TAB 5: JOB RADAR QUEUE */}
        {activeTab === "queue" && (
          <div className="space-y-4">
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-3 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Database className="w-4 h-4 text-cyan-400" />
                    <span>Verified Jobs in Daily Queue ({queuedJobs.length})</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Live verified hiring leads ready to be dispatched during candidate outreach.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative min-w-[240px]">
                    <input
                      type="text"
                      placeholder="Search queue role, company..."
                      value={queueSearch}
                      onChange={(e) => setQueueSearch(e.target.value)}
                      className="w-full px-3.5 py-2 pl-9 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  </div>
                  <button
                    onClick={fetchQueue}
                    className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300"
                    title="Refresh Queue"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loadingQueue ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto custom-scrollbar max-h-[450px]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-[#0d121f] text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3 font-medium">Role & Title</th>
                      <th className="py-2.5 px-3 font-medium">Company</th>
                      <th className="py-2.5 px-3 font-medium">Lead Quality</th>
                      <th className="py-2.5 px-3 font-medium">Verified Email</th>
                      <th className="py-2.5 px-3 font-medium">Location</th>
                      <th className="py-2.5 px-3 font-medium">Source Portal</th>
                      <th className="py-2.5 px-3 font-medium">Dispatched</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-300">
                    {filteredQueue.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-500 italic">
                          No jobs in today&apos;s queue. Click &ldquo;Run Phase 1 Job Harvester&rdquo; in Auto-Pilot tab to populate fresh leads.
                        </td>
                      </tr>
                    ) : (
                      filteredQueue.map((job, idx) => (
                        <tr key={idx} className="hover:bg-slate-800/30 transition-all">
                          <td className="py-2.5 px-3 font-medium text-white">{job.role}</td>
                          <td className="py-2.5 px-3 text-violet-300">{job.company}</td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                              (job.score || 75) >= 80
                                ? "bg-emerald-500/10 text-emerald-300 border-emerald-500/30"
                                : (job.score || 75) >= 65
                                ? "bg-cyan-500/10 text-cyan-300 border-cyan-500/30"
                                : "bg-amber-500/10 text-amber-300 border-amber-500/30"
                            }`}>
                              ★ {job.score || 75}/100
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-cyan-300 font-mono text-[11px]">{job.email}</td>
                          <td className="py-2.5 px-3 text-slate-400">{job.location}</td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-500 uppercase">{job.sourceType}</td>
                          <td className="py-2.5 px-3">
                            {job.dispatchedTo && job.dispatchedTo.length > 0 ? (
                              <span className="px-2 py-0.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-full text-[10px]">
                                {job.dispatchedTo.length} Candidate(s)
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">Pending</span>
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

        {/* TAB 6: SETTINGS & ACCESS CONTROL */}
        {activeTab === "settings" && (
          <div className="space-y-4">
            {/* Global Access Switch */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Global Candidate Access Switch</h3>
                  <p className="text-xs text-slate-400">
                    Control whether candidate logins are enabled or restricted exclusively to Superadmin.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-semibold text-white">Candidate Login Status:</span>
                    {allowCustomerLogin ? (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full text-[10px] font-medium">
                        Enabled
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-rose-500/10 text-rose-300 border border-rose-500/20 rounded-full text-[10px] font-medium">
                        Disabled (SuperAdmin Only)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {allowCustomerLogin
                      ? "Candidates can log in with Google OAuth to track their sent email history."
                      : "Candidate logins are blocked. Only the Superadmin can manage profiles and outreach."}
                  </p>
                </div>

                <button
                  onClick={() => handleToggleCustomerLogin(!allowCustomerLogin)}
                  disabled={savingSettings}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0 ${
                    allowCustomerLogin
                      ? "bg-rose-600 hover:bg-rose-500 text-white"
                      : "bg-emerald-600 hover:bg-emerald-500 text-white"
                  }`}
                >
                  {savingSettings ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                  <span>{allowCustomerLogin ? "Disable Candidate Login" : "Enable Candidate Login"}</span>
                </button>
              </div>
            </div>

            {/* Dispatch Rate Limiter */}
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-5 space-y-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">Email Dispatch Rate Limiter (Spam Protection)</h3>
                  <p className="text-xs text-slate-400">
                    Configure pacing intervals between outgoing emails to protect Gmail domain reputation.
                  </p>
                </div>
              </div>

              <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-xs text-slate-400 block">Current Dispatch Speed:</span>
                    <span className="text-2xl font-bold text-cyan-400">
                      {emailsPerMinute} <span className="text-xs font-normal text-slate-400">emails / minute</span>
                    </span>
                  </div>

                  <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/20 text-xs text-cyan-300">
                    ⏱️ Interval: <strong className="text-white">{Math.round(60 / (emailsPerMinute || 1))}s</strong> delay between consecutive emails
                  </div>
                </div>

                {/* Quick Presets */}
                <div>
                  <label className="text-[11px] font-medium text-slate-400 block mb-2">
                    Quick Speed Presets:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                    {[
                      { rate: 1, label: "1 / min", note: "60s gap (Safest)" },
                      { rate: 2, label: "2 / min", note: "30s gap" },
                      { rate: 5, label: "5 / min", note: "12s gap" },
                      { rate: 10, label: "10 / min", note: "6s gap" },
                      { rate: 15, label: "15 / min", note: "4s gap" },
                      { rate: 30, label: "30 / min", note: "2s gap" },
                    ].map((item) => (
                      <button
                        key={item.rate}
                        type="button"
                        onClick={() => handleUpdateRateLimit(item.rate)}
                        disabled={savingRateLimit}
                        className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                          emailsPerMinute === item.rate
                            ? "bg-cyan-500/15 border-cyan-500/40 text-white shadow-sm"
                            : "bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800"
                        }`}
                      >
                        <div className="text-xs font-semibold">{item.label}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{item.note}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Rate Input */}
                <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs text-slate-300 shrink-0">Custom Rate:</span>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={rateInput}
                      onChange={(e) => setRateInput(e.target.value)}
                      placeholder="e.g. 1"
                      className="w-24 px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs focus:outline-none focus:border-cyan-500"
                    />
                    <span className="text-xs text-slate-400">emails / minute (1 to 60)</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpdateRateLimit(parseInt(rateInput, 10))}
                    disabled={savingRateLimit}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 rounded-xl text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {savingRateLimit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    <span>Save Custom Rate</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================== */}
      {/* 🚀 MODAL 1: ADD CANDIDATE POPUP DIALOG                       */}
      {/* ========================================================== */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111726] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-indigo-400" />
                  <span>Register New Candidate</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Configure candidate profile for automated job scraping and personalized outreach.
                </p>
              </div>

              <button
                onClick={() => setIsAddModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-4">
              {/* Row 1: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Candidate Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gaurav Upadhyay"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Candidate Gmail *</label>
                  <input
                    type="email"
                    required
                    placeholder="e.g. gaurav@gmail.com"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Row 2: Target Role & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target Job Role *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. React / Full Stack Developer"
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Experience Level</label>
                  <select
                    value={formExperience}
                    onChange={(e) => setFormExperience(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Fresher">Fresher (0-1 Years)</option>
                    <option value="1-3 Years">1-3 Years Experience</option>
                    <option value="3-5 Years">3-5 Years Experience</option>
                    <option value="5+ Years">5+ Years Senior</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Location, Quota, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Remote, India, USA"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Daily Email Quota</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={formDailyLimit}
                    onChange={(e) => setFormDailyLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Category</label>
                  <select
                    value={formCustomerCategory}
                    onChange={(e) => setFormCustomerCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="job_seeker">Job Seeker</option>
                    <option value="b2b_lead_finder">B2B Client Outreach</option>
                    <option value="all">Dual Channel (All)</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Resume File Upload */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Upload Resume (PDF)</label>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setResumeFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/30 cursor-pointer"
                />
              </div>

              {/* SECTION: AUTHENTICATION METHOD */}
              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Sending Authorization:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMethodChoice("app_password")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        authMethodChoice === "app_password"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Instant App Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethodChoice("link")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                        authMethodChoice === "link"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Share Connect Link
                    </button>
                  </div>
                </div>

                {authMethodChoice === "app_password" ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Google 16-Digit App Password</span>
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <span>Generate from Google</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="relative">
                      <input
                        type={showAppPass ? "text" : "password"}
                        placeholder="e.g. abcd efgh ijkl mnop"
                        value={formAppPassword}
                        onChange={(e) => setFormAppPassword(e.target.value)}
                        className="w-full px-3.5 py-2 pr-12 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowAppPass(!showAppPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                      >
                        {showAppPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <p className="text-[11px] text-emerald-400/90">
                      ✓ Instant Raw Activation: Stored in raw format (no encryption or hashing) for immediate direct 1-click email dispatching.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-400 space-y-1">
                    <p className="text-slate-300 font-medium">Candidate will self-connect via link:</p>
                    <p>
                      You can create the candidate now. A secure 1-time link will be generated that you can share with them to authorize Google OAuth.
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creatingCustomer || !formEmail.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-950/40 transition-all cursor-pointer disabled:opacity-40"
                >
                  {creatingCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                  <span>Save Candidate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🚀 MODAL 2: 1-CLICK LAUNCH REAL-TIME LOGS STREAM            */}
      {/* ========================================================== */}
      {launchModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-800 max-w-2xl w-full rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                  <Zap className="w-4 h-4 fill-amber-300 text-amber-300" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Outreach Dispatch Engine</h3>
                  <p className="text-[11px] text-slate-400">Live multi-portal scraping & SMTP dispatching</p>
                </div>
              </div>

              <button
                onClick={() => setLaunchModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Terminal Window */}
            <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs h-64 overflow-y-auto custom-scrollbar text-slate-300 space-y-1.5 shadow-inner">
              <div className="text-slate-500 text-[10px] font-bold border-b border-slate-800 pb-1 flex items-center justify-between">
                <span>EXECUTION STREAM:</span>
                {launchingOutreachEmail && <span className="text-amber-400 animate-pulse">RUNNING...</span>}
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

            {/* Footer Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400">
                {launchSummary ? (
                  <div className="space-y-1">
                    <span className="text-emerald-400 font-semibold block">
                      ✓ Outreach Batch Finished: {launchSummary.totalEmailsDispatched} emails dispatched across {launchSummary.totalCustomers} candidates.
                    </span>
                    {launchSummary.hasMorePending && (
                      <span className="text-amber-300 text-[11px] block">
                        ⚡ Batch chunk completed safely. {launchSummary.remainingQueueJobs} jobs remain in queue. Click "Dispatch Next Batch" to continue without server timeout.
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-amber-300 flex items-center gap-1.5">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Outreach pipeline currently executing...</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {launchSummary?.hasMorePending && (
                  <button
                    onClick={() => handle1ClickLaunch(lastTargetEmail === "ALL" ? undefined : (lastTargetEmail || undefined), false)}
                    disabled={launchingOutreachEmail !== null}
                    className="px-3.5 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    <Zap className="w-3.5 h-3.5" />
                    <span>Dispatch Next Batch ({launchSummary.remainingQueueJobs} left)</span>
                  </button>
                )}
                <button
                  onClick={() => setLaunchModalOpen(false)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                >
                  Close Stream
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================== */}
      {/* 🔑 MODAL 3: EDIT RAW APP PASSWORD                          */}
      {/* ========================================================== */}
      {editingPasswordCust && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Google App Password (Raw Format)</h3>
              </div>
              <button
                onClick={() => setEditingPasswordCust(null)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="text-xs text-slate-400 space-y-1">
              <p>Candidate: <strong className="text-slate-200">{editingPasswordCust.name}</strong> ({editingPasswordCust.email})</p>
              <p className="text-[11px] text-slate-500">The 16-character password is saved in raw format (no hashing or encryption) for direct SMTP connection.</p>
            </div>

            <form onSubmit={handleSaveAppPassword} className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[11px] font-medium text-slate-400 block">
                  16-Digit App Password
                </label>
                <div className="relative">
                  <input
                    type={showEditAppPass ? "text" : "password"}
                    placeholder="e.g. abcd efgh ijkl mnop"
                    value={editAppPasswordInput}
                    onChange={(e) => setEditAppPasswordInput(e.target.value)}
                    className="w-full px-3.5 py-2 pr-12 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEditAppPass(!showEditAppPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                  >
                    {showEditAppPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingPasswordCust(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-950/40 transition-all cursor-pointer disabled:opacity-40"
                >
                  {savingPassword ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Raw Password</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ========================================================== */}
      {/* ✏️ MODAL 4: EDIT FULL CANDIDATE PROFILE                   */}
      {/* ========================================================== */}
      {editingCustomer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#111726] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl space-y-5 animate-in fade-in zoom-in-95 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3.5">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-indigo-400" />
                  <span>Edit Candidate Profile</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Update candidate target role, quota, credentials, and resume.
                </p>
              </div>

              <button
                onClick={() => setEditingCustomer(null)}
                className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateCustomer} className="space-y-4">
              {/* Row 1: Name & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Candidate Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Gaurav Upadhyay"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">
                    Candidate Gmail <span className="text-[10px] text-slate-500 font-normal">(Account ID)</span>
                  </label>
                  <input
                    type="email"
                    disabled
                    value={editingCustomer.email}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs text-slate-400 cursor-not-allowed font-mono"
                  />
                </div>
              </div>

              {/* Row 2: Target Role & Experience */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target Job Role *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. React / Full Stack Developer"
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Experience Level</label>
                  <select
                    value={editExperience}
                    onChange={(e) => setEditExperience(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="Fresher">Fresher (0-1 Years)</option>
                    <option value="1-3 Years">1-3 Years Experience</option>
                    <option value="3-5 Years">3-5 Years Experience</option>
                    <option value="5+ Years">5+ Years Senior</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Location, Quota, Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Target Location</label>
                  <input
                    type="text"
                    placeholder="e.g. Remote, India, USA"
                    value={editLocation}
                    onChange={(e) => setEditLocation(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Daily Email Quota</label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={editDailyLimit}
                    onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-slate-300 block mb-1">Category</label>
                  <select
                    value={editCustomerCategory}
                    onChange={(e) => setEditCustomerCategory(e.target.value as any)}
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="job_seeker">Job Seeker</option>
                    <option value="b2b_lead_finder">B2B Client Outreach</option>
                    <option value="all">Dual Channel (All)</option>
                  </select>
                </div>
              </div>

              {/* Row 4: Status Selection */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Candidate Account Status</label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value as any)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="active">Active (Ready for auto dispatch)</option>
                  <option value="paused">Paused (Temporarily halt dispatch)</option>
                  <option value="pending_auth">Pending Auth (Requires App Password or Link)</option>
                  <option value="blocked">Blocked (Disabled)</option>
                </select>
              </div>

              {/* Row 5: Resume File Upload */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-slate-300 block">Candidate Resume (PDF)</label>
                  {editingCustomer.resumeName && (
                    <span className="text-[11px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Current: {editingCustomer.resumeName}</span>
                    </span>
                  )}
                </div>
                <input
                  type="file"
                  accept=".pdf"
                  onChange={(e) => setEditResumeFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-indigo-600/20 file:text-indigo-300 hover:file:bg-indigo-600/30 cursor-pointer"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  {editingCustomer.resumeName
                    ? "Leave empty to keep the existing resume, or upload a new PDF to replace it."
                    : "No resume currently uploaded. Upload a PDF resume for email attachments."}
                </p>
              </div>

              {/* SECTION: AUTHENTICATION METHOD */}
              <div className="p-4 bg-slate-900/80 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Sending Authorization:</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setEditAuthMethod("app_password")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        editAuthMethod === "app_password"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Instant App Password
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditAuthMethod("link")}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        editAuthMethod === "link"
                          ? "bg-indigo-600 text-white"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Share Connect Link
                    </button>
                  </div>
                </div>

                {editAuthMethod === "app_password" ? (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-slate-400">Google 16-Digit App Password (Raw Format)</span>
                      <a
                        href="https://myaccount.google.com/apppasswords"
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                      >
                        <span>Generate from Google</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>

                    <div className="relative">
                      <input
                        type={showEditCustomerPass ? "text" : "password"}
                        placeholder="e.g. abcd efgh ijkl mnop"
                        value={editCustomerAppPassword}
                        onChange={(e) => setEditCustomerAppPassword(e.target.value)}
                        className="w-full px-3.5 py-2 pr-12 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditCustomerPass(!showEditCustomerPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                      >
                        {showEditCustomerPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <p className="text-[11px] text-emerald-400/90">
                      ✓ Instant Raw Activation: Stored in raw format (no encryption or hashing) for immediate direct 1-click email dispatching.
                    </p>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-950 rounded-lg text-xs text-slate-400 space-y-2">
                    <p className="text-slate-300 font-medium">Candidate self-connect link:</p>
                    <div className="flex items-center justify-between gap-2 p-2 bg-slate-900 rounded-lg font-mono text-[11px] text-slate-300 truncate">
                      <span className="truncate">/connect/{editingCustomer.connectToken}</span>
                      <button
                        type="button"
                        onClick={() => copyConnectLink(editingCustomer.connectToken)}
                        className="px-2 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-[10px] font-semibold shrink-0 cursor-pointer"
                      >
                        {copiedToken === editingCustomer.connectToken ? "Copied!" : "Copy Link"}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Row 6: Notes */}
              <div>
                <label className="text-xs font-medium text-slate-300 block mb-1">Notes / Preferences (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Prefers frontend roles, available immediately..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              {/* Modal Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCustomer(null)}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 transition-all cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={savingEditCustomer}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-indigo-950/40 transition-all cursor-pointer disabled:opacity-40"
                >
                  {savingEditCustomer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  <span>Save Candidate Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
