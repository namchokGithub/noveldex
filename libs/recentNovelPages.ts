export const RECENT_NOVEL_PAGE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_RECENT_NOVEL_PAGES = 3;

export type RecentNovelPage = {
  href: string;
  label: string;
  visitedAt: number;
};

type RecentNovelPageInput = Pick<RecentNovelPage, "href" | "label">;

function isFresh(page: RecentNovelPage, now: number) {
  return Number.isFinite(page.visitedAt) && now - page.visitedAt <= RECENT_NOVEL_PAGE_TTL_MS;
}

export function recordRecentNovelPage(
  pages: RecentNovelPage[],
  next: RecentNovelPageInput,
  now: number,
) {
  const existing = pages.find((page) => page.href === next.href);
  const label =
    next.label.endsWith(" detail") && existing && !existing.label.endsWith(" detail")
      ? existing.label
      : next.label;
  return [
    { ...next, label, visitedAt: now },
    ...pages.filter((page) => page.href !== next.href && isFresh(page, now)),
  ].slice(0, MAX_RECENT_NOVEL_PAGES);
}

export function visibleRecentNovelPages(
  pages: RecentNovelPage[],
  now: number,
  currentHref: string,
  primaryHrefs: string[],
) {
  return pages.filter(
    (page) =>
      isFresh(page, now) &&
      page.href !== currentHref &&
      !primaryHrefs.includes(page.href),
  );
}

export function recentNovelPageStorageKey(novelId: string) {
  return `novelndex:recent-novel-pages:${novelId}`;
}

export function readRecentNovelPages(value: string | null): RecentNovelPage[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (page): page is RecentNovelPage =>
        typeof page === "object" &&
        page !== null &&
        typeof page.href === "string" &&
        typeof page.label === "string" &&
        typeof page.visitedAt === "number",
    );
  } catch {
    return [];
  }
}

export function novelPageLabel(href: string, novelId: string) {
  const base = `/novels/${encodeURIComponent(novelId)}`;
  if (href === base) return "Volume list";
  if (href.includes("/chapters/")) return "Chapter detail";
  if (href.includes("/adaptations/")) return "Adaptation detail";
  if (href.startsWith(`${base}/characters/`)) return "Character detail";
  if (href.startsWith(`${base}/entities/`)) return "Entity detail";
  if (href === `${base}/characters`) return "Characters";
  if (href === `${base}/entities`) return "Entities";
  if (href === `${base}/adaptations`) return "Adaptations";
  if (href === `${base}/timeline`) return "Timeline";
  return "Novel page";
}
