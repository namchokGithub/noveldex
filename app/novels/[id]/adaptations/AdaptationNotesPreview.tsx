"use client";

import Link from "next/link";
import type { Adaptation } from "@/app/types";
import { secondaryButtonClassName } from "@/app/novels/ui";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function AdaptationNotesPreview({
  adaptation,
}: {
  adaptation: Adaptation;
}) {
  const { t, language } = useI18n();
  const href = `/novels/${adaptation.novel_id}/volumes/${adaptation.volume_id}/adaptations/${adaptation.id}/notes`;
  const notes = adaptation.notes.slice(0, 3);

  return (
    <section className="mt-4 border-t border-stone-200 pt-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-500">
          {t("adaptations.notes")}
        </h4>
        <Link href={href} className={secondaryButtonClassName}>
          {adaptation.notes.length ? t("adaptations.manageNotes") : t("adaptations.addNote")}
        </Link>
      </div>
      {notes.length === 0 ? (
        <p className="py-2 text-sm text-stone-500">{t("adaptations.noNotes")}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {notes.map((note, index) => (
            <article key={note.id} className="min-w-0 rounded-2xl bg-stone-50 p-3 ring-1 ring-stone-200/70">
              <div className="flex items-center justify-between gap-2 text-xs text-stone-500">
                <span>{t("adaptations.noteNumber", { number: index + 1 })}</span>
                <time dateTime={note.updated_at} className="truncate">
                  {new Date(note.updated_at).toLocaleDateString(language)}
                </time>
              </div>
              <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-stone-700">
                {note.content}
              </p>
            </article>
          ))}
          {adaptation.notes.length > 3 ? (
            <Link href={href} className="flex min-h-32 items-center justify-center rounded-2xl border border-dashed border-stone-300 px-4 text-center text-sm font-medium text-stone-600 transition hover:border-stone-400 hover:bg-stone-50 hover:text-stone-950">
              {t("adaptations.viewAllNotes", { count: adaptation.notes.length })} →
            </Link>
          ) : null}
        </div>
      )}
    </section>
  );
}
