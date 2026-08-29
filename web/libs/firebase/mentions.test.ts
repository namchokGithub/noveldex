import { describe, expect, it } from "vitest";
import { extractMentions } from "./mentions";

describe("extractMentions", () => {
  it("extracts [[Name]] mentions from text", () => {
    expect(extractMentions("[[Alice]] met [[Bob]] at the market.")).toEqual(["Alice", "Bob"]);
  });

  it("de-duplicates repeated mentions", () => {
    expect(extractMentions("[[Alice]] and [[Alice]] again.")).toEqual(["Alice"]);
  });

  it("returns an empty array for text with no mentions", () => {
    expect(extractMentions("Nothing here.")).toEqual([]);
  });

  it("returns an empty array for empty input", () => {
    expect(extractMentions("")).toEqual([]);
  });
});
