"use client";

import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";

type DateTimePickerProps = {
  value: string;
  onValueChange: (value: string) => void;
  name?: string;
  disabled?: boolean;
  id?: string;
};

function parseLocalDateTime(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  if (!match) return null;
  const [, year, month, day, hour, minute] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return Number.isNaN(date.getTime())
    ? null
    : { date, time: `${hour}:${minute}` };
}

function formatLocalDateTime(date: Date, time: string) {
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${time}`;
}

function sameDay(left: Date, right: Date) {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function DateTimePicker({
  value,
  onValueChange,
  name,
  disabled = false,
  id,
}: DateTimePickerProps) {
  const { language, t } = useI18n();
  const selected = parseLocalDateTime(value);
  const today = new Date();
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const initial = selected?.date ?? today;
    return new Date(initial.getFullYear(), initial.getMonth(), 1);
  });
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const calendarDays = useMemo(() => {
    const first = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      return date;
    });
  }, [visibleMonth]);

  const displayDate = selected
    ? new Date(
        selected.date.getFullYear(),
        selected.date.getMonth(),
        selected.date.getDate(),
        Number(selected.time.slice(0, 2)),
        Number(selected.time.slice(3, 5)),
      )
    : null;
  const displayValue = displayDate
    ? new Intl.DateTimeFormat(language, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(displayDate)
    : t("datePicker.placeholder");
  const monthLabel = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(visibleMonth);
  const weekDays = Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(language, { weekday: "narrow" }).format(
      new Date(2023, 0, index + 1),
    ),
  );

  function selectDate(date: Date) {
    onValueChange(formatLocalDateTime(date, selected?.time ?? "12:00"));
  }

  function selectToday() {
    const time = `${String(today.getHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")}`;
    onValueChange(formatLocalDateTime(today, time));
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1));
  }

  return (
    <div ref={rootRef} className="relative w-full">
      {name ? <input type="hidden" name={name} value={value} /> : null}
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white px-3.5 py-2.5 text-left text-sm shadow-sm outline-none transition hover:border-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-200 disabled:cursor-not-allowed disabled:opacity-50">
        <span className={selected ? "text-stone-900" : "text-stone-400"}>{displayValue}</span>
        <CalendarDays aria-hidden="true" size={17} className="shrink-0 text-stone-500" />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t("datePicker.ariaLabel")}
          className="absolute z-40 mt-2 w-[min(20rem,calc(100vw-3rem))] rounded-[22px] border border-stone-200 bg-white p-3 shadow-[0_20px_50px_rgba(120,108,84,0.18)]">
          <div className="mb-3 flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label={t("common.previous")}
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
              <ChevronLeft aria-hidden="true" size={17} />
            </button>
            <p className="text-sm font-semibold text-stone-900">{monthLabel}</p>
            <button
              type="button"
              aria-label={t("common.next")}
              onClick={() => setVisibleMonth((month) => new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              className="rounded-full p-2 text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
              <ChevronRight aria-hidden="true" size={17} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center">
            {weekDays.map((day, index) => (
              <span key={`${day}-${index}`} className="py-1 text-[11px] font-medium text-stone-400">{day}</span>
            ))}
            {calendarDays.map((date) => {
              const inMonth = date.getMonth() === visibleMonth.getMonth();
              const isSelected = selected && sameDay(date, selected.date);
              return (
                <button
                  key={date.toISOString()}
                  type="button"
                  aria-pressed={Boolean(isSelected)}
                  onClick={() => selectDate(date)}
                  className={`aspect-square rounded-xl text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 ${
                    isSelected
                      ? "bg-stone-900 font-semibold text-stone-50 shadow-sm"
                      : sameDay(date, today)
                        ? "bg-stone-100 font-semibold text-stone-900 hover:bg-stone-200"
                        : inMonth
                          ? "text-stone-700 hover:bg-stone-100"
                          : "text-stone-300 hover:bg-stone-50"
                  }`}>
                  {date.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-stone-100 pt-3">
            <Clock aria-hidden="true" size={16} className="text-stone-500" />
            <input
              type="time"
              value={selected?.time ?? "12:00"}
              onChange={(event) => {
                const date = selected?.date ?? today;
                onValueChange(formatLocalDateTime(date, event.target.value));
              }}
              className="min-w-0 flex-1 rounded-xl border border-stone-200 px-2.5 py-1.5 text-sm text-stone-900 outline-none focus:border-stone-400 focus:ring-2 focus:ring-stone-200"
              aria-label={t("datePicker.time")}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => onValueChange("")}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
              <X aria-hidden="true" size={14} />
              {t("datePicker.clear")}
            </button>
            <button
              type="button"
              onClick={selectToday}
              className="rounded-full bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-50 transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300">
              {t("datePicker.today")}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
