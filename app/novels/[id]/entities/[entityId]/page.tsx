import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAdaptationsForNovel,
  getChapterNotesForEntity,
  getEntity,
  getEventsForEntity,
} from "@/libs/api";
import { ResourceNotFoundError } from "@/libs/errors";
import { DashboardPage, backLinkClassName } from "../../../ui";
import EntityDetail from "./EntityDetail";
import EntityCrossReferences from "./EntityCrossReferences";
import EntityNotesEditor from "./EntityNotesEditor";
import { adaptationsForEntity } from "@/libs/entityCrossReferences";
import { CircleChevronLeft } from "lucide-react";
import { T } from "@/components/i18n/I18nProvider";

export default async function EntityPage({
  params,
}: {
  params: Promise<{ id: string; entityId: string }>;
}) {
  const { id, entityId } = await params;
  let entity: Awaited<ReturnType<typeof getEntity>>;
  let notes: Awaited<ReturnType<typeof getChapterNotesForEntity>>;
  let events: Awaited<ReturnType<typeof getEventsForEntity>>;
  let adaptations: Awaited<ReturnType<typeof getAdaptationsForNovel>>;
  try {
    [entity, notes, events, adaptations] = await Promise.all([
      getEntity(id, entityId),
      getChapterNotesForEntity(id, entityId),
      getEventsForEntity(id, entityId),
      getAdaptationsForNovel(id),
    ]);
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  return (
    <DashboardPage maxWidth="max-w-4xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}/entities`} className={backLinkClassName}>
          <CircleChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          <T k="entities.eyebrow" />
        </Link>
        <EntityDetail novelId={id} entity={entity} />
        <EntityNotesEditor novelId={id} entity={entity} />
        <EntityCrossReferences
          novelId={id}
          notes={notes}
          events={events}
          adaptations={adaptationsForEntity(
            adaptations,
            entity.id,
            new Set(notes.map(({ chapter }) => chapter.id)),
          )}
        />
      </div>
    </DashboardPage>
  );
}
