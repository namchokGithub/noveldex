import { describe, expect, it } from "vitest";
import en from "./en";
import th from "./th";

describe("accessibility translations", () => {
  it.each([en, th])("provides labels for keyboard navigation", (messages) => {
    expect(messages["common.skipToContent"]).toBeTruthy();
    expect(messages["common.previous"]).toBeTruthy();
    expect(messages["common.next"]).toBeTruthy();
    expect(messages["common.showMoreTags"]).toBeTruthy();
  });
});
