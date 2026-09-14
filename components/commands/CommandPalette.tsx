"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useI18n, type TranslationKey } from "@/components/i18n/I18nProvider";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
import { createQueryDebouncer } from "@/libs/search/queryDebouncer";
import { searchDocuments } from "@/libs/search/rank";
import {
  scopeFromPathname,
  widerScopes,
  type SearchScope,
} from "@/libs/search/scope";
import type { SearchDocument } from "@/libs/search/types";

const OPEN_EVENT = "novelndex:open-command-palette";
export const CHAPTER_SEARCH_SOURCE_EVENT = "novelndex:chapter-search-source";
type Command = {
  id: string;
  label: string;
  hint: string;
  href?: string;
  onSelect?: () => void;
  source?: "draft" | "saved";
};
export type ChapterSearchSource = {
  title: string;
  summary: string;
  focusMatch: (
    field: "title" | "summary",
    start: number,
    length: number,
  ) => void;
};

function novelIdFrom(pathname: string) {
  return pathname.match(/^\/novels\/([^/]+)/)?.[1] ?? null;
}
function onChapterPage(pathname: string) {
  return /^\/novels\/[^/]+\/volumes\/[^/]+\/chapters\/[^/]+/.test(pathname);
}
function excerpt(value: string, start: number, length: number) {
  const before = Math.max(0, start - 36),
    after = Math.min(value.length, start + length + 48);
  return `${before > 0 ? "…" : ""}${value.slice(before, after)}${after < value.length ? "…" : ""}`;
}
function occurrences(value: string, query: string) {
  const found: number[] = [];
  const needle = query.toLocaleLowerCase(),
    haystack = value.toLocaleLowerCase();
  if (!needle) return found;
  let position = 0;
  while (position < haystack.length) {
    const next = haystack.indexOf(needle, position);
    if (next < 0) break;
    found.push(next);
    position = next + Math.max(needle.length, 1);
  }
  return found;
}
function currentDraft() {
  let source: ChapterSearchSource | null = null;
  window.dispatchEvent(
    new CustomEvent<(next: ChapterSearchSource) => void>(
      CHAPTER_SEARCH_SOURCE_EVENT,
      {
        detail: (next) => {
          source = next;
        },
      },
    ),
  );
  return source;
}

export function CommandPaletteTrigger({
  iconOnly = false,
}: {
  iconOnly?: boolean;
}) {
  const { t } = useI18n();
  if (iconOnly)
    return (
      <button
        type="button"
        onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
        aria-label={t("novels.quickSearch")}
        aria-haspopup="dialog"
        title={`${t("novels.quickSearch")} (Ctrl+Shift+K)`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400">
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round">
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      </button>
    );
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}
      className="flex w-full items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white/80 px-4 py-3 text-left text-sm text-stone-500 shadow-sm transition hover:border-stone-300 hover:bg-white">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-medium text-stone-700">
          {t("novels.quickSearch")}
        </span>
        <span className="block truncate text-xs text-stone-500">
          {t("novels.quickSearchHelp")}
        </span>
      </span>
      <kbd className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-xs font-semibold text-stone-600">
        Ctrl ⇧ K
      </kbd>
    </button>
  );
}

