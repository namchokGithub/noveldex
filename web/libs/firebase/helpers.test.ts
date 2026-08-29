import { describe, expect, it } from "vitest";
import { withCreateTimestamps, withUpdateTimestamp } from "./helpers";

// A plain TypeScript interface — deliberately NOT `Record<string, unknown>` —
// to prove the `T extends object` constraint accepts interface-typed payloads.
interface NovelLikePayload {
  title: string;
}

describe("withCreateTimestamps", () => {
  it("accepts an interface-typed payload and adds created_at/updated_at", () => {
    const payload: NovelLikePayload = { title: "x" };
    const result = withCreateTimestamps(payload);

    expect(result.title).toBe("x");
    expect(result.created_at).toBeDefined();
    expect(result.updated_at).toBeDefined();
  });
});

describe("withUpdateTimestamp", () => {
  it("adds only updated_at, not created_at", () => {
    const payload: NovelLikePayload = { title: "x" };
    const result = withUpdateTimestamp(payload);

    expect(result.title).toBe("x");
    expect(result.updated_at).toBeDefined();
    expect("created_at" in result).toBe(false);
  });
});
