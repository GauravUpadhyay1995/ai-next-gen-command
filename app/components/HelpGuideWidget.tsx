"use client";

import React, { useState } from "react";
import {
  HelpCircle,
  X,
  Sparkles,
  Zap,
  Calendar,
  Rocket,
  ShieldCheck,
  RefreshCw,
  Info
} from "lucide-react";

export default function HelpGuideWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "flow" | "faq">("steps");

  const steps = [
    {
      num: "01",
      title: "Account Connect Kijiye",
      badge: "OAuth 2.0 Secure",
      icon: ShieldCheck,
      color: "from-cyan-500 to-blue-500",
      textColor: "text-cyan-400",
      desc: "'Click To Connect Your Account' (ya 'AUTHORIZE YOUR ACCOUNT NOW') button par click karke apna Gmail/Google account safely connect kijiye. Connect hone par green badge 'Your Account Is Connected' dikhega.",
    },
    {
      num: "02",
      title: "Calendar Date Range Select Kijiye",
      badge: "Max 7 Days Limit",
      icon: Calendar,
      color: "from-purple-500 to-pink-500",
      textColor: "text-purple-400",
      desc: "Calendar Date Range picker par click kijiye. Pehle Start Day (jaise 1st) aur phir End Day (jaise 7th) select kijiye. Aane waali future dates blocked hain aur ek query me maximum 7-day range hi select ho sakti hai.",
    },
    {
      num: "03",
      title: "Sent Mail Logs Fetch Kijiye",
      badge: "Auto Deduplication",
      icon: RefreshCw,
      color: "from-pink-500 to-rose-500",
      textColor: "text-pink-400",
      desc: "Account connect hone AUR Date Range select hone par 'Fetch Sent Logs' button enable ho jayega! Is par click karte hi aapke sent folder se recipient contacts automatic parse aur load ho jaate hain.",
    },
    {
      num: "04",
      title: "Campaign Launch & Bulk Dispatch",
      badge: "8x Fast Speed",
      icon: Rocket,
      color: "from-emerald-500 to-teal-500",
      textColor: "text-emerald-400",
      desc: "'🚀 Launch Campaign' button dabakar contacts ko campaign editor me load kijiye. Apni PDF Resume attach kijiye, template variables ({{name}}, {{company}}) likhiye aur bulk dispatch start kijiye!",
    },
  ];

  const faqs = [
    {
      q: "'Fetch Sent Logs' ya 'FETCH & AUTO-LOAD' button disabled kyun hai?",
      a: "Ye button tabhi enable hoga jab 2 cheezein hongi: (1) Aapka Mail Account connected ho, AUR (2) Aapne Calendar se Date Range choose kar li ho. Ispar mouse le jaane par tooltip bhi batayegi.",
    },
    {
      q: "Ek baar me maximum kitne din ke mails fetch kar sakte hain?",
      a: "Aap ek baar me maximum 7 days ke mails fetch kar sakte hain taaki API limit exceed na ho aur fetching super-fast ho.",
    },
    {
      q: "Kya calendar me aane waali (future) dates select kar sakte hain?",
      a: "Nahi, aane waali future dates strict disable hain.",
    },
    {
      q: "Kya manual Excel file download ya upload karne ki zaroorat hai?",
      a: "Bilkul nahi! Excel downloading aur uploading ki bilkul zaroorat nahi hai. Sent logs se saare email contacts automatic auto-load ho jaate hain.",
    },
    {
      q: "Duplicate email addresses ka kya hoga?",
      a: "Humara system automatically duplicate email addresses ko remove kar deta hai, taaki ek recipient ko ek se zyada baar mail na jaye.",
    },
  ];

  return (
    <>
      {/* Global Floating Help Trigger Button */}
      <div className="fixed bottom-6 right-6 z-[999] font-mono">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white rounded-full font-bold text-xs shadow-2xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all duration-300 genz-shimmer-btn"
          title="Help Chahiye? Poori Guide & Process Dekhein"
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-300"></span>
          </span>
          <HelpCircle className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
          <span className="font-bold tracking-wider hidden sm:inline">Help Chahiye?</span>

          {/* Hover Tooltip */}
          <span className="absolute right-0 bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-slate-900 text-cyan-300 text-[10px] font-mono px-3 py-1.5 rounded-xl border border-cyan-500/30 shadow-xl pointer-events-none animate-fade-up">
            💡 Kaise Kaam Karta Hai? Poori Guide Dekhein
          </span>
        </button>
      </div>

      {/* Fullscreen Interactive Onboarding Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-[1000] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-fade-up font-mono overflow-y-auto">
          <div className="bg-[#080d1a] border border-cyan-500/40 rounded-3xl p-4 sm:p-6 max-w-2xl w-full shadow-2xl space-y-5 my-auto max-h-[92vh] flex flex-col justify-between">
            {/* Modal Header */}
            <div>
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/40 rounded-xl">
                    <Sparkles className="w-5 h-5 text-cyan-400 animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-black text-white tracking-tight flex items-center gap-2">
                      FETCHMAIL <span className="genz-glow-cyan text-xs font-mono">[ HELP & GUIDE ]</span>
                    </h2>
                    <p className="text-slate-400 text-[11px]">System Kaise Kaam Karta Hai? Poora Process Samjhein</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-2 mt-4 p-1 bg-slate-950/80 rounded-2xl border border-white/10 text-xs">
                <button
                  onClick={() => setActiveTab("steps")}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "steps"
                    ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>4-Step Guide</span>
                </button>
                <button
                  onClick={() => setActiveTab("flow")}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "flow"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Process Map</span>
                </button>
                <button
                  onClick={() => setActiveTab("faq")}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "faq"
                    ? "bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>Sawaal & Jawaab</span>
                </button>
              </div>
            </div>

            {/* Modal Body Content */}
            <div className="overflow-y-auto pr-1 my-2 flex-1 space-y-3 max-h-[55vh]">
              {/* TAB 1: 4-STEP WORKFLOW IN HINGLISH */}
              {activeTab === "steps" && (
                <div className="space-y-3">
                  {steps.map((step, idx) => {
                    const IconComp = step.icon;
                    return (
                      <div
                        key={idx}
                        className="p-3.5 bg-slate-950/80 rounded-2xl border border-white/10 hover:border-cyan-500/30 transition-all flex items-start gap-3.5"
                      >
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${step.color} text-white font-black text-xs shrink-0 shadow-md`}>
                          <IconComp className="w-4 h-4" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-bold text-xs flex items-center gap-2">
                              <span className={step.textColor}>[{step.num}]</span> {step.title}
                            </span>
                            <span className="text-[9px] px-2 py-0.5 bg-slate-900 text-slate-300 rounded-md border border-white/10 font-bold">
                              {step.badge}
                            </span>
                          </div>
                          <p className="text-slate-300/80 text-[11px] leading-relaxed font-normal">
                            {step.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* TAB 2: VISUAL PIPELINE IN HINGLISH */}
              {activeTab === "flow" && (
                <div className="p-4 bg-slate-950/90 rounded-2xl border border-cyan-500/30 space-y-4 text-center">
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-1">
                    ⚡ AUTOMATED CAMPAIGN KA POORA PROCESS MAP
                  </div>

                  <div className="grid gap-2 sm:grid-cols-5 text-left text-[11px]">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-cyan-500/30 text-cyan-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 1</div>
                      <div className="font-bold text-white mt-0.5">Account Connect</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-purple-500/30 text-purple-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 2</div>
                      <div className="font-bold text-white mt-0.5">1-7 Days Range</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-pink-500/30 text-pink-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 3</div>
                      <div className="font-bold text-white mt-0.5">Log Contacts Fetch</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-emerald-500/30 text-emerald-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 4</div>
                      <div className="font-bold text-white mt-0.5">Resume & Template</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-amber-500/30 text-amber-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 5</div>
                      <div className="font-bold text-white mt-0.5">8x Parallel Sending</div>
                    </div>
                  </div>

                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-[11px] text-cyan-200 text-left leading-relaxed">
                    💡 <strong>Excel Handling Ki Zaroorat Nahi:</strong> Mail addresses aapke connected account se direct parse hoke 1 click me dispatch queue me load ho jaate hain!
                  </div>
                </div>
              )}

              {/* TAB 3: FAQs IN HINGLISH */}
              {activeTab === "faq" && (
                <div className="space-y-2.5">
                  {faqs.map((faq, idx) => (
                    <div key={idx} className="p-3 bg-slate-950/80 rounded-2xl border border-white/10 space-y-1">
                      <div className="text-cyan-300 font-bold text-xs flex items-center gap-2">
                        <span className="text-pink-400">Q:</span> {faq.q}
                      </div>
                      <div className="text-slate-300/80 text-[11px] leading-relaxed pl-5">
                        {faq.a}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <span className="text-slate-400 text-[11px]">FetchMail v3.0 Help System</span>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-purple-600 text-white font-bold rounded-xl shadow-md hover:scale-105 transition-all"
              >
                Samajh Gaya, Band Kijiye
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
