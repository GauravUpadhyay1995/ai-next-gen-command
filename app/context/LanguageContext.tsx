"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { LanguageCode, LANGUAGES, LanguageOption, translations } from "../locales";

interface LanguageContextType {
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  t: (key: string, fallback?: string) => string;
  languages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    try {
      const stored = localStorage.getItem("fetchmail_user_lang") as LanguageCode;
      if (stored && translations[stored]) {
        setLanguageState(stored);
      }
    } catch (e) {
      console.error("Failed to read language preference from localStorage:", e);
    }
  }, []);

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("fetchmail_user_lang", lang);
    } catch (e) {
      console.error("Failed to save language preference to localStorage:", e);
    }
  };

  const t = (key: string, fallback?: string): string => {
    const langDict = translations[language] || translations.en;
    if (langDict[key]) {
      return langDict[key];
    }
    // Fallback to English dictionary
    if (translations.en[key]) {
      return translations.en[key];
    }
    return fallback || key;
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        languages: LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
