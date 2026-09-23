import Link from "next/link";
import { notFound } from "next/navigation";
import {
  decodeEntityCursor,
  encodeEntityCursor,
  getEntitiesPage,
  getNovel,
} from "@/libs/api";
import {
  GENERIC_ENTITY_TYPES,
  type Entity,
  type GenericEntityType,
} from "@/libs/entities/types";
import { ResourceNotFoundError } from "@/libs/errors";
import { DashboardPage, SectionHeading, backLinkClassName } from "../../ui";
import EntityList from "./EntityList";
import { T } from "@/components/i18n/I18nProvider";
import { CircleChevronLeft } from "lucide-react";

export default async function EntitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ type?: string; after?: string }>;
}) {
  const { id } = await params;
  const { type: rawType, after = "" } = await searchParams;
  const selectedType = GENERIC_ENTITY_TYPES.includes(
    rawType as GenericEntityType,
  )
    ? (rawType as GenericEntityType)
    : null;
  const cursorHistory = after
    .split(",")
    .filter((value) => decodeEntityCursor(value) !== null);
  const cursor = decodeEntityCursor(cursorHistory.at(-1) ?? "");
  let data: Awaited<ReturnType<typeof getNovel>>;
  let entities: Entity[];
  let nextCursorByType: Partial<Record<GenericEntityType, string>> = {};
  try {
    data = await getNovel(id);
    if (selectedType) {
      const page = await getEntitiesPage(id, selectedType, cursor, 20);
      entities = page.entities;
      if (page.nextCursor)
        nextCursorByType[selectedType] = encodeEntityCursor(page.nextCursor);
    } else {
      const previews = await Promise.all(
        GENERIC_ENTITY_TYPES.map(async (entityType) => {
          const page = await getEntitiesPage(id, entityType, null, 5);
          return [entityType, page] as const;
        }),
      );
      entities = previews.flatMap(([, page]) => page.entities);
      nextCursorByType = Object.fromEntries(
        previews.flatMap(([entityType, page]) =>
          page.nextCursor
            ? [[entityType, encodeEntityCursor(page.nextCursor)] as const]
            : [],
        ),
      );
    }
  } catch (error) {
    if (error instanceof ResourceNotFoundError) notFound();
    throw error;
  }
  return (
    <DashboardPage maxWidth="max-w-5xl">
      <div className="space-y-5">
        <Link href={`/novels/${id}`} className={backLinkClassName}>
          <CircleChevronLeft size={16} strokeWidth={1.8} aria-hidden="true" />
          {data.title}
        </Link>
        <SectionHeading
          eyebrow={<T k="entities.eyebrow" />}
          title={<T k="entities.title" />}
          description={<T k="entities.description" />}
        />
        <EntityList
          key={`${selectedType ?? "all"}:${cursorHistory.join(",")}`}
          novelId={id}
          entities={entities}
          selectedType={selectedType}
          cursorHistory={cursorHistory}
          nextCursorByType={nextCursorByType}
        />
      </div>
    </DashboardPage>
  );
}
