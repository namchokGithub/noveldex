import { describe, expect, it } from "vitest";
import { buildIndex } from "./buildIndex";
import { searchDocuments } from "./rank";
import type { SearchDocument } from "./types";

const doc = (overrides: Partial<SearchDocument>): SearchDocument => ({ id: "d", type: "note", novelId: "n1", referenceIds: [], referenceNames: [], referenceTypes: [], aliases: [], tagIds: [], tags: [], route: "/", ...overrides });
const search = (documents: SearchDocument[], query: string) => searchDocuments(buildIndex(documents), new Map(documents.map((document) => [document.id, document])), query, { kind: "global" });

describe("searchDocuments", () => {
  it("ranks exact before fuzzy and titles before content", () => {
    const results = search([doc({ id: "content", content: "Predator skill" }), doc({ id: "title", title: "Predator" }), doc({ id: "fuzzy", title: "Predater" })], "Predator");
    expect(results.map((result) => result.id)).toEqual(["title", "content", "fuzzy"]);
  });

  it("uses prefix only for an incomplete final term", () => {
    const documents = [doc({ id: "exact", title: "Cat" }), doc({ id: "prefix", title: "Category" })];
    expect(search(documents, "Cat").map((result) => result.id)).toContain("prefix");
    expect(search(documents, "Cat ").map((result) => result.id)).toEqual(["exact"]);
  });

  it("filters before ranking", () => {
    const documents = [doc({ id: "in", novelId: "n1", title: "Rimuru" }), doc({ id: "out", novelId: "n2", title: "Rimuru Rimuru" })];
    const index = buildIndex(documents);
    expect(searchDocuments(index, new Map(documents.map((document) => [document.id, document])), "Rimuru", { kind: "novel", novelId: "n1" }).map((result) => result.id)).toEqual(["in"]);
  });
});
