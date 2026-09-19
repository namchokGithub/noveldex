"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Boxes, Clapperboard, Clock3, History, House, Library, Menu, Users, type LucideIcon } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  novelPageLabel,
  readRecentNovelPages,
  recentNovelPageStorageKey,
  recordRecentNovelPage,
  visibleRecentNovelPages,
  type RecentNovelPage,
} from "@/libs/recentNovelPages";

export function novelNavigationItems(novelId: string) {
  const encodedId = encodeURIComponent(novelId);
  return [
    { label: "Home", href: "/novels" },
    { label: "Volume list", href: `/novels/${encodedId}` },
    { label: "Entities", href: `/novels/${encodedId}/entities` },
    { label: "Adaptations", href: `/novels/${encodedId}/adaptations` },
    { label: "Characters", href: `/novels/${encodedId}/characters` },
    { label: "Timeline", href: `/novels/${encodedId}/timeline` },
  ];
}

const navigationIcons: Record<string, LucideIcon> = { Home: House, "Volume list": Library, Entities: Boxes, Adaptations: Clapperboard, Characters: Users, Timeline: Clock3 };

export function NovelFlyoutPanel({
  items,
  recentItems = [],
  onKeyDown,
  onNavigate,
}: {
  items: ReturnType<typeof novelNavigationItems>;
  recentItems?: RecentNovelPage[];
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onNavigate?: () => void;
}) {
  return (
    <div
      role="menu"
      aria-label="Novel navigation"
      onKeyDown={onKeyDown}
      className="absolute left-3 right-3 top-[calc(100%+0.5rem)] z-50 w-auto rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_12px_28px_rgba(28,25,23,0.14)] sm:left-auto sm:right-0 sm:w-88">
      {recentItems.length ? (
        <>
          <p className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Recent</p>
          <div className="space-y-1">
            {recentItems.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                role="menuitem"
                onClick={onNavigate}
                className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
                <History aria-hidden="true" size={15} className="shrink-0 text-stone-400" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        </>
      ) : null}
      <p className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-stone-400">Novel</p>
      <div className="mt-1 grid grid-cols-2 gap-1">
        {items.map(({ label, href }) => {
          const Icon = navigationIcons[label];
          return (
            <Link
              key={href}
              href={href}
              role="menuitem"
              onClick={onNavigate}
              className="flex min-w-0 items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 hover:text-stone-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
              <Icon aria-hidden="true" size={16} className="shrink-0 text-stone-500" />
              <span className="truncate">{label}</span>
            </Link>
          );
        })}
      </div>
      <div className="mt-2 border-t border-stone-100 px-2 pt-2 text-xs text-stone-400">
        <BookOpen aria-hidden="true" size={13} className="mr-1 inline-block" /> Story navigation
      </div>
    </div>
  );
}

export default function NovelFlyoutMenu() {
  const pathname = usePathname();
  const novelId = pathname.match(/^\/novels\/([^/]+)/)?.[1];
  const [open, setOpen] = useState(false);
  const [recentSnapshot, setRecentSnapshot] = useState<{
    pages: RecentNovelPage[];
    now: number;
  }>({ pages: [], now: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node) && !triggerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!novelId) return;
    const now = Date.now();
    const key = recentNovelPageStorageKey(novelId);
    const next = recordRecentNovelPage(
      readRecentNovelPages(window.localStorage.getItem(key)),
      { href: pathname, label: novelPageLabel(pathname, novelId) },
      now,
    );
    window.localStorage.setItem(key, JSON.stringify(next));
    const frame = window.requestAnimationFrame(() =>
      setRecentSnapshot({ pages: next, now }),
    );
    return () => window.cancelAnimationFrame(frame);
  }, [novelId, pathname]);

  if (!novelId) return null;
  const items = novelNavigationItems(novelId);
  const recentItems = visibleRecentNovelPages(
    recentSnapshot.pages,
    recentSnapshot.now,
    pathname,
    items.map(({ href }) => href),
  );

  function focusItem(direction: "first" | "last" | "next" | "previous") {
    const menuItems = Array.from(menuRef.current?.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]') ?? []);
    if (!menuItems.length) return;
    const current = menuItems.indexOf(document.activeElement as HTMLAnchorElement);
    const index = direction === "first" ? 0 : direction === "last" ? menuItems.length - 1 : direction === "next" ? (current + 1 + menuItems.length) % menuItems.length : (current - 1 + menuItems.length) % menuItems.length;
    menuItems[index]?.focus();
  }

  function refreshRecentPages() {
    const now = Date.now();
    const key = recentNovelPageStorageKey(novelId!);
    setRecentSnapshot({
      pages: readRecentNovelPages(window.localStorage.getItem(key)),
      now,
    });
  }

  function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") return void (event.preventDefault(), setOpen(false), triggerRef.current?.focus());
    if (event.key === "ArrowDown") return void (event.preventDefault(), focusItem("next"));
    if (event.key === "ArrowUp") return void (event.preventDefault(), focusItem("previous"));
    if (event.key === "Home") return void (event.preventDefault(), focusItem("first"));
    if (event.key === "End") return void (event.preventDefault(), focusItem("last"));
  }

  return (
    <div className="static sm:relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label="Novel navigation"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => {
          if (!open) refreshRecentPages();
          setOpen((current) => !current);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            refreshRecentPages();
            setOpen(true);
            window.requestAnimationFrame(() => focusItem("first"));
          }
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-stone-600 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <Menu aria-hidden="true" size={18} />
      </button>
      {open ? (
        <div ref={menuRef}>
          <NovelFlyoutPanel
            items={items}
            recentItems={recentItems}
            onKeyDown={onMenuKeyDown}
            onNavigate={() => setOpen(false)}
          />
        </div>
      ) : null}
    </div>
  );
}
