"use client";

import { useI18n } from "@/components/i18n/I18nProvider";

export default function LocalizedVolumePageDescription({ updatedAt }: { updatedAt: string }) {
  const { language, t } = useI18n();
  const date = new Date(updatedAt);
  const formatted = Number.isNaN(date.getTime()) ? updatedAt : new Intl.DateTimeFormat(language, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
  return <>{t("volume.pageDescription", { date: formatted })}</>;
}
