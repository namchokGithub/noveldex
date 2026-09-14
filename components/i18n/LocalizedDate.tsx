"use client";

import { useI18n } from "./I18nProvider";

export default function LocalizedDate({ value }: { value: string | null | undefined }) {
  const { language } = useI18n();
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return <>{value}</>;
  return <>{new Intl.DateTimeFormat(language, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }).format(date)}</>;
}
