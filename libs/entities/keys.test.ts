import { describe, expect, it } from "vitest";
import { parseEntityId } from "./keys";

describe("parseEntityId", () => {
  it("parses an entity ID passed through a URL path segment", () => {
    expect(parseEntityId("novel-1%3Alocation%3Aentity-1")).toEqual({
      novelId: "novel-1",
      type: "location",
      sourceRecordId: "entity-1",
    });
  });
});
