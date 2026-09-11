import { describe, expect, it } from "vitest";
import { processTerm, tokenize } from "./tokenize";

describe("tokenize", () => {
  it("splits English punctuation and whitespace", () => expect(tokenize("Rimuru, the slime.")).toEqual(["Rimuru", "the", "slime"]));
  it("segments Thai text without whitespace", () => expect(tokenize("ประเทศไทยมีประชากร").length).toBeGreaterThan(1));
  it("keeps mixed whitespace-delimited text searchable without Segmenter", () => expect(tokenize("Rimuru เทมเพส", { segmenter: null })).toEqual(["Rimuru", "เทมเพส"]));
  it("preserves Thai combining marks", () => expect(tokenize("น้ำท่วม").join("")).toContain("้"));
});

describe("processTerm", () => {
  it("normalizes and case-folds Latin text", () => expect(processTerm("RIMURU é")).toBe("rimuru é"));
  it("rejects empty terms", () => expect(processTerm("  ")).toBe(false));
});
