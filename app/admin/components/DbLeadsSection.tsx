"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Search,
  Filter,
  Users,
  Briefcase,
  MapPin,
  Globe,
  Mail,
  Send,
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  RefreshCw,
  Copy,
  Check,
  Eye,
  FileText,
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  X,
  Play,
  RotateCcw,
  UserCheck,
  Layers,
  Terminal,
  Loader2,
  Building,
  GraduationCap
} from "lucide-react";
import { BUILTIN_TEMPLATES, EmailTemplate } from "@/lib/template-presets";

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
  totalSentCount: number;
};

type DbLead = {
  _id: string;
  email: string;
  name?: string;
  company: string;
  role: string;
  location: string;
  experience?: string;
  snippet?: string;
  sourceUrl?: string;
  sourceType: string;
  platform: string;
  status: string;
  mxValid: boolean;
  mxDetails?: string;
  leadType?: string;
  dispatchedTo?: string[];
  lastContactedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

interface DbLeadsSectionProps {
  customers: CustomerProfile[];
  onOutreachComplete?: () => void;
}

const QUICK_LOCATIONS = [
  "All",
  "Remote",
  "Bengaluru",
  "Delhi NCR",
  "Mumbai",
  "Hyderabad",
  "Pune",
  "Chennai",
  "USA",
  "Europe",
];

const QUICK_ROLES = [
  "All",
  "Frontend",
  "Full Stack",
  "Backend",
  "React",
  "Node.js",
  "Python / AI",
  "DevOps / Cloud",
  "Product Manager",
  "QA Engineer",
];

const EXPERIENCE_OPTIONS = [
  { label: "All Experience", value: "all" },
  { label: "Fresher / 0-1 Yr", value: "Fresher" },
  { label: "1-3 Years", value: "1-3" },
  { label: "3-5 Years", value: "3-5" },
  { label: "5+ Years", value: "5+" },
];

const PLATFORM_OPTIONS = [
  { label: "All Platforms", value: "all" },
  { label: "LinkedIn", value: "LinkedIn" },
  { label: "Naukri", value: "Naukri" },
  { label: "Indeed", value: "Indeed" },
  { label: "Glassdoor", value: "Glassdoor" },
  { label: "Google Jobs", value: "Google Jobs" },
  { label: "Company Career", value: "Company Career" },
  { label: "Job Boards / Feeds", value: "Job Boards" },
  { label: "B2B Directory", value: "B2B" },
];

export default function DbLeadsSection({ customers, onOutreachComplete }: DbLeadsSectionProps) {
  // Leads Data State
  const [leads, setLeads] = useState<DbLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Pagination & Counts
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<any>({
    totalInDb: 0,
    matchingFilter: 0,
    contactedCount: 0,
    discoveredCount: 0,
    verifiedCount: 0,
  });

  // Filter States
  const [filterLocation, setFilterLocation] = useState("all");
  const [customLocation, setCustomLocation] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [customRole, setCustomRole] = useState("");
  const [filterExperience, setFilterExperience] = useState("all");
  const [filterPlatform, setFilterPlatform] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all"); // "all" | "discovered" | "contacted" | "verified"
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Multi-Selection State
  const [selectedLeadEmails, setSelectedLeadEmails] = useState<Set<string>>(new Set());
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  // User / Customer Selection State
  const [selectedCustomerEmail, setSelectedCustomerEmail] = useState<string>("");

  // Template Selection State
  const [templates, setTemplates] = useState<EmailTemplate[]>(BUILTIN_TEMPLATES);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(BUILTIN_TEMPLATES[0].id);
  const [customSubject, setCustomSubject] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [useAiPitch, setUseAiPitch] = useState(true);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [leadDetailModal, setLeadDetailModal] = useState<DbLead | null>(null);

  // Dispatch & Progress Modal States
  const [dispatching, setDispatching] = useState(false);
  const [dispatchModalOpen, setDispatchModalOpen] = useState(false);
  const [dispatchLogs, setDispatchLogs] = useState<string[]>([]);
  const [dispatchProgress, setDispatchProgress] = useState({ current: 0, total: 0 });
  const [dispatchSummary, setDispatchSummary] = useState<any>(null);

  // Auto-set default customer when available
  useEffect(() => {
    if (customers.length > 0 && !selectedCustomerEmail) {
      const activeCust = customers.find((c) => c.status === "active" && (c.encryptedAppPassword || c.encryptedRefreshToken));
      setSelectedCustomerEmail(activeCust ? activeCust.email : customers[0].email);
    }
  }, [customers, selectedCustomerEmail]);

  // Load custom templates from API
  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch("/api/templates");
      const data = await res.json();
      if (res.ok && data.templates) {
        setTemplates(data.templates);
      }
    } catch {}
  };

  // Sync selected template body & subject
  useEffect(() => {
    const tmpl = templates.find((t) => t.id === selectedTemplateId) || templates[0];
    if (tmpl) {
      setCustomSubject(tmpl.subject);
      setCustomBody(tmpl.body);
    }
  }, [selectedTemplateId, templates]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Fetch Leads whenever filters change
  useEffect(() => {
    fetchLeads();
  }, [
    page,
    limit,
    filterLocation,
    customLocation,
    filterRole,
    customRole,
    filterExperience,
    filterPlatform,
    filterStatus,
    debouncedSearch,
  ]);

  const activeLocation = customLocation.trim() || (filterLocation !== "all" ? filterLocation : "");
  const activeRole = customRole.trim() || (filterRole !== "all" ? filterRole : "");

  const fetchLeads = async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));

      if (activeLocation) params.set("location", activeLocation);
      if (activeRole) params.set("role", activeRole);
      if (filterExperience !== "all") params.set("experience", filterExperience);
      if (filterPlatform !== "all") params.set("platform", filterPlatform);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await fetch(`/api/admin/leads?${params.toString()}`, { cache: "no-store" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || "Failed to fetch DB leads.");
      }

      setLeads(data.leads || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalCount(data.pagination?.totalCount || 0);
      if (data.summary) {
        setSummary(data.summary);
      }
    } catch (err: any) {
      setError(err.message || "Could not load leads from database.");
    } finally {
      setLoading(false);
    }
  };

  // Selected Customer Object
  const currentCustomer = useMemo(() => {
    return customers.find((c) => c.email.toLowerCase() === selectedCustomerEmail.toLowerCase());
  }, [customers, selectedCustomerEmail]);

  // Helper: check if all visible leads are selected
  const allVisibleSelected = useMemo(() => {
    if (leads.length === 0) return false;
    return leads.every((l) => selectedLeadEmails.has(l.email.toLowerCase()));
  }, [leads, selectedLeadEmails]);

  // Handle Toggle Single Lead Selection
  const toggleSelectLead = (email: string) => {
    const clean = email.toLowerCase();
    const next = new Set(selectedLeadEmails);
    if (next.has(clean)) {
      next.delete(clean);
    } else {
      next.add(clean);
    }
    setSelectedLeadEmails(next);
  };

  // Select / Deselect All on Current Page
  const toggleSelectAllVisible = () => {
    const next = new Set(selectedLeadEmails);
    if (allVisibleSelected) {
      leads.forEach((l) => next.delete(l.email.toLowerCase()));
    } else {
      leads.forEach((l) => next.add(l.email.toLowerCase()));
    }
    setSelectedLeadEmails(next);
  };

  // Select Top N Leads (e.g. 20 based on customer daily limit)
  const selectTopN = (n: number) => {
    const next = new Set<string>();
    const candidates = leads.slice(0, n);
    candidates.forEach((l) => next.add(l.email.toLowerCase()));
    setSelectedLeadEmails(next);
    setSuccessMsg(`Selected top ${candidates.length} leads matching your current filter.`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // Clear All Selections
  const clearSelections = () => {
    setSelectedLeadEmails(new Set());
  };

  // Export Selected Leads to Excel
  const handleExportSelectedExcel = () => {
    if (selectedLeadEmails.size === 0) {
      alert("Please select at least 1 lead to export.");
      return;
    }

    const selectedData = leads
      .filter((l) => selectedLeadEmails.has(l.email.toLowerCase()))
      .map((l) => ({
        Company: l.company,
        "HR Email": l.email,
        "Target Role": l.role,
        Location: l.location,
        Experience: l.experience || "-",
        Platform: l.platform,
        Status: l.status,
        "MX Valid": l.mxValid ? "Yes" : "No",
        "Discovered Date": l.createdAt ? new Date(l.createdAt).toLocaleDateString() : "-",
        "Job / Source URL": l.sourceUrl || "-",
        Snippet: l.snippet || "-",
      }));

    const worksheet = XLSX.utils.json_to_sheet(selectedData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Selected_DB_Leads");
    const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    saveAs(blob, `Targeted_HR_Leads_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Delete Selected Leads from DB
  const handleDeleteSelected = async () => {
    if (selectedLeadEmails.size === 0) return;
    const count = selectedLeadEmails.size;
    if (!window.confirm(`Are you sure you want to permanently delete ${count} selected lead(s) from the database?`)) {
      return;
    }

    try {
      const res = await fetch("/api/admin/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emails: Array.from(selectedLeadEmails) }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccessMsg(`Successfully deleted ${data.deletedCount || count} leads.`);
        clearSelections();
        fetchLeads();
      } else {
        throw new Error(data.message || "Failed to delete leads");
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  // Single Delete
  const handleDeleteSingle = async (email: string) => {
    if (!window.confirm(`Delete lead "${email}" from database?`)) return;
    try {
      const res = await fetch("/api/admin/leads", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (res.ok) {
        fetchLeads();
      }
    } catch {}
  };

  // Copy Email to Clipboard
  const handleCopyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilterLocation("all");
    setCustomLocation("");
    setFilterRole("all");
    setCustomRole("");
    setFilterExperience("all");
    setFilterPlatform("all");
    setFilterStatus("all");
    setSearchQuery("");
    setDebouncedSearch("");
    setPage(1);
  };

  // Compute Selected Leads Objects Array
  const selectedLeadsList = useMemo(() => {
    return leads.filter((l) => selectedLeadEmails.has(l.email.toLowerCase()));
  }, [leads, selectedLeadEmails]);

  // Execute Targeted Dispatch (Live or Simulation)
  const handleLaunchTargetedOutreach = async (simulateOnly: boolean = false) => {
    if (!selectedCustomerEmail) {
      alert("Please select a candidate/customer profile to send emails from.");
      return;
    }

    if (selectedLeadEmails.size === 0) {
      alert("Please select at least 1 HR lead email from the table.");
      return;
    }

    const leadsToDispatch = selectedLeadsList.length > 0
      ? selectedLeadsList
      : Array.from(selectedLeadEmails).map((e) => ({ email: e }));

    const isConnected = currentCustomer?.encryptedAppPassword || currentCustomer?.encryptedRefreshToken;
    if (!isConnected && !simulateOnly) {
      alert(`Customer "${currentCustomer?.name || selectedCustomerEmail}" has not configured a Google App Password or 1-Click OAuth. Please connect credentials or run in Simulation Mode.`);
      return;
    }

    try {
      setDispatching(true);
      setDispatchModalOpen(true);
      setDispatchSummary(null);
      setDispatchProgress({ current: 0, total: leadsToDispatch.length });
      setDispatchLogs([
        `[${new Date().toLocaleTimeString()}] 🚀 Launching Targeted Cold Outreach Dispatcher...`,
        `[${new Date().toLocaleTimeString()}] Sender Candidate: ${currentCustomer?.name || "Candidate"} <${selectedCustomerEmail}>`,
        `[${new Date().toLocaleTimeString()}] Selected HR Recipients: ${leadsToDispatch.length}`,
        `[${new Date().toLocaleTimeString()}] Mode: ${simulateOnly ? "🧪 SIMULATION (No real emails sent)" : "⚡ LIVE AUTHENTICATED DISPATCH"}`,
        `[${new Date().toLocaleTimeString()}] AI Pitch Engine: ${useAiPitch ? "ENABLED (Per-company personalized)" : "DISABLED"}`,
        `[${new Date().toLocaleTimeString()}] Resume: ${currentCustomer?.resumeName ? `"${currentCustomer.resumeName}" (Attached)` : "None"}`,
      ]);

      const res = await fetch("/api/admin/leads/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerEmail: selectedCustomerEmail,
          selectedLeads: leadsToDispatch,
          subject: customSubject,
          body: customBody,
          useAiPitch,
          simulateOnly,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Targeted dispatch failed.");
      }

      setDispatchLogs(data.logs || []);
      setDispatchSummary(data);
      setDispatchProgress({ current: data.totalDispatched || leadsToDispatch.length, total: leadsToDispatch.length });

      if (onOutreachComplete) {
        onOutreachComplete();
      }
      fetchLeads();
    } catch (err: any) {
      setDispatchLogs((prev) => [...prev, `[FATAL ERROR] ${err.message}`]);
    } finally {
      setDispatching(false);
    }
  };

  // First selected lead for dynamic preview
  const firstSelectedLead = selectedLeadsList[0] || leads[0] || {
    company: "Acme Technologies",
    name: "Alex Miller (Head of Talent)",
    role: "Senior Full Stack Engineer",
    location: "Bengaluru (Hybrid)",
    email: "alex.miller@acmetechnologies.com",
    snippet: "Looking for top-notch engineers with React, Node, and TypeScript experience.",
  };

  // Interpolated Preview Subject & Body
  const previewSubject = useMemo(() => {
    return customSubject
      .replace(/{{\s*role\s*}}/gi, firstSelectedLead.role || currentCustomer?.role || "Software Engineer")
      .replace(/{{\s*company\s*}}/gi, firstSelectedLead.company || "Acme Tech")
      .replace(/{{\s*candidate_name\s*}}/gi, currentCustomer?.name || "Gaurav Upadhyay")
      .replace(/{{\s*experience\s*}}/gi, currentCustomer?.experience || "1-3 Years");
  }, [customSubject, firstSelectedLead, currentCustomer]);

  const previewBody = useMemo(() => {
    return customBody
      .replace(/{{\s*name\s*}}/gi, firstSelectedLead.name || "Hiring Team")
      .replace(/{{\s*company\s*}}/gi, firstSelectedLead.company || "Acme Tech")
      .replace(/{{\s*role\s*}}/gi, firstSelectedLead.role || currentCustomer?.role || "Software Engineer")
      .replace(/{{\s*candidate_name\s*}}/gi, currentCustomer?.name || "Gaurav Upadhyay")
      .replace(/{{\s*candidate_email\s*}}/gi, currentCustomer?.email || "gaurav@example.com")
      .replace(/{{\s*experience\s*}}/gi, currentCustomer?.experience || "1-3 Years")
      .replace(/{{\s*ai_pitch\s*}}/gi, `[AI Personalized Pitch will highlight relevant tech skills tailored specifically to ${firstSelectedLead.company}]`);
  }, [customBody, firstSelectedLead, currentCustomer]);

  return (
    <div className="space-y-4 animate-fade-up">
      {/* 1. TOP STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <div className="genz-glass-panel rounded-xl p-3 border border-purple-500/30 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">TOTAL DB LEADS</p>
            <p className="text-xl font-mono font-black text-white">{summary.totalInDb}</p>
          </div>
          <Layers className="w-5 h-5 text-purple-400" />
        </div>

        <div className="genz-glass-panel rounded-xl p-3 border border-cyan-500/30 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">FILTERED MATCHES</p>
            <p className="text-xl font-mono font-black text-cyan-300">{totalCount}</p>
          </div>
          <Filter className="w-5 h-5 text-cyan-400" />
        </div>

        <div className="genz-glass-panel rounded-xl p-3 border border-amber-500/30 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">SELECTED FOR OUTREACH</p>
            <p className="text-xl font-mono font-black text-amber-300">{selectedLeadEmails.size}</p>
          </div>
          <CheckCircle2 className="w-5 h-5 text-amber-400" />
        </div>

        <div className="genz-glass-panel rounded-xl p-3 border border-emerald-500/30 flex items-center justify-between">
          <div>
            <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">ALREADY CONTACTED</p>
            <p className="text-xl font-mono font-black text-emerald-400">{summary.contactedCount}</p>
          </div>
          <Send className="w-5 h-5 text-emerald-400" />
        </div>

        <div className="genz-glass-panel rounded-xl p-3 border border-pink-500/30 flex items-center justify-between col-span-2 sm:col-span-1">
          <div>
            <p className="text-slate-400 text-[9px] font-mono font-bold uppercase">UNCONTACTED / NEW</p>
            <p className="text-xl font-mono font-black text-pink-300">{summary.discoveredCount}</p>
          </div>
          <Sparkles className="w-5 h-5 text-pink-400" />
        </div>
      </div>

      {/* 2. MULTI-ATTRIBUTE FILTER CONTROL PANEL */}
      <div className="genz-glass-panel rounded-2xl p-4 sm:p-5 border border-purple-500/30 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-purple-400" />
            <h2 className="text-sm font-mono font-bold text-white tracking-wide">
              MULTI-DIMENSIONAL LEAD RADAR & FILTER HUB
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleResetFilters}
              className="px-2.5 py-1 text-[11px] font-mono font-bold text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center gap-1 transition-all"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Filters</span>
            </button>
            <button
              onClick={fetchLeads}
              className="px-3 py-1 text-[11px] font-mono font-bold text-purple-300 hover:text-white bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/40 rounded-lg flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh Leads</span>
            </button>
          </div>
        </div>

        {/* Filter Rows */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Location Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1 font-bold">
              <MapPin className="w-3 h-3 text-cyan-400" />
              <span>LOCATION FILTER</span>
            </label>
            <select
              value={filterLocation}
              onChange={(e) => {
                setFilterLocation(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 genz-input rounded-xl text-white text-xs font-mono mb-1.5"
            >
              {QUICK_LOCATIONS.map((loc) => (
                <option key={loc} value={loc.toLowerCase() === "all" ? "all" : loc} className="bg-[#0b0f24] text-white">
                  {loc === "All" ? "🌍 All Locations" : `📍 ${loc}`}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Or type custom city/country..."
              value={customLocation}
              onChange={(e) => {
                setCustomLocation(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 genz-input rounded-lg text-slate-300 text-[11px] font-mono"
            />
          </div>

          {/* Role Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1 font-bold">
              <Briefcase className="w-3 h-3 text-purple-400" />
              <span>ROLE / JOB TITLE</span>
            </label>
            <select
              value={filterRole}
              onChange={(e) => {
                setFilterRole(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 genz-input rounded-xl text-white text-xs font-mono mb-1.5"
            >
              {QUICK_ROLES.map((r) => (
                <option key={r} value={r.toLowerCase() === "all" ? "all" : r} className="bg-[#0b0f24] text-white">
                  {r === "All" ? "💼 All Job Roles" : `💻 ${r}`}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Or type custom title..."
              value={customRole}
              onChange={(e) => {
                setCustomRole(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-1.5 genz-input rounded-lg text-slate-300 text-[11px] font-mono"
            />
          </div>

          {/* Experience Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1 font-bold">
              <GraduationCap className="w-3 h-3 text-amber-400" />
              <span>EXPERIENCE LEVEL</span>
            </label>
            <select
              value={filterExperience}
              onChange={(e) => {
                setFilterExperience(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 genz-input rounded-xl text-white text-xs font-mono"
            >
              {EXPERIENCE_OPTIONS.map((exp) => (
                <option key={exp.value} value={exp.value} className="bg-[#0b0f24] text-white">
                  🎓 {exp.label}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-slate-500 mt-2 font-mono">Matched against lead job snippet & metadata</p>
          </div>

          {/* Platform Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1 font-bold">
              <Globe className="w-3 h-3 text-pink-400" />
              <span>PLATFORM / SOURCE</span>
            </label>
            <select
              value={filterPlatform}
              onChange={(e) => {
                setFilterPlatform(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 genz-input rounded-xl text-white text-xs font-mono"
            >
              {PLATFORM_OPTIONS.map((plat) => (
                <option key={plat.value} value={plat.value} className="bg-[#0b0f24] text-white">
                  🌐 {plat.label}
                </option>
              ))}
            </select>
            <p className="text-[9px] text-slate-500 mt-2 font-mono">LinkedIn, Naukri, Indeed, Glassdoor, etc.</p>
          </div>

          {/* Status Filter */}
          <div>
            <label className="text-[10px] font-mono text-slate-400 flex items-center gap-1 mb-1 font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>OUTREACH STATUS</span>
            </label>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="w-full px-2.5 py-2 genz-input rounded-xl text-white text-xs font-mono"
            >
              <option value="all" className="bg-[#0b0f24] text-white">⚡ All Statuses</option>
              <option value="discovered" className="bg-[#0b0f24] text-white">🟡 Uncontacted / Discovered</option>
              <option value="contacted" className="bg-[#0b0f24] text-white">🟢 Contacted Leads</option>
              <option value="verified" className="bg-[#0b0f24] text-white">🔵 Active MX Verified Only</option>
            </select>
            <p className="text-[9px] text-slate-500 mt-2 font-mono">Prevent duplicate outreach emails</p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Live search across company name, HR email, role, city, or keywords..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 genz-input rounded-xl text-white text-xs font-mono placeholder:text-slate-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 3. TARGETED DISPATCH COCKPIT: SELECT CANDIDATE + TEMPLATE + BATCH ACTION */}
      <div className="genz-glass-panel rounded-2xl p-4 sm:p-5 border border-cyan-500/40 bg-gradient-to-br from-[#080d28]/90 to-[#120b2e]/90 space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-400 fill-amber-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-mono font-black text-white tracking-wide">
                TARGETED COLD OUTREACH DISPATCH ENGINE
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Select sender candidate, choose email template, and dispatch personalized emails to selected HRs.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setPreviewModalOpen(true)}
              className="px-3 py-1.5 bg-white/10 hover:bg-white/15 border border-white/20 text-slate-200 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all"
            >
              <Eye className="w-3.5 h-3.5 text-cyan-400" />
              <span>Preview / Customize Email</span>
            </button>
            <button
              onClick={handleExportSelectedExcel}
              disabled={selectedLeadEmails.size === 0}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>Export Selected ({selectedLeadEmails.size})</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 items-start">
          {/* A. Candidate / User Selector */}
          <div className="space-y-1.5 p-3 bg-black/40 rounded-xl border border-white/10">
            <label className="text-[11px] font-mono font-bold text-purple-300 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-purple-400" />
              <span>1. SELECT SENDER CANDIDATE / USER</span>
            </label>
            <select
              value={selectedCustomerEmail}
              onChange={(e) => setSelectedCustomerEmail(e.target.value)}
              className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono font-bold"
            >
              {customers.map((c) => {
                const isConn = Boolean(c.encryptedAppPassword || c.encryptedRefreshToken);
                return (
                  <option key={c.email} value={c.email} className="bg-[#0a0f28] text-white">
                    {c.name} ({c.role}) - {isConn ? "🟢 Connected" : "🔴 Not Authenticated"}
                  </option>
                );
              })}
            </select>

            {currentCustomer && (
              <div className="pt-2 text-[10px] font-mono space-y-1 text-slate-300">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Target Role & Exp:</span>
                  <span className="text-purple-300 font-bold">{currentCustomer.role} • {currentCustomer.experience}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sending Auth:</span>
                  <span className={currentCustomer.encryptedAppPassword || currentCustomer.encryptedRefreshToken ? "text-emerald-400 font-bold flex items-center gap-1" : "text-rose-400 font-bold flex items-center gap-1"}>
                    {currentCustomer.encryptedAppPassword || currentCustomer.encryptedRefreshToken ? (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Google SMTP / OAuth Ready</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3" />
                        <span>Needs App Pass or OAuth</span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">PDF Resume:</span>
                  <span className={currentCustomer.resumeName ? "text-cyan-300 font-bold" : "text-amber-400"}>
                    {currentCustomer.resumeName ? `📄 ${currentCustomer.resumeName}` : "⚠️ No resume attached"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* B. Email Template Selector */}
          <div className="space-y-1.5 p-3 bg-black/40 rounded-xl border border-white/10">
            <label className="text-[11px] font-mono font-bold text-cyan-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-cyan-400" />
              <span>2. SELECT EMAIL TEMPLATE</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono font-bold"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id} className="bg-[#0a0f28] text-white">
                  {t.name}
                </option>
              ))}
            </select>

            <div className="pt-2 text-[10px] font-mono space-y-1 text-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Subject:</span>
                <span className="text-slate-200 truncate max-w-[200px]" title={customSubject}>{customSubject}</span>
              </div>
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer text-cyan-300 hover:text-cyan-200">
                  <input
                    type="checkbox"
                    checked={useAiPitch}
                    onChange={(e) => setUseAiPitch(e.target.checked)}
                    className="rounded text-cyan-500 focus:ring-0"
                  />
                  <span>✨ Auto-Personalize AI Pitch</span>
                </label>
                <button
                  type="button"
                  onClick={() => setPreviewModalOpen(true)}
                  className="text-[10px] text-purple-400 hover:text-purple-300 underline font-bold"
                >
                  Edit Text
                </button>
              </div>
            </div>
          </div>

          {/* C. Dispatch Actions */}
          <div className="space-y-2 p-3 bg-black/40 rounded-xl border border-white/10 flex flex-col justify-between h-full">
            <div>
              <label className="text-[11px] font-mono font-bold text-amber-300 flex items-center gap-1.5">
                <Send className="w-3.5 h-3.5 text-amber-400" />
                <span>3. EXECUTE TARGETED OUTREACH</span>
              </label>
              <p className="text-[10px] font-mono text-slate-400 mt-1">
                Selected <strong className="text-amber-300">{selectedLeadEmails.size}</strong> HR emails for candidate{" "}
                <strong className="text-white">{currentCustomer?.name || selectedCustomerEmail}</strong>.
              </p>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button
                onClick={() => handleLaunchTargetedOutreach(false)}
                disabled={selectedLeadEmails.size === 0 || dispatching}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 via-pink-600 to-cyan-500 hover:scale-[1.02] text-white font-mono font-bold text-xs rounded-xl shadow-lg shadow-purple-950/60 genz-shimmer-btn flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
              >
                <Send className="w-4 h-4 fill-white" />
                <span>🚀 SEND OUTREACH TO {selectedLeadEmails.size} HRs</span>
              </button>

              <button
                onClick={() => handleLaunchTargetedOutreach(true)}
                disabled={selectedLeadEmails.size === 0 || dispatching}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/15 text-slate-300 hover:text-white font-mono font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400" />
                <span>🧪 Dry Run Simulation (0 Mails Sent)</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SELECTION BAR & QUICK ACTIONS */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2.5 genz-glass-panel rounded-xl border border-white/10 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={toggleSelectAllVisible}
            className="px-3 py-1 bg-white/10 hover:bg-white/15 border border-white/20 rounded-lg text-white font-bold flex items-center gap-1.5 transition-all"
          >
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAllVisible}
              className="rounded text-purple-500 focus:ring-0 cursor-pointer pointer-events-none"
            />
            <span>{allVisibleSelected ? "Deselect Page" : "Select All on Page"}</span>
          </button>

          <button
            onClick={() => selectTopN(20)}
            className="px-2.5 py-1 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-300 rounded-lg font-bold flex items-center gap-1 transition-all"
          >
            <span>Top 20 (Daily Limit)</span>
          </button>

          <button
            onClick={() => selectTopN(50)}
            className="px-2.5 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 rounded-lg font-bold flex items-center gap-1 transition-all"
          >
            <span>Top 50</span>
          </button>

          {selectedLeadEmails.size > 0 && (
            <button
              onClick={clearSelections}
              className="px-2.5 py-1 bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 rounded-lg font-bold transition-all"
            >
              Clear All ({selectedLeadEmails.size})
            </button>
          )}

          {selectedLeadEmails.size > 0 && (
            <button
              onClick={handleDeleteSelected}
              className="px-2.5 py-1 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-300 rounded-lg font-bold flex items-center gap-1 transition-all"
            >
              <Trash2 className="w-3 h-3 text-rose-400" />
              <span>Delete Selected from DB</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-slate-400 text-[11px]">
          <span>Page {page} of {totalPages} ({totalCount} total matching)</span>
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="px-2 py-0.5 genz-input rounded-md text-white text-[11px] font-mono"
          >
            <option value={25} className="bg-[#0b0f24]">25 / page</option>
            <option value={50} className="bg-[#0b0f24]">50 / page</option>
            <option value={100} className="bg-[#0b0f24]">100 / page</option>
            <option value={200} className="bg-[#0b0f24]">200 / page</option>
          </select>
        </div>
      </div>

      {/* Notifications */}
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

      {/* 5. INTERACTIVE LEADS TABLE */}
      <div className="genz-glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left font-mono text-xs border-collapse">
            <thead>
              <tr className="bg-white/5 border-b border-white/10 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                <th className="p-3 text-center w-10">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    className="rounded text-purple-500 focus:ring-0 cursor-pointer"
                  />
                </th>
                <th className="p-3">COMPANY & CONTACT</th>
                <th className="p-3">HR EMAIL ADDRESS</th>
                <th className="p-3">TARGET ROLE & EXP</th>
                <th className="p-3">LOCATION</th>
                <th className="p-3">PLATFORM</th>
                <th className="p-3">STATUS</th>
                <th className="p-3 text-right">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400">
                    <Loader2 className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-2" />
                    <p className="text-xs">Querying MongoDB Leads Index...</p>
                  </td>
                </tr>
              )}

              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-12 text-center text-slate-400 space-y-2">
                    <Layers className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-sm font-bold text-slate-300">No leads found in database matching current filters.</p>
                    <p className="text-xs text-slate-500">Try clearing filters or search for another keyword/city.</p>
                    <button
                      onClick={handleResetFilters}
                      className="px-3 py-1.5 bg-purple-600/30 hover:bg-purple-600/40 border border-purple-500/40 text-purple-300 rounded-lg text-xs font-bold transition-all"
                    >
                      Reset All Filters
                    </button>
                  </td>
                </tr>
              )}

              {!loading &&
                leads.map((lead) => {
                  const isSelected = selectedLeadEmails.has(lead.email.toLowerCase());
                  const isContacted = lead.status === "contacted";

                  // Platform Badge Styling
                  let platformBadgeClass = "bg-purple-500/15 border-purple-500/30 text-purple-300";
                  if (lead.platform === "LinkedIn") platformBadgeClass = "bg-blue-500/15 border-blue-500/30 text-blue-300";
                  if (lead.platform === "Naukri") platformBadgeClass = "bg-cyan-500/15 border-cyan-500/30 text-cyan-300";
                  if (lead.platform === "Indeed") platformBadgeClass = "bg-indigo-500/15 border-indigo-500/30 text-indigo-300";
                  if (lead.platform === "Glassdoor") platformBadgeClass = "bg-emerald-500/15 border-emerald-500/30 text-emerald-300";
                  if (lead.platform === "Google Jobs") platformBadgeClass = "bg-amber-500/15 border-amber-500/30 text-amber-300";

                  return (
                    <tr
                      key={lead._id}
                      className={`hover:bg-white/[0.03] transition-colors ${
                        isSelected ? "bg-purple-950/20" : ""
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectLead(lead.email)}
                          className="rounded text-purple-500 focus:ring-0 cursor-pointer"
                        />
                      </td>

                      {/* Company & Name */}
                      <td className="p-3">
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <Building className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                          <span className="truncate max-w-[170px]" title={lead.company}>{lead.company}</span>
                        </div>
                        {lead.name && (
                          <p className="text-[10px] text-slate-400 truncate max-w-[170px] pl-5">
                            {lead.name}
                          </p>
                        )}
                      </td>

                      {/* HR Email */}
                      <td className="p-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-purple-300 font-bold select-all truncate max-w-[190px]" title={lead.email}>
                            {lead.email}
                          </span>
                          <button
                            onClick={() => handleCopyEmail(lead.email)}
                            className="text-slate-500 hover:text-white p-1"
                            title="Copy email"
                          >
                            {copiedEmail === lead.email ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                        {lead.mxValid && (
                          <span className="inline-flex items-center gap-1 text-[9px] text-emerald-400">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            <span>MX Verified</span>
                          </span>
                        )}
                      </td>

                      {/* Target Role & Experience */}
                      <td className="p-3">
                        <p className="text-white font-medium truncate max-w-[170px]" title={lead.role}>
                          {lead.role}
                        </p>
                        <p className="text-[10px] text-amber-300/80">
                          {lead.experience || "Any experience"}
                        </p>
                      </td>

                      {/* Location */}
                      <td className="p-3">
                        <span className="inline-flex items-center gap-1 text-slate-300 truncate max-w-[130px]" title={lead.location}>
                          <MapPin className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span className="truncate">{lead.location}</span>
                        </span>
                      </td>

                      {/* Platform */}
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full border text-[10px] font-bold tracking-tight inline-block ${platformBadgeClass}`}>
                          {lead.platform}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        {isContacted ? (
                          <span className="px-2 py-0.5 bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 rounded-full text-[10px] font-bold inline-flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" />
                            <span>Contacted</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-amber-500/15 border border-amber-500/30 text-amber-300 rounded-full text-[10px] font-bold">
                            Discovered
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => setLeadDetailModal(lead)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg"
                            title="View Lead Details / Snippet"
                          >
                            <Eye className="w-3.5 h-3.5 text-cyan-400" />
                          </button>
                          {lead.sourceUrl && (
                            <a
                              href={lead.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg"
                              title="Open original job posting"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-purple-400" />
                            </a>
                          )}
                          <button
                            onClick={() => handleDeleteSingle(lead.email)}
                            className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* Table Pagination Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-white/[0.02] border-t border-white/10 text-xs font-mono">
          <div className="text-slate-400">
            Showing <strong className="text-white">{leads.length}</strong> of <strong className="text-white">{totalCount}</strong> leads
            {selectedLeadEmails.size > 0 && (
              <span className="text-amber-300 ml-2">({selectedLeadEmails.size} selected)</span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-bold flex items-center gap-1 disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              <span>Previous</span>
            </button>

            <span className="px-3 py-1.5 bg-purple-600/20 border border-purple-500/30 rounded-xl text-purple-300 font-bold">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 rounded-xl font-bold flex items-center gap-1 disabled:opacity-30"
            >
              <span>Next</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* 6. MODAL: PREVIEW & CUSTOMIZE EMAIL */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-up">
          <div className="genz-glass-panel rounded-2xl max-w-2xl w-full border border-purple-500/40 p-5 space-y-4 shadow-2xl relative max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-mono font-black text-white">
                  PREVIEW & CUSTOMIZE OUTREACH EMAIL
                </h3>
              </div>
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1 font-bold">EMAIL SUBJECT TEMPLATE</label>
                <input
                  type="text"
                  value={customSubject}
                  onChange={(e) => setCustomSubject(e.target.value)}
                  className="w-full px-3 py-2 genz-input rounded-xl text-white text-xs font-mono font-bold"
                />
                <p className="text-[9px] text-slate-500 mt-1">
                  Variables: {"{{role}}"}, {"{{company}}"}, {"{{candidate_name}}"}, {"{{experience}}"}
                </p>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1 font-bold">EMAIL BODY TEMPLATE</label>
                <textarea
                  rows={8}
                  value={customBody}
                  onChange={(e) => setCustomBody(e.target.value)}
                  className="w-full p-3 genz-input rounded-xl text-white text-xs font-mono leading-relaxed"
                ></textarea>
                <p className="text-[9px] text-slate-500 mt-1">
                  Variables: {"{{name}}"}, {"{{company}}"}, {"{{role}}"}, {"{{candidate_name}}"}, {"{{candidate_email}}"}, {"{{experience}}"}, {"{{ai_pitch}}"}
                </p>
              </div>

              {/* Dynamic Sample Preview */}
              <div className="p-3.5 bg-black/60 rounded-xl border border-cyan-500/30 space-y-2">
                <div className="flex items-center justify-between text-[10px] text-cyan-300 font-bold border-b border-white/10 pb-1">
                  <span>LIVE SAMPLE PREVIEW (FOR {firstSelectedLead.company.toUpperCase()})</span>
                  <span>Sender: {currentCustomer?.name} ({currentCustomer?.email})</span>
                </div>
                <p className="text-slate-300 font-bold text-[11px]">Subject: {previewSubject}</p>
                <div className="text-slate-300 text-[11px] whitespace-pre-line leading-relaxed pl-2 border-l-2 border-cyan-500/40">
                  {previewBody}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setPreviewModalOpen(false)}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-cyan-500 text-white font-mono font-bold text-xs rounded-xl shadow-lg"
              >
                Apply & Save for Dispatch
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: LEAD DETAIL / SNIPPET */}
      {leadDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-up">
          <div className="genz-glass-panel rounded-2xl max-w-lg w-full border border-cyan-500/40 p-5 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-mono font-black text-white">
                  {leadDetailModal.company} - {leadDetailModal.role}
                </h3>
              </div>
              <button
                onClick={() => setLeadDetailModal(null)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5 font-mono text-xs text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">HR Email:</span>
                <span className="text-purple-300 font-bold">{leadDetailModal.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Location:</span>
                <span className="text-cyan-300">{leadDetailModal.location}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Platform:</span>
                <span className="text-amber-300 font-bold">{leadDetailModal.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MX Validity:</span>
                <span className={leadDetailModal.mxValid ? "text-emerald-400 font-bold" : "text-amber-400"}>
                  {leadDetailModal.mxValid ? "Active MX Host" : "Unverified"}
                </span>
              </div>

              {leadDetailModal.snippet && (
                <div className="space-y-1 pt-2">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">JOB SNIPPET / HIRING POST</p>
                  <div className="p-3 bg-black/60 rounded-xl border border-white/10 text-[11px] leading-relaxed max-h-48 overflow-y-auto">
                    {leadDetailModal.snippet}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setLeadDetailModal(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/15 text-white font-mono font-bold text-xs rounded-xl"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: LIVE REAL-TIME DISPATCH TERMINAL */}
      {dispatchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-up">
          <div className="genz-glass-panel rounded-2xl max-w-2xl w-full border border-purple-500/40 p-5 space-y-4 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Terminal className="w-5 h-5 text-purple-400" />
                <h3 className="text-sm font-mono font-black text-white flex items-center gap-2">
                  <span>TARGETED OUTREACH EXECUTION CONSOLE</span>
                  {dispatching && <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />}
                </h3>
              </div>
              {!dispatching && (
                <button
                  onClick={() => setDispatchModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Progress Bar */}
            <div className="space-y-1 font-mono">
              <div className="flex justify-between text-[11px] text-slate-300">
                <span>Dispatch Progress</span>
                <span className="font-bold text-purple-300">
                  {dispatchProgress.current} / {dispatchProgress.total} Leads
                </span>
              </div>
              <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400 transition-all duration-300"
                  style={{
                    width: `${dispatchProgress.total ? (dispatchProgress.current / dispatchProgress.total) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Live Terminal Output */}
            <div className="flex-1 min-h-[220px] max-h-[320px] bg-black/90 rounded-xl p-3.5 font-mono text-[11px] text-emerald-400 space-y-1.5 overflow-y-auto custom-scrollbar border border-white/10">
              {dispatchLogs.map((line, idx) => {
                let colorClass = "text-emerald-400";
                if (line.includes("❌") || line.includes("FATAL") || line.includes("Failed")) {
                  colorClass = "text-rose-400 font-bold";
                } else if (line.includes("⚠️") || line.includes("Notice")) {
                  colorClass = "text-amber-400";
                } else if (line.includes("🚀") || line.includes("Initiating")) {
                  colorClass = "text-cyan-300 font-bold";
                } else if (line.includes("SIMULATION")) {
                  colorClass = "text-purple-300 font-bold";
                }
                return (
                  <div key={idx} className={colorClass}>
                    {line}
                  </div>
                );
              })}
            </div>

            {/* Completion Summary */}
            {dispatchSummary && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-center justify-between text-xs font-mono">
                <div className="space-y-0.5">
                  <p className="text-emerald-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Outreach Batch Execution Completed!</span>
                  </p>
                  <p className="text-[11px] text-slate-300">
                    Dispatched: <strong className="text-white">{dispatchSummary.totalDispatched}</strong> | Failed:{" "}
                    <strong className="text-white">{dispatchSummary.totalFailed}</strong>
                  </p>
                </div>
                <button
                  onClick={() => setDispatchModalOpen(false)}
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-lg text-xs"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
