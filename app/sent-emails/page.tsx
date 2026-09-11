"use client";

import { Suspense, useState, useEffect, useMemo } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import DateRangePicker from "../components/DateRangePicker";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  Rocket,
  Sparkles,
  Zap,
  Download,
  SendIcon,
  RefreshCw,
  Mail,
  Send,
  TrendingUp,
  Clock,
  Users,
  Inbox,
  Gem,
  ArrowRight,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Copy,
  Share2,
  Flame,
  Crown,
  Target,
  Award,
  BarChart3,
  MessageSquare,
  Hash,
  Calendar,
  X,
  ArrowLeft,
  ChevronDown,
  Check,
  Activity,
  Terminal,
  Search,
  LogOut,
  Lock,
  ShieldAlert,
  LogIn
} from "lucide-react";
import Link from "next/link";
import { useLanguage } from "../context/LanguageContext";
import LanguageSelector from "../components/LanguageSelector";

type SentEmail = {
  id: string;
  threadId?: string;
  to: string;
  subject: string;
  date: string;
  rawDate?: string;
  snippet?: string;
};

function SentEmailsContent() {
  const { t } = useLanguage();
  const searchParams = useSearchParams();
  const router = useRouter();

  const connected = searchParams.get("connected");

  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const [connectedEmail, setConnectedEmail] = useState("");
  const [ownerConnected, setOwnerConnected] = useState<boolean | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");

  // Pagination & Fetch Progress States
  const [fetchProgress, setFetchProgress] = useState<{
    currentPage: number;
    fetchedCount: number;
    estimatedTotal: number | null;
    isFinished: boolean;
  }>({
    currentPage: 0,
    fetchedCount: 0,
    estimatedTotal: null,
    isFinished: false,
  });

  const [isConnected, setIsConnected] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    checkGmailConnection();
  }, []);

  const checkGmailConnection = async () => {
    try {
      setCheckingAuth(true);
      const res = await fetch("/api/gmail/status", { cache: "no-store" });
      const data = await res.json();
      const connectedStatus = Boolean(data.connected);
      setIsConnected(connectedStatus);
      if (connectedStatus && data.email) {
        setConnectedEmail(data.email);
      } else {
        setConnectedEmail("");
      }
      setOwnerConnected(Boolean(data.ownerConnected));
      setOwnerEmail(data.ownerEmail || "");
    } catch {
      setIsConnected(false);
      setConnectedEmail("");
      setOwnerConnected(null);
      setOwnerEmail("");
    } finally {
      setCheckingAuth(false);
    }
  };

  const connectGmail = () => {
    window.location.href = "/api/auth/google";
  };

  const handleLogout = async () => {
    if (loading) return;
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsConnected(false);
      setConnectedEmail("");
      window.location.href = "/sent-emails";
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const fetchSentEmails = async () => {
    try {
      setLoading(true);
      setError("");
      setEmails([]);
      setFetchProgress({
        currentPage: 1,
        fetchedCount: 0,
        estimatedTotal: null,
        isFinished: false,
      });

      let pageToken = "";
      let allFetched: SentEmail[] = [];
      let page = 1;
      const MAX_PAGES = 5;

      do {
        let url = `/api/gmail/sent-emails?limit=100`;
        if (pageToken) url += `&pageToken=${pageToken}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json();

        if (!res.ok) throw new Error(data.message || "Failed to fetch sent emails");

        const newEmails = data.emails || [];
        allFetched = [...allFetched, ...newEmails];
        setEmails([...allFetched]);

        const nextToken = data.nextPageToken || "";
        const estTotal = data.resultSizeEstimate;

        setFetchProgress({
          currentPage: page,
          fetchedCount: allFetched.length,
          estimatedTotal: estTotal || null,
          isFinished: !nextToken || page >= MAX_PAGES,
        });

        pageToken = nextToken;
        page++;

        if (page > MAX_PAGES) {
          console.warn(`Reached maximum page fetch limit of ${MAX_PAGES}. Stopping to prevent rate limits.`);
          break;
        }

        if (pageToken) {
          await new Promise((r) => setTimeout(r, 150));
        }
      } while (pageToken);

    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const launchCampaignWithContacts = () => {
    if (emails.length === 0) {
      setError("Please fetch sent emails first.");
      return;
    }
    const contactsToLoad = emails
      .filter((e) => e.to && e.to.trim())
      .map((e) => ({
        email: e.to.trim(),
        subject: e.subject || "",
        snippet: e.snippet || "",
        date: e.date || "",
      }));

    if (contactsToLoad.length === 0) {
      setError("No valid recipient email addresses found in fetched logs.");
      return;
    }

    sessionStorage.setItem("auto_loaded_contacts", JSON.stringify(contactsToLoad));
    window.location.href = "/bulk-emails?source=auto";
  };

  const filteredEmails = useMemo(() => {
    return emails.filter(email =>
      email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      email.snippet?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [emails, searchTerm]);

  const stats = useMemo(() => {
    const total = emails.length;
    if (total === 0) {
      return {
        total: 0,
        uniqueRecipients: 0,
        avgSubjectLength: 0,
        mostActiveMonth: "N/A"
      };
    }
    const uniqueRecipients = new Set(emails.map(e => e.to)).size;
    const avgSubjectLength = Math.round(emails.reduce((sum, e) => sum + (e.subject?.length || 0), 0) / total);
    let mostActiveMonth = "N/A";
    if (emails[0]?.rawDate) {
      const d = new Date(emails[0].rawDate);
      if (!isNaN(d.getTime())) {
        mostActiveMonth = d.toLocaleString('default', { month: 'long' });
      }
    }
    return {
      total,
      uniqueRecipients,
      avgSubjectLength,
      mostActiveMonth
    };
  }, [emails]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-[#03050c] text-slate-100 flex flex-col items-center justify-center p-5 relative overflow-hidden font-mono">
        <div className="p-4 genz-glass-panel rounded-2xl border border-purple-500/30 flex flex-col items-center gap-3 animate-pulse">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <p className="text-xs text-purple-300 font-bold tracking-wider">
            VERIFYING COMMAND STATION AUTHENTICATION...
          </p>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-[#03050c] text-slate-100 flex flex-col justify-between p-4 sm:p-8 relative overflow-hidden font-mono">
        {/* Background Aura */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-10 left-10 w-[30rem] h-[30rem] bg-rose-500/10 rounded-full filter blur-[140px] animate-aura-1"></div>
          <div className="absolute bottom-10 right-10 w-[36rem] h-[36rem] bg-purple-600/15 rounded-full filter blur-[150px] animate-aura-2"></div>
        </div>

        <div className="relative z-10 max-w-xl mx-auto w-full my-auto space-y-5 animate-fade-up">
          <div className="genz-glass-panel rounded-3xl p-6 sm:p-8 border border-rose-500/30 text-center space-y-4 shadow-2xl relative overflow-hidden">
            <div className="w-16 h-16 bg-rose-500/10 border border-rose-500/40 rounded-2xl flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <Lock className="w-8 h-8 text-rose-400" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 border border-rose-500/30 rounded-full text-rose-300 text-[10px] font-bold tracking-widest uppercase mb-2">
                <ShieldAlert className="w-3 h-3 text-rose-400" />
                <span>ACCESS RESTRICTED • AUTH REQUIRED</span>
              </div>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                SENT TRACKER LOCKED
              </h2>
              <p className="text-slate-300 text-xs sm:text-sm mt-2 leading-relaxed">
                Google OAuth 2.0 authentication is required to access sent telemetry, audit message logs, and track outreach status.
              </p>
            </div>

            <div className="p-3 bg-white/5 rounded-xl border border-white/10 text-left text-xs space-y-1.5 text-slate-400">
              <div className="flex items-center gap-2 text-slate-200 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                <span>What you get after connecting:</span>
              </div>
              <p className="text-[11px] pl-5">• Real-time Gmail Sent Logs & Telemetry Audit</p>
              <p className="text-[11px] pl-5">• Recipient Engagement & Outreach Analytics</p>
              <p className="text-[11px] pl-5">• 1-Click Re-target Campaign Launcher</p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => (window.location.href = "/api/auth/google")}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 hover:from-cyan-300 hover:to-pink-400 text-white font-bold text-xs rounded-xl shadow-lg shadow-purple-500/20 genz-shimmer-btn flex items-center justify-center gap-2 transition-all"
              >
                <LogIn className="w-4 h-4" />
                <span>AUTHORIZE YOUR ACCOUNT NOW</span>
              </button>
              <Link
                href="/"
                className="px-5 py-3 genz-glass-panel text-slate-300 hover:text-white rounded-xl border border-white/10 text-xs font-bold flex items-center justify-center gap-1.5"
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
    <div className="min-h-screen md:h-screen md:max-h-screen relative overflow-x-hidden md:overflow-hidden bg-[#03050c] text-slate-100 flex flex-col justify-between p-3 sm:p-5">
      {/* Dynamic Background Cyber Mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-[24rem] sm:w-[34rem] h-[24rem] sm:h-[34rem] bg-purple-600/15 rounded-full filter blur-[100px] sm:blur-[130px] animate-aura-1"></div>
        <div className="absolute bottom-20 right-10 w-[28rem] sm:w-[38rem] h-[28rem] sm:h-[38rem] bg-cyan-600/15 rounded-full filter blur-[110px] sm:blur-[140px] animate-aura-2"></div>
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,240,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto max-w-[1400px] w-full flex flex-col md:h-full space-y-3">
        {/* Top Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 animate-fade-up">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-1 genz-glass-panel rounded-full text-purple-300 text-xs font-mono font-bold hover:border-purple-400 transition-all shadow-md self-start shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-purple-400" />
              <span>COMMAND STATION</span>
            </Link>

            <h1 className="text-xl sm:text-2xl font-black tracking-tight flex items-center gap-2">
              <span className="bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                SENT CAMPAIGN
              </span>{" "}
              <span className="genz-glow-purple font-mono tracking-tighter whitespace-nowrap">
                [ TRACKER ]
              </span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-mono w-full sm:w-auto">
            <LanguageSelector />
            {(() => {
              const isGmailConnected = isConnected || Boolean(connected === "true" && connectedEmail);
              const isDateRangeSelected = Boolean(startDate && endDate);
              const canFetch = isGmailConnected && isDateRangeSelected;
              return (
                <>
                  {isGmailConnected ? (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <div className="px-3.5 py-1.5 border font-bold text-center rounded-lg flex items-center gap-1.5 bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span>{t("account_connected")}</span>
                      </div>
                      <button
                        onClick={handleLogout}
                        disabled={loading}
                        className="px-3 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        title={loading ? "Cannot logout while fetching logs" : t("logout")}
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>{t("logout")}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={connectGmail}
                      className="flex-1 sm:flex-none px-4 py-1.5 border font-bold transition-all text-center rounded-lg flex items-center justify-center gap-1.5 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-white animate-blink-attention shadow-lg cursor-pointer"
                    >
                      <span>{t("connect_account")}</span>
                    </button>
                  )}
                  <button
                    onClick={fetchSentEmails}
                    disabled={loading || !canFetch}
                    className="flex-1 sm:flex-none px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white rounded-lg font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-1.5 genz-shimmer-btn"
                    title={
                      !isGmailConnected
                        ? t("please_connect_first")
                        : !isDateRangeSelected
                        ? t("please_select_range_first")
                        : t("fetch_contacts")
                    }
                  >
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                    <span>{t("fetch_sent_logs")}</span>
                  </button>
                </>
              );
            })()}
            <button
              onClick={launchCampaignWithContacts}
              disabled={emails.length === 0}
              className="flex-1 sm:flex-none px-3.5 py-1.5 bg-gradient-to-r from-pink-500 via-purple-600 to-cyan-500 text-white rounded-lg font-bold disabled:opacity-40 transition-all genz-shimmer-btn flex items-center justify-center gap-1.5 shadow-lg shadow-pink-500/20"
            >
              <Rocket className="w-3.5 h-3.5" />
              <span>{t("launch_campaign")} ({emails.length})</span>
            </button>
          </div>
        </div>

        {/* Compact Filter & Status Deck */}
        <div className="genz-glass-panel rounded-2xl p-3 border border-purple-500/30 animate-fade-up">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            {/* Status indicators */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
              {(connected === "true" || connectedEmail) && (
                <span className="text-emerald-400 font-bold flex items-center gap-1.5 truncate">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  {connectedEmail ? `AUTH: ${connectedEmail}` : "AUTHENTICATED"}
                </span>
              )}
              {ownerConnected === true && (
                <span className="text-purple-300 truncate">
                  ROUTE: <strong className="text-white">{ownerEmail}</strong>
                </span>
              )}
              {error && <span className="text-rose-400 font-bold">ERR: {error}</span>}
            </div>

            {/* Date Filters & Instant Search */}
            <div className="flex flex-wrap items-center gap-2 text-xs font-mono w-full md:w-auto md:flex-1 justify-start md:justify-end">
              <DateRangePicker
                startDate={startDate}
                endDate={endDate}
                onChange={(start, end) => {
                  setStartDate(start);
                  setEndDate(end);
                }}
                placeholder="Select Date Range (e.g. 1 - 20)"
                align="right"
              />

              {/* Search Bar */}
              <div className="relative w-full sm:w-auto sm:min-w-[200px]">
                <input
                  type="text"
                  placeholder="Filter logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-1 genz-input rounded-xl text-white text-xs font-mono pl-8"
                />
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Sync Progress Indicator */}
        {loading && fetchProgress.fetchedCount > 0 && (
          <div className="rounded-xl genz-glass-panel p-2.5 border border-cyan-500/30">
            <div className="flex items-center justify-between text-xs font-mono text-cyan-300">
              <span className="flex items-center gap-2 truncate">
                <RefreshCw className="w-3.5 h-3.5 text-cyan-400 animate-spin shrink-0" />
                FETCHING PAGE {fetchProgress.currentPage}...
              </span>
              <span className="font-bold shrink-0">
                {fetchProgress.fetchedCount} {fetchProgress.estimatedTotal ? `/ ~${fetchProgress.estimatedTotal}` : "RECORDS"}
              </span>
            </div>
          </div>
        )}

        {/* Telemetry Stats Pills */}
        {emails.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 animate-fade-up">
            <div className="genz-glass-panel rounded-xl p-2.5 border border-purple-500/30 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-mono font-bold uppercase">TOTAL MAILS</p>
                <p className="text-lg sm:text-xl font-mono font-black text-white">{stats.total}</p>
              </div>
              <Send className="w-4 sm:w-5 h-4 sm:h-5 text-purple-400" />
            </div>

            <div className="genz-glass-panel rounded-xl p-2.5 border border-cyan-500/30 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-mono font-bold uppercase">CONTACTS</p>
                <p className="text-lg sm:text-xl font-mono font-black text-white">{stats.uniqueRecipients}</p>
              </div>
              <Users className="w-4 sm:w-5 h-4 sm:h-5 text-cyan-400" />
            </div>

            <div className="genz-glass-panel rounded-xl p-2.5 border border-amber-500/30 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-mono font-bold uppercase">AVG SUBJECT</p>
                <p className="text-lg sm:text-xl font-mono font-black text-white">{stats.avgSubjectLength} ch</p>
              </div>
              <BarChart3 className="w-4 sm:w-5 h-4 sm:h-5 text-amber-400" />
            </div>

            <div className="genz-glass-panel rounded-xl p-2.5 border border-pink-500/30 flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-[9px] sm:text-[10px] font-mono font-bold uppercase">PEAK MONTH</p>
                <p className="text-xs sm:text-sm font-mono font-bold text-white truncate max-w-[80px] sm:max-w-none">{stats.mostActiveMonth}</p>
              </div>
              <Crown className="w-4 sm:w-5 h-4 sm:h-5 text-pink-400" />
            </div>
          </div>
        )}

        {/* Scrollable Email Logs Vault Box */}
        <div className="flex-1 md:min-h-0 rounded-2xl genz-glass-panel p-3 sm:p-4 border border-white/10 overflow-hidden flex flex-col justify-between">
          <div className="md:overflow-y-auto custom-scrollbar flex-1 pr-0 sm:pr-1 space-y-3">
            {filteredEmails.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center py-10 text-center">
                <div className="p-3 bg-purple-500/10 border border-purple-500/30 rounded-full mb-3">
                  <Inbox className="w-8 h-8 text-purple-400" />
                </div>
                <p className="text-slate-300 font-mono text-xs">
                  {emails.length === 0 ? t("no_sent_logs") : "NO MESSAGES MATCH YOUR QUERY SEARCH."}
                </p>
              </div>
            ) : (
              filteredEmails.map((email, index) => (
                <div
                  key={email.id}
                  className="genz-glass-interactive rounded-xl p-3 sm:p-4 border border-white/10 group relative"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap text-[10px] sm:text-[11px] font-mono">
                        <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 rounded text-cyan-300 font-bold">
                          #{index + 1}
                        </span>
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300 truncate max-w-[200px] sm:max-w-none">
                          TO: <strong className="text-white">{email.to || "-"}</strong>
                        </span>
                        <span className="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-slate-300">
                          FROM: <strong className="text-white">me</strong>
                        </span>
                      </div>

                      <h3
                        onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
                        className="text-xs sm:text-sm font-bold text-white group-hover:text-cyan-300 transition-colors mb-1 cursor-pointer truncate"
                      >
                        {email.subject || "No Subject"}
                      </h3>

                      <p className="text-slate-400 text-[10px] sm:text-[11px] font-mono line-clamp-2 leading-relaxed mb-2">
                        {email.snippet || "-"}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-[10px] font-mono text-slate-500">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-cyan-400 shrink-0" />
                          <span>
                            {email.rawDate && !isNaN(new Date(email.rawDate).getTime())
                              ? new Date(email.rawDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : email.date || "-"}
                          </span>
                        </div>
                        {email.threadId && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3 text-purple-400 shrink-0" />
                            <span>THREAD: {email.threadId.slice(0, 8)}...</span>
                          </div>
                        )}
                      </div>

                      {/* Detailed Accordion Drawer */}
                      {selectedEmail?.id === email.id && (
                        <div className="mt-3 p-3 sm:p-4 bg-slate-950/90 border border-cyan-500/30 rounded-xl text-xs font-mono space-y-2 animate-fade-up">
                          <div className="text-cyan-400 font-bold uppercase border-b border-cyan-500/20 pb-1.5 flex justify-between items-center">
                            <span>MESSAGE PAYLOAD CONTENT</span>
                            <button
                              onClick={() => copyToClipboard(email.snippet, email.id)}
                              className="px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 rounded flex items-center gap-1 transition-all"
                            >
                              {copiedId === email.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span>COPIED</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>COPY TEXT</span>
                                </>
                              )}
                            </button>
                          </div>
                          <p className="text-slate-200 leading-relaxed whitespace-pre-wrap text-[11px] sm:text-xs">{email.snippet}</p>
                          <div className="pt-2 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 text-[10px]">
                            <div className="truncate">THREAD ID: <span className="text-white">{email.threadId}</span></div>
                            <div className="truncate">MESSAGE ID: <span className="text-white">{email.id}</span></div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div
                      onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
                      className="flex items-center gap-1.5 self-end md:self-start pt-1 cursor-pointer"
                    >
                      <span className="text-[10px] font-mono font-semibold text-cyan-400 group-hover:text-purple-300 transition-colors">
                        {selectedEmail?.id === email.id ? "HIDE" : "INSPECT"}
                      </span>
                      <ChevronDown className={`w-3.5 h-3.5 text-cyan-400 transition-transform duration-300 ${selectedEmail?.id === email.id ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
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

function SentEmailsLoading() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050c] flex items-center justify-center p-4">
      <div className="text-center p-6 sm:p-8 genz-glass-panel rounded-3xl max-w-sm w-full">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-300 text-xs font-mono font-semibold">INITIALIZING TELEMETRY TRACKER...</p>
      </div>
    </div>
  );
}

export default function SentEmailsPage() {
  return (
    <Suspense fallback={<SentEmailsLoading />}>
      <SentEmailsContent />
    </Suspense>
  );
}