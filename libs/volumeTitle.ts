import type { Volume } from "@/app/types";
import type { Locale } from "@/components/i18n/I18nProvider";

type VolumeTitleSource = Pick<Volume, "title" | "title_en" | "title_th">;

export function localizedVolumeTitle(volume: VolumeTitleSource, language: Locale): string {
  if (language === "th") return volume.title_th || volume.title_en || volume.title;
  return volume.title_en || volume.title;
}
