"use client";

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "../context/LanguageContext";
import { Globe, ChevronDown, Check } from "lucide-react";

export default function LanguageSelector({ className = "" }: { className?: string }) {
  const { language, setLanguage, languages } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentLangObj = languages.find((l) => l.code === language) || languages[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className={`relative inline-block text-left font-mono z-50 ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-cyan-500/40 text-cyan-300 font-bold text-xs shadow-md shadow-cyan-950/40 transition-all duration-300"
        title="Select Application Language"
      >
        <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0 animate-pulse" />
        <span className="hidden xs:inline">{currentLangObj.flag}</span>
        <span className="font-bold text-[11px]">{currentLangObj.nativeLabel}</span>
        <ChevronDown className={`w-3 h-3 text-cyan-400 transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-2xl bg-[#080d1a] border border-cyan-500/40 shadow-2xl p-1.5 z-[999] animate-fade-up">
          <div className="px-2.5 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-white/10 mb-1 flex items-center justify-between">
            <span>Select Language</span>
            <Globe className="w-3 h-3 text-cyan-400" />
          </div>

          <div className="space-y-0.5 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
            {languages.map((lang) => {
              const isSelected = lang.code === language;
              return (
                <button
                  key={lang.code}
                  onClick={() => {
                    setLanguage(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs transition-all ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40"
                      : "text-slate-300 hover:bg-slate-900 hover:text-white"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{lang.flag}</span>
                    <span className="font-medium text-[11px]">{lang.nativeLabel}</span>
                  </div>
                  {isSelected && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
