"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { Adaptation } from "@/app/types";
import type { EntityId } from "@/libs/entities/types";
import {
  getEntityReferencePage,
  getAdaptationsForChapterIds,
  type EntityReferenceIndexEntry,
  type EntityReferenceCursor,
} from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { FormError, cardClassName, secondaryButtonClassName } from "../../../ui";

export default function EntityCrossReferences({ novelId, entityId }: { novelId: string; entityId: EntityId }) {
  const { t } = useI18n();
  const [items, setItems] = useState<EntityReferenceIndexEntry[] | null>(null);
  const [nextCursor, setNextCursor] = useState<EntityReferenceCursor | null>(null);
  const [linkedAdaptations, setLinkedAdaptations] = useState<Adaptation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(cursor: EntityReferenceCursor | null) {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await getEntityReferencePage(novelId, entityId, cursor);
      const linked = await getAdaptationsForChapterIds(
        novelId,
        page.items
          .filter((item) => item.source_type === "chapter_note")
          .map((item) => item.source_id),
      );
      setItems((current) => (cursor ? [...(current ?? []), ...page.items] : page.items));
      setLinkedAdaptations((current) =>
        cursor
          ? [...new Map([...current, ...linked].map((item) => [item.id, item])).values()]
          : linked,
      );
      setNextCursor(page.nextCursor);
    } catch (cause) {
      setError(userErrorMessage(cause, t));
    } finally {
      setLoading(false);
    }
  }

  const notes = (items ?? []).filter((item) => item.source_type === "chapter_note");
  const events = (items ?? []).filter((item) => item.source_type === "event");
  const adaptations = (items ?? []).filter((item) => item.source_type === "adaptation_note");

  return (
    <section className={cardClassName}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-500">{t("entities.relatedRecords")}</p>
      {items === null ? (
        <button type="button" className={`${secondaryButtonClassName} mt-4`} onClick={() => void load(null)} disabled={loading}>
          {loading ? t("entities.loadingRelatedRecords") : t("entities.loadRelatedRecords")}
        </button>
      ) : (
        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          {notes.length > 0 ? <RelatedGroup title={t("entities.notes")}>{notes.map((item) => <Link key={item.id} href={`/novels/${novelId}/volumes/${item.volume_id}/chapters/${item.source_id}?note=${encodeURIComponent(item.note_id ?? "")}`} className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950"><p className="font-medium">{item.title}</p><p className="mt-1 line-clamp-2 text-stone-500">{item.preview}</p></Link>)}</RelatedGroup> : null}
          {events.length > 0 ? <RelatedGroup title={t("entities.timelineEvents")}>{events.map((item) => <Link key={item.id} href={`/novels/${novelId}/timeline`} className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">{item.title || t("timeline.title")}</Link>)}</RelatedGroup> : null}
          {adaptations.length > 0 ? <RelatedGroup title={t("entities.adaptations")}>{adaptations.map((item) => <Link key={item.id} href={`/novels/${novelId}/adaptations#adaptation-${item.source_id}`} className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">{item.title}</Link>)}</RelatedGroup> : null}
          {linkedAdaptations.length > 0 ? <RelatedGroup title={t("entities.adaptations")}>{linkedAdaptations.map((item) => <Link key={item.id} href={`/novels/${novelId}/adaptations#adaptation-${item.id}`} className="block rounded-xl px-2 py-1.5 text-sm text-stone-700 transition hover:bg-white hover:text-stone-950">{item.title}</Link>)}</RelatedGroup> : null}
          {items.length === 0 ? <p className="text-sm text-stone-500">—</p> : null}
          {nextCursor ? <button type="button" className={secondaryButtonClassName} onClick={() => void load(nextCursor)} disabled={loading}>{loading ? t("entities.loadingRelatedRecords") : t("common.next")}</button> : null}
        </div>
      )}
      {error ? <FormError>{error}</FormError> : null}
    </section>
  );
}

function RelatedGroup({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-2xl bg-stone-50 p-4 ring-1 ring-stone-200/70"><h2 className="font-semibold text-stone-900">{title}</h2><div className="mt-3 space-y-2">{children}</div></div>;
}
