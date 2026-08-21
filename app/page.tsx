"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Mail,
  Send,
  Sparkles,
  Flame,
  Rocket,
  ArrowRight,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Loader2,
  Database,
  MailOpen,
  Zap,
  Activity,
  Radio,
  Cpu,
  Terminal,
  Compass,
  Layers,
  Lock,
  BarChart3
} from "lucide-react";

export default function Home() {
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [ownerConnected, setOwnerConnected] = useState<boolean | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");

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

  return (
    <div className="h-screen max-h-screen relative overflow-hidden bg-[#03050c] text-slate-100 flex flex-col justify-between p-4 sm:p-6">
      {/* Hyper-Quantum Ambient Background Canvas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Dynamic Moving Aura Lights */}
        <div className="absolute top-10 left-10 w-[36rem] h-[36rem] bg-cyan-500/20 rounded-full filter blur-[140px] animate-aura-1"></div>
        <div className="absolute bottom-10 right-10 w-[42rem] h-[42rem] bg-purple-600/20 rounded-full filter blur-[150px] animate-aura-2"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-pink-500/15 rounded-full filter blur-[130px] animate-pulse-halo"></div>

        {/* Triple Orbital Radar Rings */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[52rem] h-[52rem] rounded-full border border-cyan-500/15 animate-radar"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[36rem] h-[36rem] rounded-full border border-dashed border-purple-500/20 animate-radar" style={{ animationDirection: "reverse", animationDuration: "22s" }}></div>

        {/* Cyberpunk Grid Overlay */}
        <div
          className="absolute inset-0 opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(0,240,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0,240,255,0.2) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        ></div>
      </div>

      <div className="relative z-10 mx-auto max-w-6xl w-full flex flex-col justify-between h-full py-2">
        {/* Top Header Section */}
        <div className="text-center animate-fade-up">
          <div className="inline-flex items-center gap-2.5 px-3.5 py-1 mb-2 aaa-glass-panel hud-corner rounded-full border border-cyan-500/40 text-[10px] font-mono tracking-widest text-cyan-300 uppercase shadow-lg shadow-cyan-950/50">
            <div className="flex items-center gap-1 h-2.5">
              <span className="w-0.5 bg-cyan-400 rounded-full animate-bounce" style={{ height: "60%", animationDelay: "0.1s" }}></span>
              <span className="w-0.5 bg-pink-400 rounded-full animate-bounce" style={{ height: "100%", animationDelay: "0.3s" }}></span>
              <span className="w-0.5 bg-purple-400 rounded-full animate-bounce" style={{ height: "40%", animationDelay: "0.2s" }}></span>
            </div>
            <span>QUANTUM DISPATCH MATRIX • GMAIL SATELLITE ONLINE</span>
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
          </div>

          <h1 className="text-2xl sm:text-4xl md:text-5xl font-black tracking-tight leading-none mb-1.5">
            <span className="bg-gradient-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-transparent">
              HYPER MAILING
            </span>{" "}
            <span className="bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-text-gradient font-mono tracking-tighter whitespace-nowrap inline-block">
              [ COMMAND STATION ]
            </span>
          </h1>

          <p className="text-xs sm:text-sm text-slate-300/85 max-w-xl mx-auto font-medium leading-tight">
            Automated batch dispatcher, real-time Gmail sent-folder validator, and intelligent zero-duplicate delivery controller.
          </p>
        </div>

        {/* Wide 2-Column Dashboard Center Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center my-auto">
          {/* Left Column: Connection Deck & Stat Telemetry */}
          <div className="md:col-span-5 space-y-3.5 animate-fade-up">
            {/* Connection Status Panel */}
            <div className="aaa-glass-panel hud-corner rounded-2xl p-4 border border-cyan-500/30">
              <div className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span>SYSTEM ROUTE STATUS</span>
              </div>

              {checkingConnection ? (
                <div className="flex items-center gap-2 text-slate-300 text-xs font-mono">
                  <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />
                  <span>CALIBRATING AUTHENTICATION NODE...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {isConnected ? (
                    <div className="flex items-center gap-2.5 text-emerald-300 font-mono text-xs font-bold">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="truncate">AUTHENTICATED: {connectedEmail}</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-rose-300 text-xs font-mono font-bold">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                        <span>GMAIL CONNECTION INACTIVE</span>
                      </div>
                      <button
                        onClick={connectGmail}
                        className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-lg text-white text-[10px] font-mono font-bold hover:shadow-lg hover:shadow-cyan-500/40 transition-all duration-300"
                      >
                        AUTHORIZE NOW
                      </button>
                    </div>
                  )}

                  {ownerConnected === true && (
                    <div className="text-[10px] font-mono text-purple-300 border-t border-white/10 pt-1.5 flex items-center gap-1.5">
                      <ShieldCheck className="w-3 h-3 text-purple-400 shrink-0" />
                      <span className="truncate">DISPATCH ROUTE: <strong className="text-white">{ownerEmail}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Floating Telemetry Stats Grid (2x2) */}
            <div className="grid grid-cols-2 gap-2.5 text-xs font-mono">
              <div className="p-3 aaa-glass-panel hud-corner rounded-xl border border-cyan-500/25 text-cyan-300">
                <div className="text-slate-400 text-[9px]">BATCH ENGINE</div>
                <div className="font-bold text-xs text-white">8x PARALLEL</div>
              </div>
              <div className="p-3 aaa-glass-panel hud-corner rounded-xl border border-purple-500/25 text-purple-300">
                <div className="text-slate-400 text-[9px]">AUTH VAULT</div>
                <div className="font-bold text-xs text-white">GOOGLE OAUTH</div>
              </div>
              <div className="p-3 aaa-glass-panel hud-corner rounded-xl border border-pink-500/25 text-pink-300">
                <div className="text-slate-400 text-[9px]">PRECHECK MATRIX</div>
                <div className="font-bold text-xs text-white">100% ACCURACY</div>
              </div>
              <div className="p-3 aaa-glass-panel hud-corner rounded-xl border border-emerald-500/25 text-emerald-300">
                <div className="text-slate-400 text-[9px]">DATABASE STORE</div>
                <div className="font-bold text-xs text-white">ENCRYPTED MONGO</div>
              </div>
            </div>
          </div>

          {/* Right Column: 2 Main Command Module Cards */}
          <div className="md:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-up">
            {/* Bulk Emails Card Module */}
            <Link href="/bulk-emails" className="group text-left block">
              <div className="h-full rounded-2xl aaa-glass-card-interactive hud-corner p-5 flex flex-col justify-between cursor-pointer border border-cyan-500/30">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2.5 bg-cyan-500/15 border border-cyan-500/30 rounded-xl text-cyan-400">
                      <Rocket className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform duration-300" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30 uppercase tracking-widest">
                      MODULE_01
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-cyan-300 transition-colors">
                    Mass Mail Commander
                  </h3>
                  <p className="text-slate-300/80 text-[11px] leading-relaxed font-medium">
                    Upload spreadsheets, write dynamic variable templates, attach documents, and send optimized emails with auto-skip prechecks.
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 text-cyan-400 font-mono text-[10px] font-bold group-hover:text-pink-300 transition-colors">
                  <span>LAUNCH COMMANDER</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>

            {/* Sent Emails Tracker Module */}
            <Link href="/sent-emails" className="group text-left block">
              <div className="h-full rounded-2xl aaa-glass-card-interactive hud-corner p-5 flex flex-col justify-between cursor-pointer border border-purple-500/30">
                <div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="p-2.5 bg-purple-500/15 border border-purple-500/30 rounded-xl text-purple-400">
                      <MailOpen className="w-5 h-5 group-hover:rotate-12 transition-transform duration-300" />
                    </div>
                    <span className="text-[9px] font-mono font-bold text-purple-300 bg-purple-500/15 px-2 py-0.5 rounded-full border border-purple-500/30 uppercase tracking-widest">
                      MODULE_02
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1 group-hover:text-purple-300 transition-colors">
                    Sent Campaign Tracker
                  </h3>
                  <p className="text-slate-300/80 text-[11px] leading-relaxed font-medium">
                    Inspect recently sent campaigns, analyze subject and delivery performance, search logs, and export reports to Excel formats.
                  </p>
                </div>

                <div className="mt-4 flex items-center gap-2 text-purple-400 font-mono text-[10px] font-bold group-hover:text-cyan-300 transition-colors">
                  <span>ANALYZE HISTORY</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1.5 transition-transform duration-300" />
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Footer Feature Telemetry */}
        <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-center gap-6 text-slate-400 text-[10px] font-mono animate-fade-up">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3 h-3 text-cyan-400" />
            <span>BATCH DISPATCH: 8x PARALLEL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Lock className="w-3 h-3 text-purple-400" />
            <span>ENCRYPTED REFRESH VAULT</span>
          </div>
          <div className="flex items-center gap-1.5">
            <BarChart3 className="w-3 h-3 text-pink-400" />
            <span>REALTIME TELEMETRY LOGS</span>
          </div>
        </div>
      </div>
    </div>
  );
}
