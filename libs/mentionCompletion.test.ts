import { describe, expect, it } from "vitest";
import { completeActiveMention } from "./mentionCompletion";

describe("completeActiveMention", () => {
  it("replaces the active mention query with the selected character", () => {
    expect(completeActiveMention("Meet [[Al", "Alice")).toBe("Meet [[Alice]]");
  });
});
