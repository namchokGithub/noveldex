"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useTheme, type ThemePreference } from "./ThemeProvider";

const options: { value: ThemePreference; icon: string }[] = [
  { value: "system", icon: "◐" },
  { value: "light", icon: "☀" },
  { value: "dark", icon: "◑" },
];

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
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
        closeMenu({ restoreFocus: false });
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
    if (event.key === "Escape")
      return void (event.preventDefault(), closeMenu());
    if (event.key === "ArrowDown")
      return void (event.preventDefault(), focusItem("next"));
    if (event.key === "ArrowUp")
      return void (event.preventDefault(), focusItem("previous"));
    if (event.key === "Home")
      return void (event.preventDefault(), focusItem("first"));
    if (event.key === "End")
      return void (event.preventDefault(), focusItem("last"));
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={t("theme.toggleLabel")}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() => focusItem("first"));
          }
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-lg text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <span aria-hidden="true">
          {options.find((option) => option.value === theme)?.icon}
        </span>
      </button>
      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label={t("theme.toggleLabel")}
          onKeyDown={handleMenuKeyDown}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-40 rounded-2xl border border-stone-200 bg-white p-1.5 shadow-[0_12px_28px_rgba(28,25,23,0.14)]">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={theme === option.value}
              onClick={() => {
                setTheme(option.value);
                closeMenu();
              }}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
              <span className="w-3 text-stone-900">
                {theme === option.value ? "✓" : ""}
              </span>
              <span>{t(`theme.${option.value}`)}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
