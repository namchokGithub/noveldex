import { describe, expect, it } from "vitest";
import en from "./en";
import th from "./th";

describe("empty-state translations", () => {
  it.each([en, th])("provides chapter list and summary messages", (messages) => {
    expect(messages["chapter.noChapters"]).toBeTruthy();
    expect(messages["chapter.noSummary"]).toBeTruthy();
  });
});
