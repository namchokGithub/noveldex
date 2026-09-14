import { describe, expect, it } from "vitest";

import { languageOptions } from "./languages";

describe("languageOptions", () => {
  it("lists each currently supported locale with its native name", () => {
    expect(languageOptions).toEqual([
      { code: "en", label: "English", shortLabel: "EN" },
      { code: "th", label: "ไทย", shortLabel: "ไทย" },
    ]);
  });
});
