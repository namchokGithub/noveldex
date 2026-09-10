import type { TranslationKey } from "@/components/i18n/I18nProvider";

type Translate = (key: TranslationKey, values?: Record<string, string | number>) => string;

export function userErrorMessage(error: unknown, t: Translate): string {
  const message = error instanceof Error ? error.message : "";

  if (message === "chapter number must be a positive integer") {
    return t("chapter.entryNumberRequired");
  }
  if (message === "chapter number already exists in this novel") {
    return t("chapter.entryNumberDuplicate");
  }
  if (message === "a custom label is required for Other") {
    return t("chapter.entryOtherRequired");
  }
  if (message.startsWith("description must be ")) {
    return t("common.descriptionTooLong", { limit: 500 });
  }
  if (message.startsWith("custom label must be ")) {
    return t("chapter.entryCustomLabelTooLong", { limit: 80 });
  }

  return t("common.networkError");
}
