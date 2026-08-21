"use client";

import React, { useState, useRef, useEffect } from "react";
import { Calendar, ChevronLeft, ChevronRight, X, Check, Info } from "lucide-react";
import { useLanguage } from "../context/LanguageContext";

interface DateRangePickerProps {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  onChange: (start: string, end: string) => void;
  placeholder?: string;
  align?: "left" | "right";
}

export default function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder,
  align = "left",
}: DateRangePickerProps) {
  const { t } = useLanguage();
  const displayPlaceholder = placeholder || t("pick_range_placeholder");
  const [isOpen, setIsOpen] = useState(false);

  const initialDate = startDate ? new Date(startDate) : new Date();
  const [viewYear, setViewYear] = useState(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth()); // 0-indexed

  const [tempStart, setTempStart] = useState<Date | null>(
    startDate ? new Date(startDate) : null
  );
  const [tempEnd, setTempEnd] = useState<Date | null>(
    endDate ? new Date(endDate) : null
  );
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  // Sync internal state when props change
  useEffect(() => {
    setTempStart(startDate ? new Date(startDate) : null);
    setTempEnd(endDate ? new Date(endDate) : null);
  }, [startDate, endDate]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const formatDateStr = (d: Date | null) => {
    if (!d || isNaN(d.getTime())) return "";
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatDisplayStr = (d: Date | null) => {
    if (!d || isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const isFutureDate = (d: Date) => {
    const today = new Date();
    const cleanD = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const cleanToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    return cleanD > cleanToday;
  };

  const isBeyondMaxRange = (d: Date) => {
    if (!tempStart || tempEnd) return false;
    const startTime = new Date(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate()).getTime();
    const dateTime = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const maxMs = 6 * 24 * 60 * 60 * 1000; // 6 days difference = 7 days total range
    return dateTime - startTime > maxMs || dateTime < startTime;
  };

  const handleDayClick = (dayDate: Date) => {
    if (isFutureDate(dayDate)) return;

    if (!tempStart || (tempStart && tempEnd)) {
      // First click: set start date
      setTempStart(dayDate);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      // Second click: set end date
      if (dayDate < tempStart) {
        setTempStart(dayDate);
        setTempEnd(null);
      } else {
        const diffTime = new Date(dayDate.getFullYear(), dayDate.getMonth(), dayDate.getDate()).getTime() -
          new Date(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate()).getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays > 7) {
          // If selected range exceeds 7 days, restart with this day as new start
          setTempStart(dayDate);
          setTempEnd(null);
          return;
        }

        setTempEnd(dayDate);
        onChange(formatDateStr(tempStart), formatDateStr(dayDate));
        setIsOpen(false);
      }
    }
  };

  const isSameDay = (d1: Date | null, d2: Date | null) => {
    if (!d1 || !d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const isBetween = (d: Date, start: Date | null, end: Date | null) => {
    if (!start || !end) return false;
    const time = d.getTime();
    const startTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const endTime = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime();
    return time > startTime && time < endTime;
  };

  const isHoverBetween = (d: Date) => {
    if (!tempStart || tempEnd || !hoverDate) return false;
    const time = d.getTime();
    const startTime = new Date(tempStart.getFullYear(), tempStart.getMonth(), tempStart.getDate()).getTime();
    const hoverTime = new Date(hoverDate.getFullYear(), hoverDate.getMonth(), hoverDate.getDate()).getTime();
    if (hoverTime >= startTime) {
      return time > startTime && time <= hoverTime;
    }
    return false;
  };

  // Build calendar matrix
  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const dayCells = [];
  // Empty padding cells for preceding days
  for (let i = 0; i < firstDayOfMonth; i++) {
    dayCells.push(null);
  }
  // Days of month
  for (let d = 1; d <= daysInMonth; d++) {
    dayCells.push(new Date(viewYear, viewMonth, d));
  }

  const clearSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempStart(null);
    setTempEnd(null);
    onChange("", "");
  };

  const displayText =
    tempStart && tempEnd
      ? `${formatDisplayStr(tempStart)} → ${formatDisplayStr(tempEnd)}`
      : tempStart
        ? `${formatDisplayStr(tempStart)} → Select End Day`
        : displayPlaceholder;

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      {/* Trigger Pill Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border font-mono text-xs transition-all duration-300 ${isOpen || tempStart
            ? "bg-slate-950/90 border-cyan-500/50 text-cyan-300 shadow-md shadow-cyan-950/50"
            : "bg-slate-950/70 border-white/10 text-slate-300 hover:border-cyan-500/40"
          }`}
      >
        <Calendar className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
        <span className="font-bold truncate max-w-[200px] sm:max-w-[240px]">
          {displayText}
        </span>

        {(tempStart || tempEnd) && (
          <span
            onClick={clearSelection}
            className="p-0.5 hover:text-rose-400 text-slate-400 transition-colors ml-1"
            title="Clear Range"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Interactive Month Calendar Popover */}
      {isOpen && (
        <div className={`absolute ${align === "right" ? "right-0" : "left-0"} mt-2 w-[310px] sm:w-[330px] p-4 bg-[#080d1a] border border-cyan-500/40 rounded-2xl shadow-2xl z-[999] animate-fade-up font-mono`}>
          {/* Header Month Navigation */}
          <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2.5">
            <button
              onClick={prevMonth}
              className="p-1 hover:bg-cyan-500/20 text-cyan-300 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-white text-xs tracking-wide">
              {monthNames[viewMonth]} {viewYear}
            </span>
            <button
              onClick={nextMonth}
              className="p-1 hover:bg-cyan-500/20 text-cyan-300 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 7-Day Max Limit Notice Banner */}
          <div className="mb-2.5 px-2.5 py-1 bg-cyan-500/10 border border-cyan-500/30 rounded-lg text-[10px] text-cyan-300 font-bold flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{t("max_7_days_banner")}</span>
          </div>

          {/* Selection Hint */}
          <div className="text-[10px] text-cyan-300/80 mb-2 font-bold flex items-center justify-between">
            <span>
              {!tempStart
                ? t("click_start_day")
                : !tempEnd
                  ? t("click_end_day")
                  : t("range_applied")}
            </span>
            {tempStart && tempEnd && (
              <span className="text-emerald-400 flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" /> APPLIED
              </span>
            )}
          </div>

          {/* Days of Week Row */}
          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 mb-1">
            <span>SU</span>
            <span>MO</span>
            <span>TU</span>
            <span>WE</span>
            <span>TH</span>
            <span>FR</span>
            <span>SA</span>
          </div>

          {/* Calendar Grid Matrix */}
          <div className="grid grid-cols-7 gap-1">
            {dayCells.map((dayDate, idx) => {
              if (!dayDate) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }

              const isStart = isSameDay(dayDate, tempStart);
              const isEnd = isSameDay(dayDate, tempEnd);
              const inRange = isBetween(dayDate, tempStart, tempEnd);
              const inHover = isHoverBetween(dayDate);
              const isFuture = isFutureDate(dayDate);
              const isBeyond7Days = isBeyondMaxRange(dayDate);
              const isDisabled = isFuture || isBeyond7Days;

              let cellStyle = "text-slate-200 hover:bg-cyan-500/20 hover:text-white";
              if (isDisabled) {
                cellStyle = "text-slate-600 opacity-20 cursor-not-allowed pointer-events-none";
              } else if (isStart || isEnd) {
                cellStyle = "bg-gradient-to-r from-cyan-500 to-pink-500 text-white font-black shadow-md scale-105 rounded-lg z-10";
              } else if (inRange) {
                cellStyle = "bg-cyan-500/25 text-cyan-200 font-bold border-y border-cyan-500/30";
              } else if (inHover) {
                cellStyle = "bg-purple-600/30 text-purple-200 font-medium";
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleDayClick(dayDate)}
                  onMouseEnter={() => setHoverDate(dayDate)}
                  disabled={isDisabled}
                  className={`h-8 w-full rounded-lg text-xs font-mono flex items-center justify-center transition-all duration-150 ${cellStyle}`}
                >
                  {dayDate.getDate()}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="mt-3.5 pt-2 border-t border-white/10 flex items-center justify-between text-[11px]">
            <button
              onClick={() => {
                setTempStart(null);
                setTempEnd(null);
                onChange("", "");
              }}
              className="text-slate-400 hover:text-rose-400 transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/40 rounded-lg font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
