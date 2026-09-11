"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Rocket,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  Loader2,
  MailOpen,
  Radio,
  Cpu,
  Lock,
  BarChart3,
  Sparkles,
  Zap,
  Flame,
  Activity,
  CheckCircle2,
  Layers,
  Send,
  RefreshCw,
  PlayCircle,
  LogOut,
  Terminal,
  Crown
} from "lucide-react";
import { useLanguage } from "./context/LanguageContext";
import LanguageSelector from "./components/LanguageSelector";

export default function Home() {
  const { t } = useLanguage();
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [ownerConnected, setOwnerConnected] = useState<boolean | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [allowCustomerLogin, setAllowCustomerLogin] = useState<boolean>(false);

  useEffect(() => {
    checkGmailConnection();
  }, []);

  const checkGmailConnection = async () => {
    try {
      setCheckingConnection(true);
      const res = await fetch("/api/gmail/status", { cache: "no-store" });
      const data = await res.json();
      setIsConnected(Boolean(data.connected));
      setConnectedEmail(data.email || "");
      setOwnerConnected(Boolean(data.ownerConnected));
      setOwnerEmail(data.ownerEmail || "");
      setAllowCustomerLogin(Boolean(data.allowCustomerLogin));
    } catch {
      setIsConnected(false);
      setConnectedEmail("");
      setOwnerConnected(null);
      setOwnerEmail("");
      setAllowCustomerLogin(false);
    } finally {
      setCheckingConnection(false);
    }
  };

  const connectGmail = () => {
    window.location.href = "/api/auth/google";
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setIsConnected(false);
      setConnectedEmail("");
      window.location.href = "/";
    } catch (e) {
      console.error("Logout failed:", e);
    }
  };

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#03050c] text-slate-100 flex flex-col justify-between p-3 sm:p-6 pb-12">
      {/* Gen Z Ambient Holographic Glow Aura Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Dynamic Neon Aura Spheres */}
        <div className="absolute -top-20 -left-20 w-[30rem] sm:w-[45rem] h-[30rem] sm:h-[45rem] bg-cyan-500/20 rounded-full filter blur-[120px] sm:blur-[160px] animate-aura-1"></div>
        <div className="absolute -bottom-20 -right-20 w-[32rem] sm:w-[48rem] h-[32rem] sm:h-[48rem] bg-pink-600/20 rounded-full filter blur-[130px] sm:blur-[170px] animate-aura-2"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[24rem] sm:w-[38rem] h-[24rem] sm:h-[38rem] bg-purple-600/15 rounded-full filter blur-[140px] animate-pulse-glow"></div>

        {/* Cinematic Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,240,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(236,72,153,0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl w-full flex flex-col space-y-6">
        {/* Kinetic Ticker Marquee Header Banner with LanguageSelector */}
        <div className="w-full flex items-center justify-between gap-3 font-mono">
          <div className="overflow-hidden genz-glass-panel rounded-full py-1.5 px-4 border border-cyan-500/30 text-[10px] tracking-widest text-cyan-300 shadow-lg shadow-cyan-950/40 animate-fade-up flex-1">
            <div className="flex whitespace-nowrap animate-marquee items-center gap-8">
              <span className="flex items-center gap-2">
                <Zap className="w-3 h-3 text-cyan-400" /> {t("ticker_1")}
              </span>
              <span className="text-pink-400">•</span>
              <span className="flex items-center gap-2 text-pink-300">
                <ShieldCheck className="w-3 h-3 text-pink-400" /> {t("ticker_2")}
              </span>
              <span className="text-purple-400">•</span>
              <span className="flex items-center gap-2 text-purple-300">
                <Activity className="w-3 h-3 text-purple-400" /> {t("ticker_3")}
              </span>
              <span className="text-cyan-400">•</span>
              <span className="flex items-center gap-2 text-emerald-300">
                <Flame className="w-3 h-3 text-emerald-400" /> {t("ticker_4")}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/admin"
              className="px-3 py-1.5 genz-glass-panel rounded-full text-purple-300 border border-purple-500/40 text-[10px] font-mono font-bold flex items-center gap-1 hover:border-purple-400 hover:text-white transition-all shadow-md"
              title="Superadmin Autopilot & Customer Management"
            >
              <Crown className="w-3 h-3 text-amber-400" />
              <span>SUPERADMIN</span>
            </Link>
            <LanguageSelector className="shrink-0" />
          </div>
        </div>

        {/* Oversized Kinetic Hero Title Section */}
        <div className="text-center animate-fade-up pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 mb-2.5 genz-glass-panel rounded-full border border-pink-500/40 text-[10px] font-mono font-bold text-pink-300 uppercase shadow-md">
            <Sparkles className="w-3 h-3 text-pink-400 animate-spin" style={{ animationDuration: "6s" }} />
            <span>{t("home_badge")}</span>
            <Sparkles className="w-3 h-3 text-cyan-400" />
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight leading-none mb-2">
            <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              {t("home_title_1")}
            </span>{" "}
            <span className="genz-text-gradient font-mono tracking-tighter whitespace-nowrap inline-block animate-holo">
              [{t("home_title_2")}]
            </span>
          </h1>

          <p className="text-xs sm:text-sm md:text-base text-slate-300/90 max-w-xl mx-auto font-medium leading-relaxed px-2">
            {t("home_desc")}
          </p>
        </div>

        {/* Wide 2-Column Gen Z Holographic Dashboard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 sm:gap-5 items-center">
          {/* Left Column: Route Control & Telemetry Deck */}
          <div className="md:col-span-5 space-y-3 animate-fade-up">
            {/* System Status Deck */}
            <div className="genz-glass-panel rounded-2xl p-3.5 sm:p-4 border border-cyan-500/40 shadow-xl">
              <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                  {t("system_route_status")}
                </span>
                <span className="px-2 py-0.5 bg-cyan-500/15 border border-cyan-500/30 rounded-full text-[9px] text-cyan-300 font-mono">
                  LIVE V3.0
                </span>
              </div>

              {checkingConnection ? (
                <div className="flex items-center gap-2 text-slate-300 text-xs font-mono py-1">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>{t("calibrating_auth")}</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {isConnected ? (
                    <div className="flex items-center justify-between gap-2 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/30">
                      <div className="flex items-center gap-2 text-emerald-300 font-mono text-xs font-bold truncate">
                        <span className="relative flex h-2.5 w-2.5 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                        </span>
                        <span className="truncate">{t("auth_node")}: {connectedEmail}</span>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="px-2.5 py-1 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-lg text-xs font-mono font-bold flex items-center gap-1 shrink-0 transition-all"
                        title={t("logout")}
                      >
                        <LogOut className="w-3.5 h-3.5 text-rose-400" />
                        <span>{t("logout")}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/30">
                      <div className="flex items-center gap-2 text-rose-300 text-xs font-mono font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>
                          {!allowCustomerLogin ? "SUPERADMIN ACCESS ONLY" : t("mail_route_inactive")}
                        </span>
                      </div>
                      <button
                        onClick={connectGmail}
                        className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 rounded-xl text-white text-xs font-mono font-black genz-shimmer-btn shadow-lg text-center animate-blink-attention hover:scale-105 active:scale-95 transition-all cursor-pointer"
                      >
                        {!allowCustomerLogin ? "SUPERADMIN LOGIN" : t("authorize_now")}
                      </button>
                    </div>
                  )}

                  {ownerConnected === true && (
                    <div className="text-[10px] font-mono text-purple-300 border-t border-white/10 pt-2 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">DISPATCH ROUTE: <strong className="text-white">{ownerEmail}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Floating Telemetry Stats Grid (2x2) */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2.5 sm:p-3 genz-glass-panel rounded-xl border border-cyan-500/30 text-cyan-300">
                <div className="text-slate-400 text-[9px]">{t("batch_engine")}</div>
                <div className="font-bold text-xs text-white mt-0.5">{t("parallel_batch")}</div>
              </div>
              <div className="p-2.5 sm:p-3 genz-glass-panel rounded-xl border border-purple-500/30 text-purple-300">
                <div className="text-slate-400 text-[9px]">{t("auth_vault")}</div>
                <div className="font-bold text-xs text-white mt-0.5">GOOGLE OAUTH</div>
              </div>
              <div className="p-2.5 sm:p-3 genz-glass-panel rounded-xl border border-pink-500/30 text-pink-300">
                <div className="text-slate-400 text-[9px]">{t("precheck_matrix")}</div>
                <div className="font-bold text-xs text-white mt-0.5">{t("accuracy_100")}</div>
              </div>
              <div className="p-2.5 sm:p-3 genz-glass-panel rounded-xl border border-emerald-500/30 text-emerald-300">
                <div className="text-slate-400 text-[9px]">{t("database_store")}</div>
                <div className="font-bold text-xs text-white mt-0.5">{t("encrypted_mongo")}</div>
              </div>
            </div>
          </div>

          {/* Right Column: Main Interactive Campaign & Lead Hubs */}
          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3.5 animate-fade-up">
            {/* Hiring Lead Finder Card */}
            <Link href="/lead-finder" className="group text-left block h-full">
              <div className="h-full rounded-2xl genz-glass-interactive p-4 sm:p-5 flex flex-col justify-between cursor-pointer border border-emerald-500/30">
                <div>
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                      <Sparkles className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-widest">
                      LEAD RADAR
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mb-1 group-hover:text-emerald-300 transition-colors">
                    Hiring Lead Finder
                  </h3>
                  <p className="text-slate-300/85 text-[11px] leading-relaxed font-medium">
                    Discover public hiring intent posts with active MX-verified email contacts.
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-emerald-400 font-mono text-[11px] font-bold group-hover:text-cyan-300 transition-colors">
                  <span>Explore Leads</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </Link>

            {/* Sent Campaign Tracker Card */}
            <Link href="/sent-emails" className="group text-left block h-full">
              <div className="h-full rounded-2xl genz-glass-interactive p-4 sm:p-5 flex flex-col justify-between cursor-pointer border border-pink-500/30">
                <div>
                  <div className="flex justify-between items-start mb-2.5">
                    <div className="p-2.5 bg-pink-500/15 border border-pink-500/30 rounded-xl text-pink-400 group-hover:scale-110 transition-transform">
                      <MailOpen className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-pink-300 bg-pink-500/15 px-2.5 py-0.5 rounded-full border border-pink-500/30 uppercase tracking-widest">
                      CAMPAIGN ENGINE
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-bold text-white mb-1 group-hover:text-pink-300 transition-colors">
                    {t("card_tracker_title")}
                  </h3>
                  <p className="text-slate-300/85 text-[11px] leading-relaxed font-medium">
                    {t("card_tracker_desc")}
                  </p>
                </div>

                <div className="mt-3 flex items-center gap-1.5 text-pink-400 font-mono text-[11px] font-bold group-hover:text-cyan-300 transition-colors">
                  <span>{t("analyze_and_launch")}</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform duration-300" />
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* 🎥 CINEMATIC CONVERSION-CENTERED MOBILE VIDEO SHOWCASE SECTION */}
        <div className="w-full genz-glass-panel rounded-3xl p-4 sm:p-6 border border-cyan-500/40 relative overflow-hidden animate-fade-up shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
            {/* Video Container Frame - Tight cyan border wrapped around sphere */}
            <div className="lg:col-span-4 flex justify-center lg:justify-start">
              <div className="relative w-[270px] sm:w-[290px] h-[270px] sm:h-[290px] aspect-square rounded-2xl overflow-hidden border border-cyan-500/40 bg-black p-0 flex items-center justify-center group shadow-xl shrink-0">
                <video
                  src="/videos/conversion-centered-mobile.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover scale-100 group-hover:scale-105 transition-transform duration-500 opacity-95 group-hover:opacity-100 bg-black"
                />
                {/* Overlay Gradient Vignette */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none"></div>

                {/* Video Floating Badge */}
                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 bg-black/85 backdrop-blur-md rounded-full border border-cyan-500/40 text-[9px] font-mono text-cyan-300 font-bold flex items-center gap-1 z-10 shadow-lg truncate max-w-[90%]">
                  <PlayCircle className="w-3 h-3 text-cyan-400 animate-pulse shrink-0" />
                  <span className="truncate">{t("mobile_dispatch_badge")}</span>
                </div>
              </div>
            </div>

            {/* Video Overlaid / Related Content Text */}
            <div className="lg:col-span-8 space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-500/15 border border-cyan-500/30 rounded-full text-[10px] font-mono font-bold text-cyan-300 uppercase">
                <Zap className="w-3 h-3 text-cyan-400" />
                <span>{t("mobile_dispatch_engine")}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                {t("mobile_dispatch_title_1")} <span className="genz-glow-cyan">{t("mobile_dispatch_title_2")}</span>
              </h2>

              <p className="text-slate-300/90 text-xs sm:text-sm font-medium leading-relaxed">
                {t("mobile_dispatch_desc")}
              </p>

              {/* High-Impact Stat Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-2 font-mono text-xs">
                <div className="p-3 bg-slate-950/80 border border-cyan-500/30 rounded-xl">
                  <div className="text-[10px] text-cyan-400 font-bold">{t("stat_deliverability_label")}</div>
                  <div className="text-base font-black text-white mt-0.5">{t("stat_deliverability_val")}</div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-purple-500/30 rounded-xl">
                  <div className="text-[10px] text-purple-400 font-bold">{t("stat_speed_label")}</div>
                  <div className="text-base font-black text-white mt-0.5">{t("stat_speed_val")}</div>
                </div>

                <div className="p-3 bg-slate-950/80 border border-pink-500/30 rounded-xl col-span-2 sm:col-span-1">
                  <div className="text-[10px] text-pink-400 font-bold">{t("stat_duplicates_label")}</div>
                  <div className="text-base font-black text-white mt-0.5">{t("stat_duplicates_val")}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 🎬 CINEMATIC INFINITE REALTIME STREAM SHOWCASE SECTION */}
        <div className="w-full genz-glass-panel rounded-2xl p-3 border border-cyan-500/30 space-y-2 animate-fade-up shadow-xl">
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 border-b border-white/10 pb-1.5">
            <span className="flex items-center gap-2 text-cyan-300 font-bold uppercase tracking-widest">
              <Terminal className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
              {t("stream_title")}
            </span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              {t("stream_active")}
            </span>
          </div>

          {/* Line 1: Sending Mail Infinite Ticker */}
          <div className="w-full overflow-hidden bg-slate-950/80 rounded-xl py-1.5 px-3 border border-cyan-500/20 text-[10px] font-mono text-cyan-300">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-300 rounded font-bold text-[9px] shrink-0 flex items-center gap-1">
                <Send className="w-2.5 h-2.5 text-cyan-400 animate-bounce" /> {t("sending_stream")}
              </span>
              <div className="overflow-hidden w-full">
                <div className="flex whitespace-nowrap animate-marquee items-center gap-6 text-slate-300">
                  <span>[DISPATCHING] batch_01 -&gt; <strong className="text-white">alex@techcorp.io</strong> <span className="text-emerald-400 font-bold">[200 OK]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[DISPATCHING] batch_02 -&gt; <strong className="text-white">sarah@innovate.co</strong> <span className="text-emerald-400 font-bold">[200 OK]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[DISPATCHING] batch_03 -&gt; <strong className="text-white">dev@build.io</strong> <span className="text-amber-400 font-bold">[SKIPPED DUP]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[DISPATCHING] batch_04 -&gt; <strong className="text-white">founder@nextgen.app</strong> <span className="text-emerald-400 font-bold">[200 OK]</span></span>
                  <span className="text-slate-600">•</span>
                  {/* Duplicated loop set */}
                  <span>[DISPATCHING] batch_01 -&gt; <strong className="text-white">alex@techcorp.io</strong> <span className="text-emerald-400 font-bold">[200 OK]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[DISPATCHING] batch_02 -&gt; <strong className="text-white">sarah@innovate.co</strong> <span className="text-emerald-400 font-bold">[200 OK]</span></span>
                </div>
              </div>
            </div>
          </div>

          {/* Line 2: Fetching Mail Infinite Ticker */}
          <div className="w-full overflow-hidden bg-slate-950/80 rounded-xl py-1.5 px-3 border border-pink-500/20 text-[10px] font-mono text-pink-300">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded font-bold text-[9px] shrink-0 flex items-center gap-1">
                <RefreshCw className="w-2.5 h-2.5 text-pink-400 animate-spin" /> {t("fetching_stream")}
              </span>
              <div className="overflow-hidden w-full">
                <div className="flex whitespace-nowrap animate-marquee-reverse items-center gap-6 text-slate-300">
                  <span>[FETCHING] sent_folder -&gt; <strong className="text-white">100 records synced</strong> <span className="text-cyan-400 font-bold">[RATE RETRY OK]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[FETCHING] mail_api -&gt; <strong className="text-white">deduplication index updated</strong> <span className="text-purple-400 font-bold">[VALIDATED]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[FETCHING] oauth_refresh -&gt; <strong className="text-white">token active</strong> <span className="text-emerald-400 font-bold">[0ms DELAY]</span></span>
                  <span className="text-slate-600">•</span>
                  <span>[FETCHING] db_vault -&gt; <strong className="text-white">mongo persistent store sync</strong> <span className="text-pink-400 font-bold">[ENCRYPTED]</span></span>
                  <span className="text-slate-600">•</span>
                  {/* Duplicated loop set */}
                  <span>[FETCHING] sent_folder -&gt; <strong className="text-white">100 records synced</strong> <span className="text-cyan-400 font-bold">[RATE RETRY OK]</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Feature Telemetry */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-slate-400 text-[10px] font-mono animate-fade-up">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>BATCH DISPATCH: 8x PARALLEL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <span>ENCRYPTED REFRESH VAULT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3.5 h-3.5 text-pink-400" />
            <span>REALTIME TELEMETRY LOGS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
