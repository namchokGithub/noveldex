import { describe, expect, it } from "vitest";
import { matchesScope, scopeFromPathname, widerScopes } from "./scope";
import type { SearchDocument } from "./types";

const document = (overrides: Partial<SearchDocument> = {}): SearchDocument => ({ id: "d", type: "note", novelId: "n1", referenceIds: [], referenceNames: [], referenceTypes: [], aliases: [], tagIds: [], tags: [], route: "/", ...overrides });

describe("SearchScope", () => {
  it("derives the deepest scope from a route", () => {
    expect(scopeFromPathname("/novels/n1/volumes/v1/chapters/c1")).toEqual({ kind: "chapter", novelId: "n1", volumeId: "v1", chapterId: "c1" });
    expect(scopeFromPathname("/novels/n1/volumes/v1")).toEqual({ kind: "volume", novelId: "n1", volumeId: "v1" });
    expect(scopeFromPathname("/novels/n1/timeline")).toEqual({ kind: "novel", novelId: "n1" });
    expect(scopeFromPathname("/novels")).toEqual({ kind: "global" });
  });

  it("widens scope without losing ancestry", () => {
    expect(widerScopes({ kind: "chapter", novelId: "n1", volumeId: "v1", chapterId: "c1" })).toEqual([
      { kind: "volume", novelId: "n1", volumeId: "v1" }, { kind: "novel", novelId: "n1" }, { kind: "global" },
    ]);
  });

  it("uses document placement for membership", () => {
    const note = document({ volumeId: "v1", chapterId: "c1" });
    expect(matchesScope(note, { kind: "chapter", novelId: "n1", volumeId: "v1", chapterId: "c1" })).toBe(true);
    expect(matchesScope(note, { kind: "chapter", novelId: "n1", volumeId: "v1", chapterId: "c2" })).toBe(false);
    expect(matchesScope(document({ type: "entity" }), { kind: "volume", novelId: "n1", volumeId: "v1" })).toBe(false);
  });
});
