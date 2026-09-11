"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ShieldAlert,
  Lock,
  ArrowLeft,
  Mail,
  HelpCircle,
  LogOut,
  AlertTriangle,
  CheckCircle2,
  Sparkles
} from "lucide-react";

function UnauthorizedContent() {
  const searchParams = useSearchParams();
  const attemptedEmail = searchParams.get("email") || "your Google Account";

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/";
    } catch {
      window.location.href = "/";
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[#03050c] text-slate-100 flex items-center justify-center p-4">
      {/* Background Aura */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/4 w-[28rem] h-[28rem] bg-rose-600/15 rounded-full filter blur-[120px] animate-aura-1"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[28rem] h-[28rem] bg-purple-600/15 rounded-full filter blur-[120px] animate-aura-2"></div>
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(244,63,94,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.2) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        ></div>
      </div>

      <div className="relative z-10 max-w-lg w-full genz-glass-panel rounded-3xl p-6 sm:p-8 border border-rose-500/40 shadow-2xl space-y-6 text-center animate-fade-up">
        {/* Lock Icon Badge */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-lg shadow-rose-950/50">
          <ShieldAlert className="w-8 h-8 animate-pulse" />
        </div>

        <div className="space-y-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-500/15 border border-rose-500/30 rounded-full text-[10px] font-mono font-bold text-rose-300 uppercase">
            <AlertTriangle className="w-3 h-3 text-rose-400" />
            <span>ACCESS RESTRICTED • PENDING APPROVAL</span>
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Authorization Required
          </h1>

          <p className="text-slate-300 text-xs sm:text-sm font-mono leading-relaxed">
            The account <strong className="text-rose-300">{attemptedEmail}</strong> is not on the Superadmin authorized customer whitelist.
          </p>
        </div>

        {/* Why this happens box */}
        <div className="p-4 bg-slate-950/80 rounded-2xl border border-white/10 text-left font-mono text-xs space-y-2 text-slate-300">
          <div className="text-slate-400 font-bold flex items-center gap-1.5 text-[11px] border-b border-white/10 pb-1.5">
            <Lock className="w-3.5 h-3.5 text-rose-400" />
            <span>WHY IS MY ACCESS LOCKED?</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            To protect mail server reputations and sending limits, this application operates on a <strong>Superadmin Whitelist</strong>. Only approved customer emails are permitted to access the dispatch matrix.
          </p>
          <div className="text-[11px] text-emerald-400 font-bold flex items-center gap-1.5 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Ask the platform owner to whitelist your email address.</span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2 font-mono text-xs">
          <button
            onClick={handleLogout}
            className="w-full sm:flex-1 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/10 text-slate-300 rounded-xl font-bold flex items-center justify-center gap-1.5 transition-all"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-400" />
            <span>Switch Account</span>
          </button>

          <Link
            href="/"
            className="w-full sm:flex-1 py-2.5 bg-gradient-to-r from-rose-500 via-purple-600 to-cyan-500 text-white rounded-xl font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-rose-950/50 genz-shimmer-btn"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Station</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#03050c] flex items-center justify-center text-slate-400 font-mono text-xs">
          Loading access verification...
        </div>
      }
    >
      <UnauthorizedContent />
    </Suspense>
  );
}
