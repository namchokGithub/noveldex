import type { Locale } from "./I18nProvider";

export type LanguageOption = {
  code: Locale;
  label: string;
  shortLabel: string;
};

// Add a locale here when its dictionary is available in I18nProvider.
export const languageOptions: readonly LanguageOption[] = [
  { code: "en", label: "English", shortLabel: "EN" },
  { code: "th", label: "ไทย", shortLabel: "ไทย" },
];
