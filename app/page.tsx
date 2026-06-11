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
  MailOpen
} from "lucide-react";

export default function Home() {
  const [checkingConnection, setCheckingConnection] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState("");
  const [ownerConnected, setOwnerConnected] = useState<boolean | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");

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
      @keyframes fadeInUp {
        from { opacity: 0; transform: translateY(30px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .animate-float { animation: float 6s ease-in-out infinite; }
      .animate-gradient { background-size: 200% 200%; animation: gradientShift 3s ease infinite; }
      .animate-fade-up { animation: fadeInUp 0.6s ease-out forwards; }
      .glass-card { background: rgba(255, 255, 255, 0.08); backdrop-filter: blur(12px); border: 1px solid rgba(255, 255, 255, 0.15); }
      .hover-glow:hover { box-shadow: 0 0 20px rgba(139, 92, 246, 0.4); transform: translateY(-4px); }
    `;
    document.head.appendChild(style);

    checkGmailConnection();

    return () => {
      document.head.removeChild(style);
    };
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
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"></div>
        <div
          className="absolute bottom-20 right-10 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-float"
          style={{ animationDelay: "2s" }}
        ></div>
        <div
          className="absolute top-1/2 left-1/2 w-80 h-80 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-float"
          style={{ animationDelay: "4s" }}
        ></div>
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 2px 2px, rgba(139,92,246,0.15) 1px, transparent 1px)",
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      <div className="relative z-10 px-4 py-8 mx-auto max-w-4xl w-full text-center">
        {/* Banner Badge */}
        <div className="inline-flex items-center gap-3 px-5 py-2.5 mb-6 glass-card rounded-full border border-purple-500/30 animate-fade-up">
          <Flame className="w-5 h-5 text-orange-400 animate-pulse" />
          <span className="text-sm font-semibold text-transparent bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text">
            FETCHMAIL COMMAND CENTER
          </span>
          <Sparkles className="w-4 h-4 text-purple-400" />
        </div>

        {/* Title */}
        <h1 className="text-6xl md:text-7xl font-black mb-6 tracking-tighter leading-none animate-fade-up" style={{ animationDelay: "0.1s" }}>
          <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
            Power Up Your
          </span>
          <br />
          <span className="bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent animate-gradient">
            Email Operations
          </span>
        </h1>

        {/* Description */}
        <p className="text-xl text-purple-200 max-w-2xl mx-auto mb-10 animate-fade-up" style={{ animationDelay: "0.2s" }}>
          A next-generation client to send templates to mailing lists dynamically, verify sent history, and bypass duplicate deliveries automatically.
        </p>

        {/* Connection Status Section */}
        <div className="mb-12 max-w-md mx-auto animate-fade-up space-y-3" style={{ animationDelay: "0.3s" }}>
          {checkingConnection ? (
            <div className="flex items-center justify-center gap-3 p-4 glass-card rounded-xl">
              <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
              <span className="text-purple-200 text-sm">Checking authentication status...</span>
            </div>
          ) : (
            <>
              {isConnected ? (
                <div className="flex items-center justify-center gap-3 p-4 bg-emerald-500/20 border border-emerald-500/30 rounded-xl text-emerald-300">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium text-sm">
                    Logged in as {connectedEmail}
                  </span>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                  <div className="flex items-center gap-2.5 text-red-300 text-sm">
                    <AlertCircle className="w-5 h-5" />
                    <span>Gmail not connected</span>
                  </div>
                  <button
                    onClick={connectGmail}
                    className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-white text-xs font-semibold hover:shadow-xl transition-all"
                  >
                    Connect Now
                  </button>
                </div>
              )}

              {ownerConnected === false && (
                <div className="flex items-center justify-center gap-2.5 p-3 bg-amber-500/20 border border-amber-500/30 rounded-xl text-amber-300 text-xs animate-slide-in">
                  <AlertCircle className="w-4 h-4 shrink-0 animate-pulse" />
                  <span>
                    Owner Gmail is not connected. Fetching/sending is inactive.
                  </span>
                </div>
              )}

              {ownerConnected === true && (
                <div className="flex items-center justify-center gap-2.5 p-3 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 text-xs animate-slide-in">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>
                    Campaigns will run via owner: <strong>{ownerEmail}</strong>
                  </span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Main Grid Navigation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-3xl mx-auto animate-fade-up" style={{ animationDelay: "0.4s" }}>
          {/* Bulk Emails Card */}
          <Link href="/bulk-emails" className="group text-left block">
            <div className="h-full rounded-2xl glass-card p-8 hover-glow transition-all duration-300 flex flex-col justify-between cursor-pointer border border-white/10 hover:border-purple-500/40">
              <div>
                <div className="p-4 bg-purple-500/10 rounded-xl inline-block mb-6">
                  <Rocket className="w-8 h-8 text-purple-400 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Bulk Campaign Sender</h3>
                <p className="text-purple-200/70 text-sm leading-relaxed">
                  Upload mailing spreadsheets, write dynamically variable templates, attach files, and send optimized emails with auto-skip and quota-friendly prechecks.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-purple-400 font-semibold text-sm group-hover:text-pink-400 transition-colors">
                <span>Start campaign</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>

          {/* Sent Emails Card */}
          <Link href="/sent-emails" className="group text-left block">
            <div className="h-full rounded-2xl glass-card p-8 hover-glow transition-all duration-300 flex flex-col justify-between cursor-pointer border border-white/10 hover:border-pink-500/40">
              <div>
                <div className="p-4 bg-pink-500/10 rounded-xl inline-block mb-6">
                  <MailOpen className="w-8 h-8 text-pink-400 group-hover:rotate-6 transition-transform" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">Sent Campaign Tracker</h3>
                <p className="text-purple-200/70 text-sm leading-relaxed">
                  Inspect recently sent campaigns, analyze subjects and delivery stats, search logs, and export reports directly to Excel spreadsheet formats.
                </p>
              </div>
              <div className="mt-8 flex items-center gap-2 text-pink-400 font-semibold text-sm group-hover:text-purple-400 transition-colors">
                <span>Analyze history</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
