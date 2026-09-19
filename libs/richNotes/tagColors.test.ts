import { describe, expect, it } from "vitest";
import { TAG_COLORS, entityReferenceClassName } from "./tagColors";

describe("rich note entity tag colors", () => {
  it("keeps a distinct palette for every entity type", () => {
    expect(TAG_COLORS.location.color).toBe("#047857");
    expect(TAG_COLORS.organization.color).toBe("#B45309");
    expect(TAG_COLORS.concept).toEqual({
      color: "#C49F0E",
      hover: "#F2C411",
      underline: "#B08F0C",
    });
  });

  it("returns the matching static Tailwind class for a reference", () => {
    expect(entityReferenceClassName("skill")).toContain("text-[#7C3AED]");
  });
});
