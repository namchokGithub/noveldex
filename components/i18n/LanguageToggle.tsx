"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { CommandPaletteTrigger } from "@/components/commands/CommandPalette";
import SignInControl from "@/components/auth/SignInControl";
import ThemeToggle from "@/components/theme/ThemeToggle";

import { useI18n } from "./I18nProvider";
import { languageOptions } from "./languages";

export default function LanguageToggle() {
  const { language, setLanguage, t } = useI18n();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  function closeMenu({ restoreFocus = true } = {}) {
    setOpen(false);
    if (restoreFocus)
      window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (
        !menuRef.current?.contains(event.target as Node) &&
        !triggerRef.current?.contains(event.target as Node)
      )
        closeMenu();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function focusItem(direction: "first" | "last" | "next" | "previous") {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitemradio"]',
      ) ?? [],
    );
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const target =
      direction === "first"
        ? 0
        : direction === "last"
          ? items.length - 1
          : direction === "next"
            ? (current + 1 + items.length) % items.length
            : (current - 1 + items.length) % items.length;
    items[target]?.focus();
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusItem("next");
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusItem("previous");
    }
    if (event.key === "Home") {
      event.preventDefault();
      focusItem("first");
    }
    if (event.key === "End") {
      event.preventDefault();
      focusItem("last");
    }
  }

  return (
    <div className="relative z-45 flex min-w-0 items-center justify-end gap-1 border-b border-white/70 bg-[#fdfaf3]/88 px-3 py-2 shadow-[0_1px_0_rgba(255,255,255,0.8)] backdrop-blur sm:fixed sm:right-4 sm:top-4 sm:rounded-full sm:border sm:border-stone-200/80 sm:border-b sm:p-1.5 sm:shadow-[0_10px_30px_rgba(120,108,84,0.10)]">
      <CommandPaletteTrigger iconOnly />
      <ThemeToggle />
      <div className="relative">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((current) => !current)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setOpen(true);
              window.requestAnimationFrame(() => focusItem("first"));
            }
          }}
          aria-label={t("language.toggleLabel")}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex h-9 items-center gap-1.5 rounded-full px-2.5 text-sm font-medium text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
          <svg
            aria-hidden="true"
            width="17"
            height="17"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M3.5 12h17M12 3.5c2.1 2.3 3.2 5.1 3.2 8.5S14.1 18.2 12 20.5C9.9 18.2 8.8 15.4 8.8 12S9.9 5.8 12 3.5Z" />
          </svg>
          <span>
            {
              languageOptions.find((option) => option.code === language)
                ?.shortLabel
            }
          </span>
          <svg
            aria-hidden="true"
            className="hidden sm:block"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>
        {open ? (
          <div
            ref={menuRef}
            role="menu"
            aria-label={t("language.toggleLabel")}
            onKeyDown={handleMenuKeyDown}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-40 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(28,25,23,0.14)]">
            {languageOptions.map((option) => (
              <button
                key={option.code}
                type="button"
                role="menuitemradio"
                aria-checked={language === option.code}
                onClick={() => {
                  setLanguage(option.code);
                  closeMenu();
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
                <span className="w-3 text-stone-900">
                  {language === option.code ? "✓" : ""}
                </span>
                <span>{option.label}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <SignInControl />
    </div>
  );
}
