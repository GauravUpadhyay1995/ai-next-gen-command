"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Search,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  Rocket,
  ArrowLeft,
  Copy,
  Check,
  ExternalLink,
  Filter,
  Globe,
  Briefcase,
  Building,
  Mail,
  Zap,
  Sliders,
  Lock,
  ShieldAlert,
  LogIn,
  CheckSquare,
  Square,
  Send,
  Layers,
  Phone,
  PhoneCall,
  MessageSquare,
  MapPin,
  Compass,
  UserCheck,
  CheckCheck,
  Crown
} from "lucide-react";
import LanguageSelector from "../components/LanguageSelector";
import { useLanguage } from "../context/LanguageContext";

type Lead = {
  id: string;
  email: string;
  name?: string;
  company: string;
  role: string;
  location: string;
  snippet: string;
  sourceUrl: string;
  sourceType: "public_feed" | "google_search" | "job_board" | "company_career" | "b2b_directory" | "b2b_maps";
  postedDate?: string;
  mxValid: boolean;
  mxDetails?: string;
  // B2B specific fields
  category?: string;
  phone?: string;
  whatsappUrl?: string;
  website?: string;
  address?: string;
  city?: string;
  leadType?: "job" | "b2b";
};

const POPULAR_COMPANIES = [
  "Stripe",
  "Razorpay",
  "Vercel",
  "Postman",
  "Figma",
  "Supabase",
  "Linear",
  "GitLab",
  "Zerodha",
  "Automattic",
  "Notion",
];

const POPULAR_KEYWORDS = [
  "React Developer",
  "Fullstack Engineer",
  "Python Developer",
  "DevOps / SRE",
  "UI/UX Designer",
  "Node.js Developer",
];

const POPULAR_B2B_CATEGORIES = [
  "Real Estate Agencies",
  "Digital Marketing Agencies",
  "Dental Clinics & Healthcare",
  "IT & Software Companies",
  "Restaurants & Cafes",
  "Interior Designers & Architects",
  "Gyms & Fitness Centres",
  "Law Firms & Advocates",
  "Hotels & Hospitality",
  "Manufacturing & Exporters",
];

