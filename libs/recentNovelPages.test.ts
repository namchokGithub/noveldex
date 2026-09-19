import { describe, expect, it } from "vitest";

import {
  RECENT_NOVEL_PAGE_TTL_MS,
  recordRecentNovelPage,
  visibleRecentNovelPages,
} from "./recentNovelPages";

const now = 1_000_000;

describe("recent novel pages", () => {
  it("keeps the three most recent distinct pages", () => {
    const first = recordRecentNovelPage([], { href: "/novels/n/characters/a", label: "Character detail" }, now);
    const second = recordRecentNovelPage(first, { href: "/novels/n/volumes/v/chapters/c", label: "Chapter detail" }, now + 1);
    const third = recordRecentNovelPage(second, { href: "/novels/n/entities/e", label: "Entity detail" }, now + 2);
    const recent = recordRecentNovelPage(third, { href: "/novels/n/volumes/v/adaptations/a", label: "Adaptation detail" }, now + 3);

    expect(recent.map((page) => page.href)).toEqual([
      "/novels/n/volumes/v/adaptations/a",
      "/novels/n/entities/e",
      "/novels/n/volumes/v/chapters/c",
    ]);
  });

  it("removes expired, current, and primary shortcut pages from the flyout", () => {
    const pages = [
      { href: "/novels/n/entities", label: "Entities", visitedAt: now },
      { href: "/novels/n/characters/a", label: "Character detail", visitedAt: now - 1 },
      { href: "/novels/n/old", label: "Old", visitedAt: now - RECENT_NOVEL_PAGE_TTL_MS - 1 },
    ];

    expect(
      visibleRecentNovelPages(pages, now, "/novels/n/characters/a", ["/novels/n/entities"]),
    ).toEqual([]);
  });

  it("keeps a specific chapter label when the generic route tracker runs later", () => {
    const pages = [
      { href: "/novels/n/volumes/v/chapters/c", label: "Ch. 7", visitedAt: now },
    ];

    expect(
      recordRecentNovelPage(
        pages,
        { href: "/novels/n/volumes/v/chapters/c", label: "Chapter detail" },
        now + 1,
      )[0],
    ).toMatchObject({ label: "Ch. 7" });
  });
});
