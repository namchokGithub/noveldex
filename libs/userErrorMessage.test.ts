import { expect, it } from "vitest";
import type { TranslationKey } from "@/components/i18n/I18nProvider";
import { userErrorMessage } from "./userErrorMessage";

const translate = (key: TranslationKey, values?: Record<string, string | number>) =>
  values ? `${key}:${JSON.stringify(values)}` : key;

it("localizes required English titles returned by chapter and volume mutations", () => {
  expect(
    userErrorMessage(new Error("English chapter title is required"), translate),
  ).toBe("common.englishTitleRequired");
  expect(
    userErrorMessage(new Error("English volume title is required"), translate),
  ).toBe("common.englishTitleRequired");
});

it("keeps unknown errors safe for users", () => {
  expect(userErrorMessage(new Error("internal database detail"), translate)).toBe(
    "common.networkError",
  );
});

it("localizes tag length validation returned by tag mutations", () => {
  expect(
    userErrorMessage(
      new Error("Tag names cannot exceed 50 characters."),
      translate,
    ),
  ).toBe('chapter.tagNameTooLong:{"max":50}');
});
