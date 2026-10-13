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
  Layers,
  PhoneCall,
  MessageSquare,
  MapPin,
  Crown,
  X
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

        // Auto-select persona according to category
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
      return { label: "Registered Entity", color: "bg-amber-500/10 text-amber-300 border-amber-500/20" };
    }
    if (lead.sourceType === "b2b_directory" || lead.id.startsWith("b2b_ddg")) {
      return { label: "Verified Website", color: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20" };
    }
    if (lead.id.startsWith("career_") || lead.sourceType === "company_career") {
      return { label: "Direct Career Portal", color: "bg-indigo-500/10 text-indigo-300 border-indigo-500/20" };
    }
    if (lead.sourceUrl.includes("linkedin.com") || lead.id.startsWith("feed_linkedin")) {
      return { label: "LinkedIn", color: "bg-sky-500/10 text-sky-300 border-sky-500/20" };
    }
    if (lead.id.startsWith("feed_wwr")) {
      return { label: "WeWorkRemotely", color: "bg-rose-500/10 text-rose-300 border-rose-500/20" };
    }
    if (lead.id.startsWith("feed_himalayas")) {
      return { label: "Himalayas", color: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20" };
    }
    if (lead.id.startsWith("feed_remotive")) {
      return { label: "Remotive", color: "bg-teal-500/10 text-teal-300 border-teal-500/20" };
    }
    return { label: "Verified Feed", color: "bg-violet-500/10 text-violet-300 border-violet-500/20" };
  };

  // Auth Loading State
  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-6">
        <div className="p-8 rounded-2xl bg-[#111726] border border-slate-800 flex flex-col items-center gap-4 shadow-xl">
          <Loader2 className="w-8 h-8 text-indigo-400 animate-spin" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-slate-200">Checking Access...</p>
            <p className="text-xs text-slate-400">Loading your search workspace</p>
          </div>
        </div>
      </div>
    );
  }

  // Auth Guard Barrier
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col justify-center items-center p-6">
        <div className="max-w-md w-full bg-[#111726] border border-slate-800 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="w-14 h-14 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto text-rose-400">
            <Lock className="w-7 h-7" />
          </div>

          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Connect Google Account
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
              Connect your verified Google account to discover live recruiter emails, direct hiring feeds, and company contacts.
            </p>
          </div>

          <div className="p-4 bg-slate-900 rounded-xl border border-slate-800 text-left text-xs space-y-2 text-slate-300">
            <p className="font-semibold text-white flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Features Included:</span>
            </p>
            <p className="text-slate-400 pl-5">• 18+ Live Hiring Feeds & Direct ATS Portals</p>
            <p className="text-slate-400 pl-5">• Verified Recruiter Mailboxes & DNS MX Check</p>
            <p className="text-slate-400 pl-5">• 1-Click Export to Excel & Campaign Launcher</p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => (window.location.href = "/api/auth/google")}
              className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
            >
              Connect with Google
            </button>
            <Link
              href="/"
              className="px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 pb-16">
      {/* Top Subtle Ambient Glow */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[800px] h-[250px] bg-indigo-600/10 blur-[130px] pointer-events-none -z-10" />

      <div className="max-w-[1360px] mx-auto px-4 sm:px-6 pt-6 space-y-5">
        
        {/* ==================================================== */}
        {/* TOP HEADER (Ultra-Clean & Minimalist)               */}
        {/* ==================================================== */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 text-xs font-medium transition-all shrink-0"
              title="Return to Main Dashboard"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back</span>
            </Link>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-white tracking-tight">
                  {activeModule === "b2b_lead_finder" ? "B2B Lead Finder" : "Hiring Lead Finder"}
                </h1>
                <span className="w-2 h-2 rounded-full bg-emerald-400" title="System Live" />
              </div>
              <p className="text-xs text-slate-400">
                {activeModule === "b2b_lead_finder"
                  ? "Discover verified business contacts, phone numbers & company decision-makers"
                  : "Discover verified recruiter inboxes and direct company hiring feeds"}
              </p>
            </div>
          </div>

          {/* Clean Controls Strip */}
          <div className="flex items-center gap-2.5 text-xs">
            {/* Simple Segmented Mode Switcher */}
            {(userCategory === "all" || isSuperAdmin) && (
              <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule("job_seeker");
                    setLeads([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeModule === "job_seeker"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Job Seeker</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveModule("b2b_lead_finder");
                    setLeads([]);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                    activeModule === "b2b_lead_finder"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>B2B Businesses</span>
                </button>
              </div>
            )}

            {isSuperAdmin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-violet-300 hover:text-white text-xs font-medium flex items-center gap-1.5 transition-all"
                title="SuperAdmin Console"
              >
                <Crown className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            )}

            <LanguageSelector />

            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition-all cursor-pointer"
              title="Search Settings"
            >
              <Sliders className="w-4 h-4" />
            </button>

            {leads.length > 0 && selectedLeadIds.size > 0 && (
              <button
                onClick={launchCampaignWithLeads}
                className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-indigo-950/50 transition-all cursor-pointer"
              >
                <Rocket className="w-3.5 h-3.5" />
                <span>Launch ({selectedLeadIds.size})</span>
              </button>
            )}
          </div>
        </header>

        {/* Optional Search Settings Drawer */}
        {showSettings && (
          <div className="bg-[#111726] border border-slate-800 rounded-2xl p-4 space-y-3 animate-in fade-in text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                Custom Search Engine API (Optional)
              </span>
              <button onClick={() => setShowSettings(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-slate-400 text-xs leading-relaxed">
              FetchMail automatically queries 18+ live global hiring streams, direct ATS portals, and OpenStreetMap business registries without requiring any API key. If you have your own Google Custom Search API, you can specify it here:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">GOOGLE API KEY</label>
                <input
                  type="password"
                  placeholder="AIzaSy... (optional)"
                  value={googleApiKey}
                  onChange={(e) => setGoogleApiKey(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 font-medium block mb-1">SEARCH ENGINE ID (CX)</label>
                <input
                  type="text"
                  placeholder="017576... (optional)"
                  value={googleCx}
                  onChange={(e) => setGoogleCx(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* Global Error Banner */}
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

        {/* ==================================================== */}
        {/* SEARCH DECK (Clean & Intuitive)                     */}
        {/* ==================================================== */}
        <section className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
          
          {/* Active Persona Header / Mode Selector */}
          {activeModule === "job_seeker" ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center p-1 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSearchMode("global")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    searchMode === "global"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Search All 18+ Feeds</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSearchMode("company")}
                  className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                    searchMode === "company"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Building className="w-3.5 h-3.5" />
                  <span>Target Company ATS Scanner</span>
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>DNS MX Mailbox Verification Enabled</span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Building className="w-4 h-4 text-indigo-400" />
                <span>B2B Business Directory & Direct Contacts</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                <span>Direct Phone & WhatsApp Extraction</span>
              </div>
            </div>
          )}

          {/* Form Input Row */}
          {activeModule === "job_seeker" ? (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className={`${searchMode === "company" ? "sm:col-span-4" : "sm:col-span-5"} space-y-1.5`}>
                <label className="text-xs font-medium text-slate-300 block">Job Role or Keywords *</label>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJobSearch()}
                  placeholder="e.g. React Developer, Node.js, UI Designer"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {searchMode === "company" && (
                <div className="sm:col-span-4 space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 block">Target Company Name *</label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJobSearch()}
                    placeholder="e.g. Stripe, Razorpay, Vercel, Postman"
                    className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              <div className={`${searchMode === "company" ? "sm:col-span-2" : "sm:col-span-4"} space-y-1.5`}>
                <label className="text-xs font-medium text-slate-300 block">Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJobSearch()}
                  placeholder="e.g. Remote, India, US"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  onClick={() => handleJobSearch()}
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? "Searching 18+ Feeds..." : "Find Recruiter Leads"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
              <div className="sm:col-span-6 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">Industry or Category *</label>
                <input
                  type="text"
                  value={b2bCategory}
                  onChange={(e) => setB2bCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleB2BSearch()}
                  placeholder="e.g. Real Estate, Digital Marketing, Dental Clinics"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-3 space-y-1.5">
                <label className="text-xs font-medium text-slate-300 block">City or Region</label>
                <input
                  type="text"
                  value={b2bLocation}
                  onChange={(e) => setB2bLocation(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleB2BSearch()}
                  placeholder="e.g. Mumbai, Delhi, Bangalore"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="sm:col-span-3">
                <button
                  onClick={() => handleB2BSearch()}
                  disabled={loading}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow-md shadow-indigo-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  <span>{loading ? "Scanning Businesses..." : "Find B2B Leads"}</span>
                </button>
              </div>
            </div>
          )}

          {/* Quick Preset Queries Strip */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-slate-500 text-[11px] font-medium mr-1">Quick Suggestions:</span>
              {(activeModule === "job_seeker" ? POPULAR_KEYWORDS : POPULAR_B2B_CATEGORIES).slice(0, 6).map((item) => {
                const isActive = activeModule === "job_seeker"
                  ? keyword.toLowerCase() === item.toLowerCase()
                  : b2bCategory.toLowerCase() === item.toLowerCase();

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      if (activeModule === "job_seeker") {
                        setKeyword(item);
                        handleJobSearch();
                      } else {
                        setB2bCategory(item);
                        handleB2BSearch(item);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] border transition-all cursor-pointer ${
                      isActive
                        ? "bg-indigo-500/15 border-indigo-500/40 text-indigo-300 font-semibold"
                        : "bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>

            {/* Batch Selector */}
            <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
              <span className="text-slate-500 text-[11px]">Batch Limit:</span>
              {[40, 80, 120].map((limit) => (
                <button
                  key={limit}
                  type="button"
                  onClick={() => setBatchLimit(limit)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border transition-all ${
                    batchLimit === limit
                      ? "bg-slate-800 text-white border-slate-700"
                      : "bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300"
                  }`}
                >
                  {limit} Leads
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ==================================================== */}
        {/* STATS OVERVIEW CARDS (When Leads Found)              */}
        {/* ==================================================== */}
        {leads.length > 0 && (
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Total Leads Found</p>
                <p className="text-2xl font-bold text-white mt-1">{stats.total}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{stats.uniqueCompanies} unique companies</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                <Briefcase className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">MX Verified Inboxes</p>
                <p className="text-2xl font-bold text-emerald-400 mt-1">{stats.verified}</p>
                <p className="text-[11px] text-emerald-400/80 mt-0.5">{stats.verifiedRate}% deliverability score</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  {activeModule === "b2b_lead_finder" ? "Phones & WhatsApp" : "Selected for Campaign"}
                </p>
                <p className="text-2xl font-bold text-cyan-400 mt-1">
                  {activeModule === "b2b_lead_finder" ? stats.withPhone : selectedLeadIds.size}
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">Ready to reach out</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                {activeModule === "b2b_lead_finder" ? <PhoneCall className="w-5 h-5" /> : <Rocket className="w-5 h-5" />}
              </div>
            </div>

            <div className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between shadow-sm">
              <label className="flex items-center justify-between w-full cursor-pointer select-none">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-400">Verification Filter</p>
                  <p className="text-sm font-bold text-white mt-1">
                    {verifiedOnly ? "Active MX Only" : "Show All Leads"}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">Click to toggle filter</p>
                </div>
                <input
                  type="checkbox"
                  checked={verifiedOnly}
                  onChange={(e) => setVerifiedOnly(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </label>
            </div>
          </section>
        )}

        {/* ==================================================== */}
        {/* LEADS LIST / VAULT                                   */}
        {/* ==================================================== */}
        <section className="bg-[#111726] border border-slate-800/80 rounded-2xl p-4 sm:p-5 space-y-4 shadow-sm">
          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleSelectAll}
                disabled={filteredLeads.length === 0}
                className="flex items-center gap-2 text-xs text-slate-300 hover:text-white font-medium px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 transition-all cursor-pointer disabled:opacity-40"
              >
                {selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0 ? (
                  <CheckSquare className="w-4 h-4 text-indigo-400" />
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
                Showing <strong className="text-white">{filteredLeads.length}</strong> {activeModule === "b2b_lead_finder" ? "businesses" : "leads"}
              </span>
            </div>

            <div className="relative min-w-[260px]">
              <input
                type="text"
                placeholder={
                  activeModule === "b2b_lead_finder"
                    ? "Filter by company, phone, email..."
                    : "Filter leads by role, email, company..."
                }
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3.5 py-2 pl-9 bg-slate-900 border border-slate-800 rounded-xl text-white text-xs placeholder:text-slate-500 focus:outline-none focus:border-indigo-500"
              />
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {/* Cards Vault */}
          <div className="space-y-3">
            {filteredLeads.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                  <Search className="w-6 h-6" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {loading
                      ? activeModule === "b2b_lead_finder"
                        ? "Scanning B2B Directories & Contact Pages..."
                        : "Querying 18+ Live Feeds & Career Portals..."
                      : "No Leads Discovered"}
                  </p>
                  <p className="text-xs text-slate-400 max-w-sm">
                    {loading
                      ? "Verifying active DNS MX records and direct contact mailboxes..."
                      : "Use the search bar above or choose a quick suggestion to start discovering verified leads."}
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
                    className={`rounded-2xl p-4 border transition-all ${
                      isSelected
                        ? "bg-[#141c2e] border-indigo-500/40 shadow-sm"
                        : "bg-slate-900/50 border-slate-800/80 hover:border-slate-700/80"
                    }`}
                  >
                    <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Selection + Info */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <button
                          type="button"
                          onClick={() => toggleLeadSelection(lead.id)}
                          className="mt-1 text-slate-400 hover:text-white cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-600" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Row 1: Badges & Company */}
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="font-bold text-white text-sm truncate">
                              {lead.company}
                            </span>

                            <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-medium">
                              {lead.category || lead.role}
                            </span>

                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium border ${sourceBadge.color}`}>
                              {sourceBadge.label}
                            </span>

                            {lead.mxValid ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                Active MX
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                                Unverified
                              </span>
                            )}

                            <span className="text-slate-400 text-xs flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              {lead.city || lead.location}
                            </span>
                          </div>

                          {/* Row 2: Contact Pills */}
                          <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                            {lead.phone && (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${lead.phone.replace(/\s+/g, "")}`}
                                  className="px-2.5 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 font-mono text-xs font-semibold flex items-center gap-1.5 transition-all"
                                  title="Call Phone"
                                >
                                  <PhoneCall className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>{lead.phone}</span>
                                </a>

                                {lead.whatsappUrl && (
                                  <a
                                    href={lead.whatsappUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-xs font-medium flex items-center gap-1 transition-all"
                                    title="WhatsApp Chat"
                                  >
                                    <MessageSquare className="w-3.5 h-3.5" />
                                    <span>WhatsApp</span>
                                  </a>
                                )}

                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(lead.phone || "", true)}
                                  className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs transition-all cursor-pointer"
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
                            <div className="px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs font-semibold flex items-center gap-1.5">
                              <Mail className="w-3.5 h-3.5 text-cyan-400" />
                              <span>{lead.email}</span>
                            </div>

                            <button
                              type="button"
                              onClick={() => copyToClipboard(lead.email)}
                              className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-medium flex items-center gap-1 transition-all cursor-pointer"
                            >
                              {copiedEmail === lead.email ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3 text-slate-400" />
                                  <span>Copy</span>
                                </>
                              )}
                            </button>

                            {(lead.website || lead.sourceUrl) && (
                              <a
                                href={lead.website || lead.sourceUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2.5 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white text-xs font-medium flex items-center gap-1 transition-all"
                              >
                                <span>{activeModule === "b2b_lead_finder" ? "Visit Website" : "View Posting"}</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>

                          {/* Snippet Overview */}
                          {lead.snippet && (
                            <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1">
                              {lead.snippet}
                            </p>
                          )}

                          {/* AI Generated Pitch Preview */}
                          {pitchPreview[lead.id] && (
                            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1 animate-in fade-in">
                              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-400">
                                <span className="flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" />
                                  {activeModule === "b2b_lead_finder" ? "AI B2B Pitch Draft" : "AI Application Pitch Draft"}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(pitchPreview[lead.id])}
                                  className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                  Copy Pitch
                                </button>
                              </div>
                              <p className="italic text-slate-300 leading-relaxed">
                                &ldquo;{pitchPreview[lead.id]}&rdquo;
                              </p>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Action: AI Pitch Generator */}
                      <div className="flex shrink-0">
                        <button
                          type="button"
                          onClick={() => generatePitchForLead(lead)}
                          disabled={generatingPitchId === lead.id}
                          className="px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 text-indigo-300 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                        >
                          {generatingPitchId === lead.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                          ) : (
                            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                          )}
                          <span>
                            {generatingPitchId === lead.id
                              ? "Drafting..."
                              : activeModule === "b2b_lead_finder"
                              ? "Generate Proposal"
                              : "Generate Pitch"}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Pagination / Next Batch */}
            {filteredLeads.length > 0 && (
              <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-800">
                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  <span>
                    Showing <strong className="text-white">{filteredLeads.length}</strong> leads • Page {currentPage}
                  </span>
                </div>

                {hasMore ? (
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={loadingMore || loading}
                    className="w-full sm:w-auto px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-white font-semibold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>Loading Next Batch...</span>
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4 text-indigo-400" />
                        <span>Load More (+{batchLimit} Leads)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <span className="text-xs text-slate-500 italic">All matching leads loaded.</span>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