export default function CommandPalette() {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const { index, documents, status } = useSearchIndex();
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState(""),
    [draft, setDraft] = useState<ChapterSearchSource | null>(null),
    [scopeOverride, setScopeOverride] = useState<SearchScope | null>(null),
    [debouncedQuery, setDebouncedQuery] = useState(""),
    [activeIndex, setActiveIndex] = useState(0);
  const debouncer = useRef(createQueryDebouncer(setDebouncedQuery));
  const chapterPage = onChapterPage(pathname);
  const novelId = novelIdFrom(pathname);
  const routeScope = useMemo(() => scopeFromPathname(pathname), [pathname]);
  const scope = scopeOverride ?? routeScope;
  const widenOptions = useMemo(() => widerScopes(scope), [scope]);
  const results = useMemo(
    () =>
      !debouncedQuery.trim() || !index
        ? []
        : searchDocuments(index, documents, debouncedQuery, scope),
    [debouncedQuery, documents, index, scope],
  );
  const navigation = useMemo<Command[]>(
    () => [
      ...(novelId
        ? [
            {
              id: "overview",
              label: t("command.novelOverview"),
              hint: t("command.novelOverviewHint"),
              href: `/novels/${novelId}`,
            },
            {
              id: "characters",
              label: t("command.characters"),
              hint: t("command.charactersHint"),
              href: `/novels/${novelId}/characters`,
            },
            {
              id: "entities",
              label: t("command.entities"),
              hint: t("command.entitiesHint"),
              href: `/novels/${novelId}/entities`,
            },
            {
              id: "timeline",
              label: t("command.timeline"),
              hint: t("command.timelineHint"),
              href: `/novels/${novelId}/timeline`,
            },
          ]
        : []),
      {
        id: "novels",
        label: t("command.allNovels"),
        hint: t("command.allNovelsHint"),
        href: "/novels",
      },
    ],
    [novelId, t],
  );
  useEffect(() => () => debouncer.current.cancel(), []);
  const closePalette = useCallback(() => {
    setOpen(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);
  const openPalette = useCallback(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    debouncer.current.cancel();
    setQuery("");
    setDebouncedQuery("");
    setScopeOverride(null);
    setActiveIndex(0);
    setDraft(chapterPage ? currentDraft() : null);
    setOpen(true);
  }, [chapterPage]);
  useEffect(() => {
    const listener = () => openPalette();
    const key = (event: KeyboardEvent) => {
      if (
        (event.ctrlKey || event.metaKey) &&
        event.shiftKey &&
        (event.code === "KeyK" || event.key.toLocaleLowerCase() === "k")
      ) {
        event.preventDefault();
        openPalette();
      }
      if (event.key === "Escape") closePalette();
    };
    window.addEventListener(OPEN_EVENT, listener);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener(OPEN_EVENT, listener);
      window.removeEventListener("keydown", key);
    };
  }, [closePalette, openPalette]);
  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);
  const resultToCommand = useCallback(
    (document: SearchDocument): Command => {
      const parentChapter =
        document.chapterId && document.volumeId
          ? documents.get(
              `chapter:${document.novelId}:${document.volumeId}:${document.chapterId}`,
            )
          : undefined;
      const parentVolume = document.volumeId
        ? documents.get(`volume:${document.novelId}:${document.volumeId}`)
        : undefined;
      const context = [
        parentVolume?.name
          ? `${t("command.volumeLabel")} ${parentVolume.name}`
          : null,
        parentChapter?.name ?? null,
      ]
        .filter(Boolean)
        .join(" · ");
      const key =
        `command.resultType.${document.type === "entity" && document.entityType ? document.entityType : document.type}` as TranslationKey;
      const text = document.content ?? document.description ?? "";
      return {
        id: document.id,
        label: document.title ?? document.name ?? t(key),
        hint: [t(key), context, text.slice(0, 140)].filter(Boolean).join(" · "),
        href: document.route,
        source: "saved",
      };
    },
    [documents, t],
  );
  const draftMatches = useMemo<Command[]>(() => {
    if (!chapterPage || !draft || !query.trim()) return [];
    const term = query.trim();
    return [
      ...occurrences(draft.title, term).map((start) => ({
        id: `title:${start}`,
        label: draft.title,
        hint: `${t("command.matchInTitle")} · ${excerpt(draft.title, start, term.length)}`,
        onSelect: () => draft.focusMatch("title", start, term.length),
        source: "draft" as const,
      })),
      ...occurrences(draft.summary, term).map((start) => ({
        id: `summary:${start}`,
        label: t("command.matchInSummary"),
        hint: excerpt(draft.summary, start, term.length),
        onSelect: () => draft.focusMatch("summary", start, term.length),
        source: "draft" as const,
      })),
    ];
  }, [chapterPage, draft, query, t]);
  const savedMatches = useMemo(
    () =>
      results.map((document) => {
        const command = resultToCommand(document);
        return document.type === "note" && query.trim()
          ? {
              ...command,
              href: `${document.route}&find=${encodeURIComponent(query.trim())}`,
            }
          : command;
      }),
    [query, results, resultToCommand],
  );
  const matches = useMemo(
    () =>
      !query.trim()
        ? chapterPage
          ? []
          : navigation
        : chapterPage
          ? [...draftMatches, ...savedMatches]
          : savedMatches,
    [chapterPage, draftMatches, navigation, query, savedMatches],
  );
  const pending =
    Boolean(query.trim()) && (status !== "ready" || query !== debouncedQuery);
  const empty = pending
    ? status === "error"
      ? t("command.indexError")
      : t("command.indexLoading")
    : chapterPage
      ? t("command.noChapterMatches")
      : t("command.noMatches");
  const select = (command: Command) => {
    closePalette();
    if (command.onSelect) command.onSelect();
    else if (command.href) router.push(command.href);
  };
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/25 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={closePalette}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("command.ariaLabel")}
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}>
        <div className="border-b border-stone-200 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-stone-500">
            <span>{t(`command.scope.${scope.kind}` as TranslationKey)}</span>
            {widenOptions.map((option) => (
              <button
                key={option.kind}
                type="button"
                onClick={() => setScopeOverride(option)}
                className="rounded-full border border-stone-200 px-2 py-0.5 hover:border-stone-400 hover:text-stone-900">
                {t("command.widenTo", {
                  scope: t(`command.scope.${option.kind}` as TranslationKey),
                })}
              </button>
            ))}
          </div>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
              debouncer.current.handleInput(event.target.value);
            }}
            onCompositionStart={() =>
              debouncer.current.handleCompositionStart()
            }
            onCompositionEnd={(event) =>
              debouncer.current.handleCompositionEnd(event.currentTarget.value)
            }
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) =>
                  Math.min(index + 1, Math.max(0, matches.length - 1)),
                );
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              } else if (event.key === "Enter" && matches[activeIndex])
                select(matches[activeIndex]);
            }}
            placeholder={
              chapterPage
                ? t("command.chapterPlaceholder")
                : t("command.placeholder")
            }
            className="w-full rounded-xl bg-stone-50 px-4 py-3 text-sm text-stone-900 outline-none ring-stone-900/20 placeholder:text-stone-400 focus:ring-2"
          />
        </div>
        <div role="listbox" className="max-h-80 overflow-y-auto p-2">
          {matches.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-stone-500">
              {empty}
            </p>
          ) : (
            <>
              {chapterPage && draftMatches.length > 0 && (
                <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-stone-400">
                  {t("command.currentDraft")}
                </p>
              )}
              {matches.map((command, position) => (
                <div key={command.id}>
                  {chapterPage &&
                    command.source === "saved" &&
                    position === draftMatches.length && (
                      <p className="px-3 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-stone-400">
                        {t("command.savedContent")}
                      </p>
                    )}
                  <button
                    role="option"
                    aria-selected={position === activeIndex}
                    type="button"
                    onClick={() => select(command)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left ${position === activeIndex ? "bg-stone-100" : "hover:bg-stone-100"}`}>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-stone-900">
                        {command.label}
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-stone-500">
                        {command.hint}
                      </span>
                    </span>
                    <span
                      aria-hidden="true"
                      className="shrink-0 text-stone-400">
                      →
                    </span>
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
        <div className="border-t border-stone-100 px-4 py-2 text-xs text-stone-400">
          {t("command.hint")}
        </div>
      </div>
    </div>
  );
}
