"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
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
  X
} from "lucide-react";
import Link from "next/link";

type SentEmail = {
  serialNo: number;
  id: string;
  threadId: string;
  to: string;
  from: string;
  subject: string;
  date: string;
  rawDate: string;
  snippet: string;
};

// Component that uses useSearchParams
function SentEmailsContent() {
  const searchParams = useSearchParams();
  const connected = searchParams.get("connected");
  const [emails, setEmails] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const [hoveredEmail, setHoveredEmail] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmail, setSelectedEmail] = useState<SentEmail | null>(null);
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

  useEffect(() => {
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

      @keyframes pulseGlow {
        0%, 100% { box-shadow: 0 0 0 0 rgba(139, 92, 246, 0.4); }
        50% { box-shadow: 0 0 0 20px rgba(139, 92, 246, 0); }
      }

      @keyframes slideIn {
        from {
          opacity: 0;
          transform: translateX(-50px);
        }
        to {
          opacity: 1;
          transform: translateX(0);
        }
      }

      @keyframes bounceIn {
        0% {
          opacity: 0;
          transform: scale(0.3);
        }
        50% {
          opacity: 1;
          transform: scale(1.05);
        }
        70% {
          transform: scale(0.9);
        }
        100% {
          transform: scale(1);
        }
      }

      @keyframes glowPulse {
        0%, 100% {
          text-shadow: 0 0 5px rgba(139,92,246,0.5);
        }
        50% {
          text-shadow: 0 0 20px rgba(139,92,246,0.8);
        }
      }

      .animate-float {
        animation: float 6s ease-in-out infinite;
      }

      .animate-gradient {
        background-size: 200% 200%;
        animation: gradientShift 3s ease infinite;
      }

      .animate-pulse-glow {
        animation: pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
      }

      .animate-slide-in {
        animation: slideIn 0.6s ease-out forwards;
        opacity: 0;
      }

      .animate-bounce-in {
        animation: bounceIn 0.5s ease-out;
      }

      .glow-text {
        animation: glowPulse 2s ease-in-out infinite;
      }

      .glass-card {
        background: rgba(255, 255, 255, 0.08);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(255, 255, 255, 0.15);
      }

      .hover-glow:hover {
        box-shadow: 0 0 20px rgba(139, 92, 246, 0.4);
      }
    `;

    document.head.appendChild(style);

    return (): void => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  const connectGmail = () => {
    window.location.href = "/api/auth/google";
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

      do {
        let url = `/api/gmail/sent-emails?limit=250`;
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
          isFinished: !nextToken,
        });

        pageToken = nextToken;
        page++;

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

  const downloadExcel = () => {
    try {
      setDownloading(true);
      if (emails.length === 0) {
        setError("Please fetch sent emails first.");
        return;
      }
      const excelData = emails.map((email, index) => ({
        "S.No": index + 1,
        "To Email": email.to || "-",
        "From Email": email.from || "-",
        Subject: email.subject || "No Subject",
        Date: email.date || "-",
        Snippet: email.snippet || "-",
        "Thread ID": email.threadId || "-",
        "Message ID": email.id || "-",
      }));
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sent Emails");
      const excelBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
      const file = new Blob([excelBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      saveAs(file, `sent-emails-${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (err: any) {
      setError(err.message || "Failed to download Excel file");
    } finally {
      setDownloading(false);
    }
  };

  const filteredEmails = emails.filter(email =>
    email.subject?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.to?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    email.snippet?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: emails.length,
    uniqueRecipients: [...new Set(emails.map(e => e.to))].length,
    avgSubjectLength: emails.length ? Math.round(emails.reduce((sum, e) => sum + (e.subject?.length || 0), 0) / emails.length) : 0,
    mostActiveMonth: emails.length ? new Date(emails[0]?.date).toLocaleString('default', { month: 'long' }) : 'N/A'
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-1/2 left-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: "4s" }}></div>
        <div className="absolute top-40 right-40 w-60 h-60 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float" style={{ animationDelay: "3s" }}></div>

        {/* Grid Pattern */}
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, rgba(139,92,246,0.15) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 px-4 py-8 mx-auto max-w-7xl">
        {/* Header with Glow Effect */}
        <div className="text-center mb-12 animate-bounce-in">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 mb-6 glass-card rounded-full border border-purple-500/30">
            <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
            <span className="text-sm font-semibold text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
              NEXT GEN EMAIL MANAGER
            </span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>

          <h1 className="text-7xl md:text-8xl font-black mb-4 tracking-tighter">
            <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
              EMAIL
            </span>
            <br />
            <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent animate-gradient">
              MASTERS
            </span>
          </h1>

          <p className="text-xl text-purple-200 max-w-2xl mx-auto">
            Dominate your inbox analytics with next-level email intelligence
          </p>
        </div>

        {/* Floating Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div onClick={connectGmail} className="group relative overflow-hidden rounded-2xl glass-card p-6 hover:scale-105 transition-all duration-300 cursor-pointer hover-glow">
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-transparent rounded-full blur-2xl"></div>
            <Rocket className="w-12 h-12 text-purple-400 mb-4 group-hover:translate-x-2 group-hover:-translate-y-2 transition-all duration-300" />
            <h3 className="text-2xl font-bold text-white mb-2">Connect</h3>
            <p className="text-purple-200 text-sm">Secure Gmail integration</p>
          </div>

          <div onClick={fetchSentEmails} className="group relative overflow-hidden rounded-2xl glass-card p-6 hover:scale-105 transition-all duration-300 cursor-pointer hover-glow">
            <Zap className="w-12 h-12 text-pink-400 mb-4 group-hover:rotate-12 transition-transform duration-300" />
            <h3 className="text-2xl font-bold text-white mb-2">Fetch</h3>
            <p className="text-pink-200 text-sm">Lightning fast retrieval</p>
          </div>

          <div onClick={downloadExcel} className="group relative overflow-hidden rounded-2xl glass-card p-6 hover:scale-105 transition-all duration-300 cursor-pointer hover-glow">
            <Target className="w-12 h-12 text-orange-400 mb-4 group-hover:scale-110 transition-transform duration-300" />
            <h3 className="text-2xl font-bold text-white mb-2">Export</h3>
            <p className="text-orange-200 text-sm">Excel with one click</p>
          </div>
        </div>

        {/* Main Action Bar */}
        <div className="relative mb-8 overflow-hidden rounded-2xl glass-card p-1">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-orange-500/10"></div>

          {connected === "true" && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300 animate-slide-in">
              <CheckCircle2 className="w-5 h-5" />
              <span className="text-sm font-medium">🎉 Connected successfully! Ready to rock</span>
            </div>
          )}


          {error && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 animate-slide-in">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Date Range Filter Section */}
          <div className="relative z-10 p-4 border-b border-white/10 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px]">
              <label className="flex items-center gap-2 text-xs font-semibold text-purple-300 uppercase tracking-wider mb-2">
                <Calendar className="w-3.5 h-3.5" />
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-md rounded-xl text-white border border-white/10 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all font-medium"
                style={{ colorScheme: "dark" }}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="flex items-center gap-2 text-xs font-semibold text-pink-300 uppercase tracking-wider mb-2">
                <Calendar className="w-3.5 h-3.5" />
                End Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-900/50 backdrop-blur-md rounded-xl text-white border border-white/10 focus:outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-medium"
                style={{ colorScheme: "dark" }}
              />
            </div>
            <div className="flex gap-2">
              {(startDate || endDate) && (
                <button
                  onClick={() => {
                    setStartDate("");
                    setEndDate("");
                  }}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-white hover:text-red-400 text-sm font-semibold rounded-xl border border-white/10 transition-all flex items-center gap-2"
                >
                  <X className="w-4 h-4" />
                  Clear
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 p-4">
            <button
              onClick={connectGmail}
              className="group relative inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              <Mail className="relative w-5 h-5 group-hover:rotate-12 transition-transform" />
              <span className="relative">Connect Gmail</span>
              <ArrowRight className="relative w-4 h-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </button>

            <button
              onClick={fetchSentEmails}
              disabled={loading}
              className="group relative inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-pink-600 to-orange-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 transition-all duration-300"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Fetching Emails...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
                  <span>Fetch Emails</span>
                </>
              )}
            </button>
            <Link href={`/bulk-emails`} className="group relative inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-600 to-yellow-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 transition-all duration-300">
              Send BulkMail

            </Link>

            <button
              onClick={downloadExcel}
              disabled={downloading || emails.length === 0}
              className="group relative inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-orange-600 to-yellow-600 text-white rounded-xl font-bold shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 transition-all duration-300"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Downloading...</span>
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 group-hover:scale-110 transition-transform" />
                  <span>Export Excel</span>

                </>

              )}
            </button>
          </div>
        </div>

        {/* Syncing Progress Card */}
        {loading && fetchProgress.fetchedCount > 0 && (
          <div className="mb-8 rounded-2xl glass-card p-6 border border-purple-500/30 animate-slide-in relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-br from-purple-500/10 to-transparent rounded-full blur-2xl"></div>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                  Syncing Sent Campaigns...
                </h3>
                <p className="text-purple-200/70 text-xs mt-1">
                  Loading page {fetchProgress.currentPage} from Gmail servers. Details are fetched with rate-limiting protection.
                </p>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  {fetchProgress.fetchedCount}
                </span>
                <span className="text-purple-200/50 text-xs ml-1">
                  {fetchProgress.estimatedTotal ? `of ~${fetchProgress.estimatedTotal} loaded` : "loaded"}
                </span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-slate-900/50 rounded-full overflow-hidden border border-white/5">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 transition-all duration-300"
                style={{
                  width: fetchProgress.estimatedTotal
                    ? `${Math.min(100, Math.round((fetchProgress.fetchedCount / fetchProgress.estimatedTotal) * 100))}%`
                    : `${Math.min(100, (fetchProgress.currentPage * 8))}%`
                }}
              ></div>
            </div>

            {/* Real-time status update */}
            <div className="flex justify-between items-center mt-3 text-[11px] text-purple-200/50">
              <span>Status: Fetching metadata & preparing spreadsheet format</span>
              <span>API requests protected with auto-retry backoff</span>
            </div>
          </div>
        )}

        {/* Stats Dashboard */}
        {emails.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 animate-slide-in">
            <div className="relative overflow-hidden rounded-xl glass-card p-4 border border-purple-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-300 text-xs uppercase tracking-wider">Total Emails</p>
                  <p className="text-3xl font-bold text-white">{stats.total}</p>
                </div>
                <Send className="w-8 h-8 text-purple-400 opacity-50" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl glass-card p-4 border border-pink-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-pink-300 text-xs uppercase tracking-wider">Unique Recipients</p>
                  <p className="text-3xl font-bold text-white">{stats.uniqueRecipients}</p>
                </div>
                <Users className="w-8 h-8 text-pink-400 opacity-50" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl glass-card p-4 border border-orange-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-300 text-xs uppercase tracking-wider">Avg Subject Length</p>
                  <p className="text-3xl font-bold text-white">{stats.avgSubjectLength}</p>
                </div>
                <BarChart3 className="w-8 h-8 text-orange-400 opacity-50" />
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl glass-card p-4 border border-indigo-500/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-indigo-300 text-xs uppercase tracking-wider">Most Active</p>
                  <p className="text-lg font-bold text-white">{stats.mostActiveMonth}</p>
                </div>
                <Crown className="w-8 h-8 text-indigo-400 opacity-50" />
              </div>
            </div>
          </div>
        )}

        {/* Search Bar */}
        {emails.length > 0 && (
          <div className="mb-6 animate-slide-in">
            <div className="relative">
              <input
                type="text"
                placeholder="🔍 Search through your emails..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-6 py-3 glass-card rounded-xl text-white placeholder-white/50 focus:outline-none focus:border-purple-500 transition-all pl-12"
              />
              <Hash className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-white/40" />
            </div>
          </div>
        )}

        {/* Email Cards */}
        {filteredEmails.length === 0 ? (
          <div className="relative overflow-hidden rounded-2xl glass-card p-16 text-center">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-pink-500/5"></div>
            <Inbox className="w-20 h-20 mx-auto mb-4 text-white/30" />
            <p className="text-white/60 text-lg">
              {emails.length === 0 ? "🚀 No emails fetched yet. Hit the fetch button!" : "🔍 No matching emails found."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredEmails.map((email, index) => (
              <div
                key={email.id}
                onMouseEnter={() => setHoveredEmail(email.id)}
                onMouseLeave={() => setHoveredEmail(null)}
                onClick={() => setSelectedEmail(selectedEmail?.id === email.id ? null : email)}
                className="group relative overflow-hidden rounded-xl glass-card hover:border-purple-500/50 transition-all duration-300 transform hover:-translate-y-1 cursor-pointer animate-slide-in"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className={`absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300`}></div>

                <div className="relative p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-lg text-xs font-mono text-purple-300">
                          <Award className="w-3 h-3" />
                          #{index + 1}
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/5 rounded-lg text-xs text-white/60">
                          <Mail className="w-3 h-3" />
                          To: {email.to?.split('@')[0] || '-'}
                        </span>
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-white/5 rounded-lg text-xs text-white/60">
                          <Send className="w-3 h-3" />
                          From: me
                        </span>
                      </div>

                      <h3 className={`text-xl font-bold mb-2 transition-all duration-300 ${hoveredEmail === email.id ? 'text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text scale-105' : 'text-white'}`}>
                        {email.subject || "No Subject"}
                      </h3>

                      <p className="text-white/60 text-sm line-clamp-2 mb-3">
                        {email.snippet || "-"}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-white/40">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(email.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        {email.threadId && (
                          <div className="flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Thread: {email.threadId.slice(0, 8)}...</span>
                          </div>
                        )}
                      </div>

                      {/* Expanded View */}
                      {selectedEmail?.id === email.id && (
                        <div className="mt-4 p-4 bg-black/20 rounded-lg border border-white/10 animate-slide-in">
                          <p className="text-white/80 text-sm">{email.snippet}</p>
                          <div className="mt-2 pt-2 border-t border-white/10">
                            <p className="text-xs text-white/40">Thread ID: {email.threadId}</p>
                            <p className="text-xs text-white/40 mt-1">Message ID: {email.id}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`flex gap-2 transition-all duration-300 ${hoveredEmail === email.id ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-4'}`}>
                      <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                        <Eye className="w-4 h-4 text-white/80" />
                      </button>
                      <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                        <Copy className="w-4 h-4 text-white/80" />
                      </button>
                      <button className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                        <Share2 className="w-4 h-4 text-white/80" />
                      </button>
                    </div>
                  </div>

                  {/* Animated Progress Bar */}
                  <div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 transition-all duration-500 ${hoveredEmail === email.id ? 'w-full' : 'w-0'}`}></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Footer with Glow Text */}
        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-2 px-6 py-3 glass-card rounded-full border border-white/10">
            <Flame className="w-4 h-4 text-orange-400" />
            <span className="text-sm text-white/60 glow-text">Built with 🔥 for email domination</span>
            <Sparkles className="w-4 h-4 text-yellow-400" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Loading fallback component
function SentEmailsLoading() {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-white/60">Loading...</p>
      </div>
    </div>
  );
}

// Main page component with Suspense boundary
export default function SentEmailsPage() {
  return (
    <Suspense fallback={<SentEmailsLoading />}>
      <SentEmailsContent />
    </Suspense>
  );
}