"use client";

import type { Volume } from "@/app/types";
import { useI18n } from "@/components/i18n/I18nProvider";
import { localizedVolumeTitle } from "@/libs/volumeTitle";

export default function LocalizedVolumeTitle({
  volume,
}: {
  volume: Pick<Volume, "title" | "title_en" | "title_th">;
}) {
  const { language } = useI18n();
  return <>{localizedVolumeTitle(volume, language)}</>;
}
