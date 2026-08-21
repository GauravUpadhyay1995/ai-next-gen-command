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

import { useLanguage } from "../context/LanguageContext";

export default function HelpGuideWidget() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"steps" | "flow" | "faq">("steps");

  const steps = [
    {
      num: "01",
      title: t("guide_step1_title"),
      badge: t("guide_step1_badge"),
      icon: ShieldCheck,
      color: "from-cyan-500 to-blue-500",
      textColor: "text-cyan-400",
      desc: t("guide_step1_desc"),
    },
    {
      num: "02",
      title: t("guide_step2_title"),
      badge: t("guide_step2_badge"),
      icon: Calendar,
      color: "from-purple-500 to-pink-500",
      textColor: "text-purple-400",
      desc: t("guide_step2_desc"),
    },
    {
      num: "03",
      title: t("guide_step3_title"),
      badge: t("guide_step3_badge"),
      icon: RefreshCw,
      color: "from-pink-500 to-rose-500",
      textColor: "text-pink-400",
      desc: t("guide_step3_desc"),
    },
    {
      num: "04",
      title: t("guide_step4_title"),
      badge: t("guide_step4_badge"),
      icon: Rocket,
      color: "from-emerald-500 to-teal-500",
      textColor: "text-emerald-400",
      desc: t("guide_step4_desc"),
    },
  ];

  const faqs = [
    {
      q: t("faq1_q"),
      a: t("faq1_a"),
    },
    {
      q: t("faq2_q"),
      a: t("faq2_a"),
    },
    {
      q: t("faq3_q"),
      a: t("faq3_a"),
    },
    {
      q: t("faq4_q"),
      a: t("faq4_a"),
    },
    {
      q: t("faq5_q"),
      a: t("faq5_a"),
    },
  ];

  return (
    <>
      {/* Global Floating Help Trigger Button */}
      <div className="fixed bottom-6 right-6 z-[999] font-mono">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white rounded-full font-bold text-xs shadow-2xl shadow-cyan-500/30 hover:scale-105 active:scale-95 transition-all duration-300 genz-shimmer-btn"
          title={t("how_it_works_tooltip")}
        >
          <span className="relative flex h-3 w-3 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-300"></span>
          </span>
          <HelpCircle className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
          <span className="font-bold tracking-wider hidden sm:inline">{t("how_it_works")}</span>

          {/* Hover Tooltip */}
          <span className="absolute right-0 bottom-full mb-2 hidden group-hover:block whitespace-nowrap bg-slate-900 text-cyan-300 text-[10px] font-mono px-3 py-1.5 rounded-xl border border-cyan-500/30 shadow-xl pointer-events-none animate-fade-up">
            {t("how_it_works_tooltip")}
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
                      {t("guide_title")} <span className="genz-glow-cyan text-xs font-mono">{t("guide_badge")}</span>
                    </h2>
                    <p className="text-slate-400 text-[11px]">{t("guide_subtitle")}</p>
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
                  <span>{t("tab_4step")}</span>
                </button>
                <button
                  onClick={() => setActiveTab("flow")}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "flow"
                    ? "bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>{t("tab_pipeline")}</span>
                </button>
                <button
                  onClick={() => setActiveTab("faq")}
                  className={`flex-1 py-1.5 rounded-xl font-bold transition-all flex items-center justify-center gap-1.5 ${activeTab === "faq"
                    ? "bg-pink-500/20 text-pink-300 border border-pink-500/40 shadow-sm"
                    : "text-slate-400 hover:text-white"
                    }`}
                >
                  <Info className="w-3.5 h-3.5" />
                  <span>{t("tab_faq")}</span>
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

              {/* TAB 2: VISUAL PIPELINE */}
              {activeTab === "flow" && (
                <div className="p-4 bg-slate-950/90 rounded-2xl border border-cyan-500/30 space-y-4 text-center">
                  <div className="text-xs font-bold text-cyan-300 uppercase tracking-widest mb-1">
                    ⚡ {t("flow_header")}
                  </div>

                  <div className="grid gap-2 sm:grid-cols-5 text-left text-[11px]">
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-cyan-500/30 text-cyan-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 1</div>
                      <div className="font-bold text-white mt-0.5">{t("flow_step1")}</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-purple-500/30 text-purple-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 2</div>
                      <div className="font-bold text-white mt-0.5">{t("flow_step2")}</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-pink-500/30 text-pink-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 3</div>
                      <div className="font-bold text-white mt-0.5">{t("flow_step3")}</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-emerald-500/30 text-emerald-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 4</div>
                      <div className="font-bold text-white mt-0.5">{t("flow_step4")}</div>
                    </div>
                    <div className="p-2.5 bg-slate-900 rounded-xl border border-amber-500/30 text-amber-300">
                      <div className="font-bold text-[10px] text-slate-400">STEP 5</div>
                      <div className="font-bold text-white mt-0.5">{t("flow_step5")}</div>
                    </div>
                  </div>

                  <div className="p-3 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-[11px] text-cyan-200 text-left leading-relaxed">
                    💡 <strong>{t("flow_note_bold")}</strong> {t("flow_note_text")}
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
                {t("got_it_close")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