export default function LeadFinderPage() {
  const { t } = useLanguage();

  // Active module persona: 'job_seeker' or 'b2b_lead_finder'
  const [activeModule, setActiveModule] = useState<"job_seeker" | "b2b_lead_finder">("job_seeker");
  const [userCategory, setUserCategory] = useState<"job_seeker" | "b2b_lead_finder" | "all">("job_seeker");
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Job Search States
  const [searchMode, setSearchMode] = useState<"global" | "company">("global");
  const [keyword, setKeyword] = useState("React Developer");
  const [location, setLocation] = useState("Remote");
  const [company, setCompany] = useState("");
  const [source, setSource] = useState<"all" | "public_feed" | "company_career" | "google">("all");

  // B2B Search States
  const [b2bCategory, setB2bCategory] = useState("Real Estate Agencies");
  const [b2bLocation, setB2bLocation] = useState("Mumbai");
  const [phoneOnly, setPhoneOnly] = useState(false);

  // Common UI & Results States
  const [loading, setLoading] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [googleApiKey, setGoogleApiKey] = useState("");
  const [googleCx, setGoogleCx] = useState("");
  const [exporting, setExporting] = useState(false);
  const [pitchPreview, setPitchPreview] = useState<{ [id: string]: string }>({});
  const [generatingPitchId, setGeneratingPitchId] = useState<string | null>(null);

  // Pagination & High-Volume Stream States
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [batchLimit, setBatchLimit] = useState(80);
  const [hasMore, setHasMore] = useState(true);

  // Authentication states
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [checkingAuth, setCheckingAuth] = useState(true);

  // Check auth & user category on mount
  useEffect(() => {
    checkAuthAndInit();
  }, []);

  const checkAuthAndInit = async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch("/api/gmail/status", { cache: "no-store" });
      const data = await res.json();
      if (data.connected) {
        setIsConnected(true);
        setConnectedEmail(data.email || "");
        setIsSuperAdmin(!!data.isOwner);

        const cat = data.customerCategory || (data.isOwner ? "all" : "job_seeker");
        setUserCategory(cat);

        // Auto-select persona according to category (without auto-searching on page load)
        if (cat === "b2b_lead_finder") {
          setActiveModule("b2b_lead_finder");
        } else {
          setActiveModule("job_seeker");
        }
      } else {
        setIsConnected(false);
        setConnectedEmail("");
      }
    } catch {
      setIsConnected(false);
      setConnectedEmail("");
    } finally {
      setCheckingAuth(false);
    }
  };

  // Job Search Handler
  const handleJobSearch = async (overrideCompany?: string, isInitCall?: boolean) => {
    if (!isInitCall && !isConnected) {
      setError("Authentication required. Please connect your Google account.");
      return;
    }

    const targetComp = typeof overrideCompany === "string" ? overrideCompany : company;
    if (!keyword.trim() && !targetComp.trim()) {
      setError("Please enter a job role, keyword, or company to search.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setLeads([]);
      setSelectedLeadIds(new Set());
      setCurrentPage(1);
      setHasMore(true);

      const params = new URLSearchParams({
        mode: "job_seeker",
        keyword: keyword.trim(),
        location: location.trim(),
        source: searchMode === "company" ? "company_career" : source,
        page: "1",
        limit: batchLimit.toString(),
      });

      if (targetComp.trim()) params.append("company", targetComp.trim());
      if (googleApiKey) params.append("googleApiKey", googleApiKey);
      if (googleCx) params.append("googleCx", googleCx);

      const res = await fetch(`/api/leads/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) setIsConnected(false);
        throw new Error(data.message || "Failed to find leads");
      }

      const foundLeads: Lead[] = data.leads || [];
      setLeads(foundLeads);
      const initialSelected = new Set<string>();
      foundLeads.forEach((l) => initialSelected.add(l.id));
      setSelectedLeadIds(initialSelected);

      if (foundLeads.length === 0) {
        setError("No direct email contacts found for this query. Try broader keywords or another company.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while searching.");
    } finally {
      setLoading(false);
    }
  };

  // B2B Lead Search Handler
  const handleB2BSearch = async (overrideCat?: string, overrideLoc?: string, isInitCall?: boolean) => {
    if (!isInitCall && !isConnected) {
      setError("Authentication required. Please connect your Google account.");
      return;
    }

    const targetCat = typeof overrideCat === "string" ? overrideCat : b2bCategory;
    const targetLoc = typeof overrideLoc === "string" ? overrideLoc : b2bLocation;

    if (!targetCat.trim()) {
      setError("Please enter a business category or industry to search.");
      return;
    }

    try {
      setLoading(true);
      setError("");
      setLeads([]);
      setSelectedLeadIds(new Set());
      setCurrentPage(1);
      setHasMore(true);

      const params = new URLSearchParams({
        mode: "b2b_lead_finder",
        category: targetCat.trim(),
        location: targetLoc.trim(),
        limit: batchLimit.toString(),
        page: "1",
      });

      const res = await fetch(`/api/leads/search?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) setIsConnected(false);
        throw new Error(data.message || "Failed to find B2B business leads");
      }

      const foundLeads: Lead[] = data.leads || [];
      setLeads(foundLeads);
      const initialSelected = new Set<string>();
      foundLeads.forEach((l) => initialSelected.add(l.id));
      setSelectedLeadIds(initialSelected);

      if (foundLeads.length === 0) {
        setError("No businesses discovered for this category and location. Try broader categories like 'Real Estate', 'Healthcare', or 'IT'.");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong while searching B2B leads.");
    } finally {
      setLoading(false);
    }
  };

  // High-Volume Multi-Batch Stream Handler
  const handleLoadMore = async () => {
    if (loading || loadingMore || !isConnected) return;

    try {
      setLoadingMore(true);
      setError("");
      const nextPage = currentPage + 1;

      if (activeModule === "b2b_lead_finder") {
        const params = new URLSearchParams({
          mode: "b2b_lead_finder",
          category: b2bCategory.trim() || "Business",
          location: b2bLocation.trim() || "India",
          limit: batchLimit.toString(),
          page: nextPage.toString(),
        });

        const res = await fetch(`/api/leads/search?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.message || "Failed to load more leads");
        }

        const newLeads: Lead[] = data.leads || [];
        if (newLeads.length === 0) {
          setHasMore(false);
          return;
        }

        setLeads((prev) => {
          const existingIds = new Set(prev.map((l) => (l.email || l.company).toLowerCase()));
          const uniqueNew = newLeads.filter((l) => !existingIds.has((l.email || l.company).toLowerCase()));
          return [...prev, ...uniqueNew];
        });

        setSelectedLeadIds((prev) => {
          const updated = new Set(prev);
          newLeads.forEach((l) => updated.add(l.id));
          return updated;
        });

        setCurrentPage(nextPage);
      } else {
        const params = new URLSearchParams({
          mode: "job_seeker",
          keyword: keyword.trim(),
          location: location.trim(),
          source: searchMode === "company" ? "company_career" : source,
          page: nextPage.toString(),
          limit: batchLimit.toString(),
        });

        if (company.trim()) params.append("company", company.trim());
        if (googleApiKey) params.append("googleApiKey", googleApiKey);
        if (googleCx) params.append("googleCx", googleCx);

        const res = await fetch(`/api/leads/search?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        const newLeads: Lead[] = data.leads || [];

        if (newLeads.length === 0) {
          setHasMore(false);
          return;
        }

        setLeads((prev) => {
          const existingIds = new Set(prev.map((l) => (l.email || l.company).toLowerCase()));
          const uniqueNew = newLeads.filter((l) => !existingIds.has((l.email || l.company).toLowerCase()));
          return [...prev, ...uniqueNew];
        });

        setSelectedLeadIds((prev) => {
          const updated = new Set(prev);
          newLeads.forEach((l) => updated.add(l.id));
          return updated;
        });

        setCurrentPage(nextPage);
      }
    } catch (err: any) {
      setError(err.message || "Failed to fetch more leads.");
    } finally {
      setLoadingMore(false);
    }
  };

  const copyToClipboard = (text: string, isPhone?: boolean) => {
    navigator.clipboard.writeText(text);
    if (isPhone) {
      setCopiedPhone(text);
      setTimeout(() => setCopiedPhone(null), 2000);
    } else {
      setCopiedEmail(text);
      setTimeout(() => setCopiedEmail(null), 2000);
    }
  };

  const exportToExcel = () => {
    if (leads.length === 0) return;
    try {
      setExporting(true);
      const leadsToExport = leads.filter((l) =>
        selectedLeadIds.size > 0 ? selectedLeadIds.has(l.id) : true
      );

      if (activeModule === "b2b_lead_finder") {
        const exportData = leadsToExport.map((l, index) => ({
          "S.No": index + 1,
          "Company / Business Name": l.company,
          "Industry / Category": l.category || l.role,
          "Phone Number": l.phone || "Not Listed",
          "WhatsApp Link": l.whatsappUrl || "",
          "Official Email": l.email,
          "Website URL": l.website || l.sourceUrl,
          "City / Location": l.city || l.location,
          "MX Valid": l.mxValid ? "YES" : "NO",
          Overview: l.snippet,
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "B2B_Business_Leads");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const dataBlob = new Blob([excelBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });

        saveAs(dataBlob, `B2B_Leads_${b2bCategory.replace(/\s+/g, "_")}_${b2bLocation}.xlsx`);
      } else {
        const exportData = leadsToExport.map((l, index) => ({
          "S.No": index + 1,
          Email: l.email,
          Company: l.company,
          Role: l.role,
          Location: l.location,
          "MX Valid": l.mxValid ? "YES" : "NO",
          "Source Type": l.sourceType,
          "Source URL": l.sourceUrl,
          "Posted Date": l.postedDate || "",
          Snippet: l.snippet,
        }));

        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hiring_Leads");

        const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const dataBlob = new Blob([excelBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8",
        });

        saveAs(dataBlob, `Hiring_Leads_${keyword.replace(/\s+/g, "_")}.xlsx`);
      }
    } catch (e: any) {
      setError("Export failed: " + e.message);
    } finally {
      setExporting(false);
    }
  };

  const generatePitchForLead = async (lead: Lead) => {
    try {
      setGeneratingPitchId(lead.id);
      const res = await fetch("/api/ai/personalize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: lead.company,
          role: lead.role,
          category: lead.category,
          snippet: lead.snippet,
          location: lead.location,
          pitchType: activeModule === "b2b_lead_finder" ? "b2b_sales" : "job_application",
        }),
      });
      const data = await res.json();
      if (data.success && data.pitch) {
        setPitchPreview((prev) => ({ ...prev, [lead.id]: data.pitch }));
      }
    } catch (e: any) {
      console.error("Failed to generate AI pitch:", e);
    } finally {
      setGeneratingPitchId(null);
    }
  };

  const toggleLeadSelection = (id: string) => {
    setSelectedLeadIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      const next = new Set<string>();
      filteredLeads.forEach((l) => next.add(l.id));
      setSelectedLeadIds(next);
    }
  };

  const launchCampaignWithLeads = () => {
    const targetPool = leads.filter((l) =>
      selectedLeadIds.size > 0 ? selectedLeadIds.has(l.id) : true
    );
    const listToLoad = (verifiedOnly ? targetPool.filter((l) => l.mxValid) : targetPool).map((l) => ({
      email: l.email,
      name: l.company,
      company: l.company,
      role: l.role,
      phone: l.phone || "",
      ai_pitch: pitchPreview[l.id] || "",
      snippet: l.snippet || "",
      subject:
        activeModule === "b2b_lead_finder"
          ? `Partnership & Growth Proposal for ${l.company}`
          : `Application for ${l.role} - Outreach`,
    }));

    if (listToLoad.length === 0) {
      setError("No valid leads selected to launch campaign.");
      return;
    }

    sessionStorage.setItem("auto_loaded_contacts", JSON.stringify(listToLoad));
    window.location.href = "/bulk-emails?source=lead_finder";
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const q = searchTerm.toLowerCase();
      const matchesSearch =
        lead.email.toLowerCase().includes(q) ||
        lead.company.toLowerCase().includes(q) ||
        lead.role.toLowerCase().includes(q) ||
        (lead.phone && lead.phone.includes(q)) ||
        (lead.city && lead.city.toLowerCase().includes(q)) ||
        lead.snippet.toLowerCase().includes(q);

      const matchesVerified = !verifiedOnly || lead.mxValid;
      const matchesPhone = !phoneOnly || !!lead.phone;

      return matchesSearch && matchesVerified && matchesPhone;
    });
  }, [leads, searchTerm, verifiedOnly, phoneOnly]);

  const stats = useMemo(() => {
    const total = leads.length;
    const verified = leads.filter((l) => l.mxValid).length;
    const withPhone = leads.filter((l) => !!l.phone).length;
    const uniqueCompanies = new Set(leads.map((l) => l.company)).size;
    const verifiedRate = total > 0 ? Math.round((verified / total) * 100) : 0;
    return { total, verified, withPhone, uniqueCompanies, verifiedRate };
  }, [leads]);

  const getSourceBadge = (lead: Lead) => {
    if (lead.sourceType === "b2b_maps" || lead.id.startsWith("b2b_osm")) {
      return { label: "🗺️ Registered Entity", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
    }
    if (lead.sourceType === "b2b_directory" || lead.id.startsWith("b2b_ddg")) {
      return { label: "🌐 Verified Website", color: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30" };
    }
    if (lead.id.startsWith("career_") || lead.sourceType === "company_career") {
      return { label: "🏢 Direct Career Portal", color: "bg-amber-500/15 text-amber-300 border-amber-500/30" };
    }
    if (lead.sourceUrl.includes("linkedin.com") || lead.id.startsWith("feed_linkedin")) {
      return { label: "LinkedIn", color: "bg-sky-500/15 text-sky-300 border-sky-500/30" };
    }
    if (lead.id.startsWith("feed_wwr")) {
      return { label: "WeWorkRemotely", color: "bg-red-500/15 text-red-300 border-red-500/30" };
    }
    if (lead.id.startsWith("feed_himalayas")) {
      return { label: "Himalayas", color: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30" };
    }
    if (lead.id.startsWith("feed_remotive")) {
      return { label: "Remotive", color: "bg-teal-500/15 text-teal-300 border-teal-500/30" };
    }
    return { label: "Verified Feed", color: "bg-purple-500/15 text-purple-300 border-purple-500/30" };
  };

  // Auth Loading State
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col items-center justify-center p-6 font-sans">
        <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 backdrop-blur-xl flex flex-col items-center gap-4 shadow-2xl">
          <Loader2 className="w-9 h-9 text-emerald-400 animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-200">Verifying Authentication & Persona</p>
            <p className="text-xs text-slate-500">Loading your customized search module...</p>
          </div>
        </div>
      </div>
    );
  }

  // Auth Guard Barrier
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#070a12] text-slate-100 flex flex-col justify-between p-6 sm:p-12 font-sans relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[40rem] h-[25rem] bg-emerald-500/10 rounded-full filter blur-[140px]"></div>
        </div>

        <div className="relative z-10 max-w-lg mx-auto w-full my-auto space-y-6 animate-fade-up">
          <div className="rounded-3xl p-8 sm:p-10 bg-slate-900/80 border border-slate-800/90 backdrop-blur-2xl text-center space-y-5 shadow-2xl">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-8 h-8 text-rose-400" />
            </div>

            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/10 border border-rose-500/25 rounded-full text-rose-300 text-xs font-medium">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Authentication Required</span>
              </div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                Lead Finder is Locked
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Connect your verified Google account to access your assigned search module (Job Hunter Feeds or B2B Company & Contact Scanner).
              </p>
            </div>

            <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80 text-left text-xs space-y-2 text-slate-300">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Available Features by Category</span>
              </div>
              <p className="text-slate-400 pl-6">• 🧑‍💻 Job Seeker: 18+ Live Feeds, ATS Scanners, Recruiter Inboxes</p>
              <p className="text-slate-400 pl-6">• 🏢 B2B Lead Fetcher: Company Phone Numbers, WhatsApp & Emails</p>
              <p className="text-slate-400 pl-6">• Real-time Server DNS MX Verification</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => (window.location.href = "/api/auth/google")}
                className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Connect Google Account</span>
              </button>
              <Link
                href="/"
                className="px-5 py-3 rounded-xl bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a12] text-slate-100 font-sans flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Ambient background lighting */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute -top-32 left-1/3 w-[45rem] h-[30rem] bg-emerald-500/5 rounded-full filter blur-[150px]"></div>
        <div className="absolute top-1/2 right-10 w-[35rem] h-[30rem] bg-cyan-600/5 rounded-full filter blur-[160px]"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto w-full space-y-4">
        {/* Top Navbar */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-3 border-b border-slate-800/70">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium transition-all shadow-sm self-start"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-slate-400" />
              <span>Command Station</span>
            </Link>

            <div className="flex items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                {activeModule === "b2b_lead_finder" ? "B2B Business Lead Finder" : "Hiring Lead Finder"}
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-[11px] font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                {activeModule === "b2b_lead_finder" ? "B2B Scanner Active" : "18 Feeds Active"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            {/* Category / Persona Indicator */}
            <div className="px-3 py-1.5 rounded-lg bg-slate-900/70 border border-slate-800 text-slate-300 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${activeModule === "b2b_lead_finder" ? "bg-amber-400" : "bg-emerald-400"}`}></span>
              <span className="truncate max-w-[170px] font-mono text-[11px]">
                {userCategory === "b2b_lead_finder" ? "🏢 B2B Client Tier" : userCategory === "all" ? "👑 Dual / Superadmin" : "🧑‍💻 Job Seeker Tier"}
              </span>
            </div>

            {/* Superadmin Console Direct Link */}
            {isSuperAdmin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 hover:text-white font-mono font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-sm"
                title="Superadmin Autopilot & Customer Management Console"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span>Superadmin</span>
              </Link>
            )}

            <LanguageSelector />

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="px-3 py-1.5 rounded-lg bg-slate-900/70 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>Settings</span>
            </button>

            <button
              onClick={exportToExcel}
              disabled={leads.length === 0 || exporting}
              className="px-3.5 py-1.5 rounded-lg bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-emerald-400 font-medium flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export XLSX</span>
            </button>

            <button
              onClick={launchCampaignWithLeads}
              disabled={leads.length === 0 || selectedLeadIds.size === 0}
              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold shadow-md shadow-emerald-500/15 flex items-center gap-1.5 disabled:opacity-40 transition-all cursor-pointer"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>Launch Campaign ({selectedLeadIds.size})</span>
            </button>
          </div>
        </header>

        {/* Dual / Superadmin Mode Switcher Tabs (Only if userCategory is 'all' or Superadmin) */}
        {(userCategory === "all" || isSuperAdmin) && (
          <div className="flex items-center justify-between p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-md">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => {
                  setActiveModule("job_seeker");
                  setLeads([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeModule === "job_seeker"
                    ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Briefcase className="w-4 h-4" />
                <span>1. Job Seeker Module (Hiring Feeds & ATS)</span>
              </button>

              <button
                onClick={() => {
                  setActiveModule("b2b_lead_finder");
                  setLeads([]);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                  activeModule === "b2b_lead_finder"
                    ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                <Building className="w-4 h-4" />
                <span>2. B2B Lead Fetcher Module (Company, Phone & Biz Leads)</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 pr-3 font-mono">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Dual Category Enabled</span>
            </div>
          </div>
        )}

        {/* Optional Custom Google Search Key Settings Drawer */}
        {showSettings && (
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 animate-fade-up text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-slate-200 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-emerald-400" />
                Custom Search Engine API (Optional / Advanced)
              </span>
              <span className="text-[11px] text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20 font-medium">
                Note: Google deprecated Custom Search API for new GCP projects on Jan 20, 2026
              </span>
            </div>
            <p className="text-slate-400 leading-relaxed text-[11px]">
              FetchMail automatically queries 18+ live global hiring streams, direct ATS portals, and OpenStreetMap business registries with server-side MX validation without needing any API key. If you own a legacy Google project, you can optionally configure it here:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">GOOGLE API KEY</label>
                <input
                  type="password"
                  placeholder="AIzaSy... (optional)"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">SEARCH ENGINE ID (CX)</label>
                <input
                  type="text"
                  placeholder="017576... (optional)"
                  value={googleCx}
                  onChange={(e) => setGoogleCx(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 text-xs focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* ==================================================== */}
        {/* MODULE 1: B2B BUSINESS & DIRECTORY DISCOVERY SEARCH  */}
        {/* ==================================================== */}
        {activeModule === "b2b_lead_finder" && (
          <section className="sticky top-2 sm:top-3 z-30 rounded-2xl p-3.5 sm:p-4 bg-slate-900/95 backdrop-blur-xl border border-amber-500/30 shadow-2xl shadow-black/70 space-y-3 transition-all">
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>B2B Business & Client Discovery</span>
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  Deep-scanning company contacts, phone numbers & verified mailboxes
                </span>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
                <span>Real-time Phone & Email Extraction</span>
              </div>
            </div>

            {/* B2B Form Inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1">
                <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>Target Business Category / Industry</span>
                </label>
                <input
                  type="text"
                  value={b2bCategory}
                  onChange={(e) => setB2bCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleB2BSearch()}
                  placeholder="e.g. Real Estate, Digital Marketing, Dental Clinics, IT Companies"
                  className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-4 space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Target City / Country</span>
                </label>
                <input
                  type="text"
                  value={b2bLocation}
                  onChange={(e) => setB2bLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleB2BSearch()}
                  placeholder="e.g. Mumbai, Delhi NCR, Bangalore, Dubai, London"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none transition-all"
                />
              </div>

              <div className="sm:col-span-2">
                <button
                  onClick={() => handleB2BSearch()}
                  disabled={loading}
                  className="w-full py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-400/20 flex items-center justify-center gap-2 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? "Scanning..." : "Find B2B Leads"}</span>
                </button>
              </div>
            </div>

            {/* Quick B2B Category Chips & Batch Limit Selector */}
            <div className="pt-2 border-t border-slate-800/50 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Target Categories:</span>
                {POPULAR_B2B_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setB2bCategory(cat);
                      handleB2BSearch(cat);
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all cursor-pointer ${
                      b2bCategory.toLowerCase() === cat.toLowerCase()
                        ? "bg-amber-500/20 text-amber-300 border-amber-400 font-medium"
                        : "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Batch Size Selection */}
              <div className="flex items-center gap-1.5 shrink-0 self-end lg:self-center">
                <span className="text-[11px] text-slate-500">Batch Stream:</span>
                {[40, 80, 120].map((limitOption) => (
                  <button
                    key={limitOption}
                    type="button"
                    onClick={() => setBatchLimit(limitOption)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold border transition-all ${
                      batchLimit === limitOption
                        ? "bg-amber-400 text-slate-950 border-amber-400 shadow-sm"
                        : "bg-slate-950 text-slate-400 hover:text-slate-200 border-slate-800"
                    }`}
                  >
                    {limitOption} Leads
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ==================================================== */}
        {/* MODULE 2: JOB SEEKER / CAREER FEEDS SEARCH DECK     */}
        {/* ==================================================== */}
        {activeModule === "job_seeker" && (
          <section className="sticky top-2 sm:top-3 z-30 rounded-2xl p-3.5 sm:p-4 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 shadow-2xl shadow-black/70 space-y-3 transition-all">
            {/* Mode Switcher Tabs */}
            <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-slate-800/60">
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-slate-950 border border-slate-800/80">
                <button
                  type="button"
                  onClick={() => setSearchMode("global")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    searchMode === "global"
                      ? "bg-slate-800 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Search All 18+ Feeds</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSearchMode("company")}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                    searchMode === "company"
                      ? "bg-slate-800 text-white font-semibold shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  <Building className="w-3.5 h-3.5 text-amber-400" />
                  <span>Direct Company & ATS Scanner</span>
                </button>
              </div>

              <div className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                <Zap className="w-3.5 h-3.5 text-emerald-400" />
                <span>Real-time DNS MX Verified</span>
              </div>
            </div>

            {/* Form Inputs Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className={`${searchMode === "company" ? "sm:col-span-4" : "sm:col-span-5"} space-y-1`}>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Job Role / Target Keywords</span>
                </label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJobSearch()}
                  placeholder="e.g. React Developer, Fullstack, SRE, Designer"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 focus:outline-none transition-all"
                />
              </div>

              {searchMode === "company" ? (
                <div className="sm:col-span-4 space-y-1">
                  <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-amber-400" />
                    <span>Target Company Domain / Name</span>
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJobSearch()}
                    placeholder="e.g. Stripe, Razorpay, Vercel, Postman"
                    className="w-full px-3 py-2 bg-slate-950 border border-amber-500/40 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-amber-400 focus:outline-none transition-all"
                  />
                </div>
              ) : null}

              <div className={`${searchMode === "company" ? "sm:col-span-2" : "sm:col-span-3"} space-y-1`}>
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Location</span>
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJobSearch()}
                  placeholder="e.g. Remote, India, US"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/20 focus:outline-none transition-all"
                />
              </div>

              {searchMode === "global" ? (
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                    <Filter className="w-3.5 h-3.5 text-purple-400" />
                    <span>Feed Source</span>
                  </label>
                  <select
                    value={source}
                    onChange={(e) => setSource(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:border-purple-500 focus:outline-none transition-all cursor-pointer"
                  >
                    <option value="all">All 18+ Feeds</option>
                    <option value="public_feed">Verified Job Feeds</option>
                    <option value="company_career">Direct ATS Portals</option>
                    <option value="google">Legacy Google Search</option>
                  </select>
                </div>
              ) : null}

              <div className="sm:col-span-2">
                <button
                  onClick={() => handleJobSearch()}
                  disabled={loading}
                  className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-40 transition-all cursor-pointer"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? "Searching..." : "Find Leads"}</span>
                </button>
              </div>
            </div>

            {/* Quick-select chips */}
            <div className="pt-2 border-t border-slate-800/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-slate-500 font-medium mr-1">Quick Queries:</span>
                {POPULAR_KEYWORDS.map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => {
                      setKeyword(kw);
                      handleJobSearch();
                    }}
                    className={`px-2.5 py-0.5 rounded-lg text-[11px] border transition-all cursor-pointer ${
                      keyword.toLowerCase() === kw.toLowerCase()
                        ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40 font-medium"
                        : "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {kw}
                  </button>
                ))}
              </div>

              {searchMode === "company" && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-slate-500 font-medium mr-1">Top Tech ATS:</span>
                  {POPULAR_COMPANIES.slice(0, 6).map((compName) => (
                    <button
                      key={compName}
                      type="button"
                      onClick={() => {
                        setCompany(compName);
                        handleJobSearch(compName);
                      }}
                      className={`px-2 py-0.5 rounded-lg text-[11px] border transition-all cursor-pointer ${
                        company.toLowerCase() === compName.toLowerCase()
                          ? "bg-amber-500/20 border-amber-400 text-amber-300 font-medium"
                          : "bg-slate-950 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200"
                      }`}
                    >
                      {compName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Error Alert */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5 animate-fade-up">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* ==================================================== */}
        {/* KPI TELEMETRY BANNER (COMPACT PILLS)                */}
        {/* ==================================================== */}
        {leads.length > 0 && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 animate-fade-up">
            {/* Stat 1: Total Leads / Businesses */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg ${activeModule === "b2b_lead_finder" ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"} border flex items-center justify-center shrink-0`}>
                  {activeModule === "b2b_lead_finder" ? <Building className="w-4 h-4 text-amber-400" /> : <Mail className="w-4 h-4 text-emerald-400" />}
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none">
                    {activeModule === "b2b_lead_finder" ? "Businesses Found" : "Total Leads"}
                  </p>
                  <p className="text-base sm:text-lg font-bold text-white mt-1 leading-none">{stats.total}</p>
                </div>
              </div>
            </div>

            {/* Stat 2: Phones Found (B2B) OR MX Verified (Jobs) */}
            {activeModule === "b2b_lead_finder" ? (
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                    <PhoneCall className="w-4 h-4 text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none">Phone & WhatsApp</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-400 mt-1 leading-none">{stats.withPhone}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none">MX Verified</p>
                    <div className="flex items-baseline gap-1.5 mt-1 leading-none">
                      <span className="text-base sm:text-lg font-bold text-emerald-400">{stats.verified}</span>
                      <span className="text-[11px] text-emerald-400/80 font-medium">({stats.verifiedRate}%)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Stat 3: MX Verified Inboxes */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between shadow-sm">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                  <Mail className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider leading-none">
                    {activeModule === "b2b_lead_finder" ? "Official Inboxes" : "Companies"}
                  </p>
                  <p className="text-base sm:text-lg font-bold text-white mt-1 leading-none">
                    {activeModule === "b2b_lead_finder" ? stats.verified : stats.uniqueCompanies}
                  </p>
                </div>
              </div>
            </div>

            {/* Stat 4: Filter Toggle Pill */}
            <div className="px-3.5 py-2.5 rounded-xl bg-slate-900/70 border border-slate-800/80 flex items-center justify-between shadow-sm">
              <label className="flex items-center gap-2.5 cursor-pointer select-none w-full justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={activeModule === "b2b_lead_finder" ? phoneOnly : verifiedOnly}
                    onChange={(e) => {
                      if (activeModule === "b2b_lead_finder") setPhoneOnly(e.target.checked);
                      else setVerifiedOnly(e.target.checked);
                    }}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer accent-emerald-500"
                  />
                  <div>
                    <p className="text-[10px] text-slate-300 font-semibold uppercase tracking-wider leading-none">
                      {activeModule === "b2b_lead_finder" ? "Phone Filter" : "Filter Verified"}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 leading-none">
                      {activeModule === "b2b_lead_finder"
                        ? phoneOnly ? "With Phone Numbers Only" : "All Businesses"
                        : verifiedOnly ? "Active MX Only" : "All Leads"}
                    </p>
                  </div>
                </div>
                <div className="w-8 h-8 rounded-lg bg-slate-800/80 border border-slate-700/60 flex items-center justify-center shrink-0">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </label>
            </div>
          </section>
        )}

        {/* ==================================================== */}
        {/* DISCOVERED LEADS WORKSPACE                           */}
        {/* ==================================================== */}
        <section className="rounded-2xl bg-slate-900/60 border border-slate-800 shadow-xl overflow-hidden flex flex-col space-y-4 p-4 sm:p-5">
          {/* Action and Search Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800/70">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={filteredLeads.length === 0}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white font-medium px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 transition-all cursor-pointer disabled:opacity-40"
              >
                {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Square className="w-4 h-4 text-slate-500" />
                )}
                <span>
                  {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0
                    ? "Deselect All"
                    : `Select All (${filteredLeads.length})`}
                </span>
              </button>

              <span className="text-xs text-slate-400">
                Showing <strong className="text-white">{filteredLeads.length}</strong> {activeModule === "b2b_lead_finder" ? "businesses" : "recipients"}
              </span>
            </div>

            <div className="relative min-w-[240px]">
              <input
                type="text"
                placeholder={
                  activeModule === "b2b_lead_finder"
                    ? "Search by company, phone, category, email..."
                    : "Search leads by role, email, company..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs pl-8 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {filteredLeads.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-center">
                  <Search className="w-6 h-6 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-200">
                    {loading
                      ? activeModule === "b2b_lead_finder"
                        ? "Scanning B2B Directories, Contact Pages & Maps..."
                        : "Searching 18+ Live Streams & ATS Portals..."
                      : "No Leads Discovered"}
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {loading
                      ? "Extracting verified emails, direct phone numbers, and company overview..."
                      : activeModule === "b2b_lead_finder"
                      ? "Try searching different categories like 'Real Estate', 'Doctors', 'Gyms', or a broader city."
                      : "Try broader keywords like 'Developer', 'Designer', or switch to Direct ATS Scan."}
                  </p>
                </div>
              </div>
            ) : (
              filteredLeads.map((lead, idx) => {
                const sourceBadge = getSourceBadge(lead);
                const isSelected = selectedLeadIds.has(lead.id);

                return (
                  <div
                    key={lead.id ? `${lead.id}-${idx}` : `lead-${lead.email || idx}-${idx}`}
                    className={`rounded-xl p-4 border transition-all ${
                      isSelected
                        ? "bg-slate-900/90 border-slate-700 shadow-md"
                        : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700/80"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Checkbox & Info */}
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleLeadSelection(lead.id)}
                          className="mt-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Header badges */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-bold text-white text-sm tracking-tight flex items-center gap-1.5">
                              {lead.company}
                            </span>

                            <span className="px-2.5 py-0.5 rounded-md bg-slate-800/90 border border-slate-700/80 text-slate-300 font-medium text-[11px]">
                              {lead.category || lead.role}
                            </span>

                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${sourceBadge.color}`}>
                              {sourceBadge.label}
                            </span>

                            {lead.mxValid ? (
                              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                Active MX
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[10px] font-medium flex items-center gap-1">
                                <AlertCircle className="w-3 h-3 text-rose-400" />
                                Unverified
                              </span>
                            )}

                            <span className="text-slate-400 text-[11px] flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-slate-500" />
                              {lead.city || lead.location}
                            </span>
                          </div>

                          {/* Contact Details Line (Phone & Email) */}
                          <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                            {/* Phone Number Pill with 1-Click Call & WhatsApp */}
                            {lead.phone && (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${lead.phone.replace(/\s+/g, "")}`}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                                  title="Click to Call"
                                >
                                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{lead.phone}</span>
                                </a>

                                {lead.whatsappUrl && (
                                  <a
                                    href={lead.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-400 text-xs font-medium flex items-center gap-1 transition-all"
                                    title="Direct WhatsApp Chat"
                                  >
                                    <MessageSquare className="w-3 h-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(lead.phone || "", true)}
                                  className="p-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs transition-all"
                                  title="Copy Phone"
                                >
                                  {copiedPhone === lead.phone ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              </div>
                            )}

                            {/* Email Pill */}
                            <div className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{lead.email}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => copyToClipboard(lead.email)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                            >
                              {copiedEmail === lead.email ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy Email</span>
                                </>
                              )}
                            </button>

                            {/* Website / Source Link */}
                            {(lead.website || lead.sourceUrl) && (
                              <a
                                href={lead.website || lead.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium flex items-center gap-1 transition-all"
                              >
                                <span>{activeModule === "b2b_lead_finder" ? "Visit Website" : "View Posting"}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {/* Snippet / Description */}
                          {lead.snippet && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1">
                              {lead.snippet}
                            </p>
                          )}

                          {/* AI Generated Pitch preview */}
                          {pitchPreview[lead.id] && (
                            <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 space-y-1 animate-fade-up">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-400">
                                <span className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  {activeModule === "b2b_lead_finder" ? "AI B2B Proposal Draft" : "AI Application Pitch Draft"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(pitchPreview[lead.id])}
                                  className="text-slate-400 hover:text-slate-200"
                                >
                                  Copy Pitch
                                </button>
                              </div>
                              <p className="italic text-slate-300 leading-relaxed font-sans">
                                &ldquo;{pitchPreview[lead.id]}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Pitch Generator Action */}
                      <div className="flex md:flex-col items-center gap-2 shrink-0 self-end md:self-start">
                        <button
                          type="button"
                          onClick={() => generatePitchForLead(lead)}
                          disabled={generatingPitchId === lead.id}
                          className="px-3 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:text-purple-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                        >
                          {generatingPitchId === lead.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-400" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                          )}
                          <span>
                            {generatingPitchId === lead.id
                              ? "Drafting..."
                              : activeModule === "b2b_lead_finder"
                              ? "Generate Proposal"
                              : "Generate AI Pitch"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Load More / Next Batch Pagination Bar */}
            {filteredLeads.length > 0 && (
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800/80">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>
                    Showing <strong className="text-white">{filteredLeads.length}</strong> {activeModule === "b2b_lead_finder" ? "Businesses" : "Job Postings"} • Page {currentPage}
                  </span>
                </div>

                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore || loading}
                    className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-emerald-500 hover:from-amber-400 hover:to-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                        <span>Scanning Next Stream Batch...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-slate-950 fill-current" />
                        <span>Load Next Batch (+{batchLimit} Leads)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic">All available matching leads loaded for this search.</span>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
