import type { Chapter, ChapterNote, Novel, NovelEvent, Tag, Volume } from "@/app/types";
import { formatChapterLabel, type ChapterKindLabels } from "@/libs/chapterLabel";
import type { Entity, EntityId } from "@/libs/entities/types";
import type { VolumeSearchSource } from "@/libs/firebase/volumes";
import type { SearchDocument } from "./types";

export type EntityMap = Map<EntityId, Entity>;

function emptyFields() {
  return { referenceIds: [], referenceNames: [], referenceTypes: [], aliases: [], tagIds: [], tags: [] };
}

function projectReferences(
  sources: Array<{ references?: ChapterNote["references"] | NovelEvent["description_references"] }>,
  entityMap: EntityMap,
) {
  const ids = new Set<EntityId>();
  for (const source of sources) {
    for (const occurrence of source.references ?? []) {
      if (occurrence.token.status === "resolved") ids.add(occurrence.token.reference.entityId);
    }
  }
  const entities = [...ids].map((id) => entityMap.get(id)).filter((entity): entity is Entity => Boolean(entity));
  return {
    referenceIds: entities.map((entity) => entity.id),
    referenceNames: [...new Set(entities.map((entity) => entity.name))],
    referenceTypes: [...new Set(entities.map((entity) => entity.type))],
    aliases: [...new Set(entities.flatMap((entity) => entity.aliases))],
  };
}

export const novelRoute = (novelId: string) => `/novels/${novelId}`;
export const volumeRoute = (novelId: string, volumeId: string) => `${novelRoute(novelId)}/volumes/${volumeId}`;
export const chapterRoute = (novelId: string, volumeId: string, chapterId: string) => `${volumeRoute(novelId, volumeId)}/chapters/${chapterId}`;

export function normalizeNovel(novel: Novel): SearchDocument {
  return { id: `novel:${novel.id}`, type: "novel", novelId: novel.id, title: novel.title, author: novel.author, description: novel.description, ...emptyFields(), route: novelRoute(novel.id) };
}

export function normalizeVolume(volume: Pick<Volume, "id" | "novel_id" | "number" | "title" | "title_en" | "title_th" | "description"> | VolumeSearchSource): SearchDocument {
  return { id: `volume:${volume.novel_id}:${volume.id}`, type: "volume", novelId: volume.novel_id, volumeId: volume.id, name: String(volume.number), title: volume.title, description: volume.description, ...emptyFields(), aliases: [...new Set([volume.title_en, volume.title_th].filter(Boolean))], route: volumeRoute(volume.novel_id, volume.id) };
}

export function normalizeChapter(novelId: string, chapter: Chapter, entityMap: EntityMap, labels: ChapterKindLabels): SearchDocument {
  const titles = [chapter.title_en, chapter.title_th].filter(Boolean);
  return {
    id: `chapter:${novelId}:${chapter.volume_id}:${chapter.id}`, type: "chapter", novelId, volumeId: chapter.volume_id, chapterId: chapter.id,
    name: formatChapterLabel(chapter, labels), title: chapter.title, description: chapter.description,
    ...projectReferences(chapter.notes, entityMap), aliases: [...new Set(titles)], tagIds: chapter.tags.map((tag) => tag.id), tags: chapter.tags.map((tag) => tag.name), route: chapterRoute(novelId, chapter.volume_id, chapter.id),
  };
}

export function normalizeNote(novelId: string, volumeId: string, chapterId: string, note: ChapterNote, tags: Tag[], entityMap: EntityMap): SearchDocument {
  return {
    id: `note:${novelId}:${volumeId}:${chapterId}:${note.id}`, type: "note", novelId, volumeId, chapterId, noteId: note.id, content: note.content,
    ...projectReferences([note], entityMap), tagIds: tags.map((tag) => tag.id), tags: tags.map((tag) => tag.name), route: `${chapterRoute(novelId, volumeId, chapterId)}?note=${encodeURIComponent(note.id)}`,
  };
}

export function normalizeEntity(entity: Entity): SearchDocument {
  const sourceId = entity.id.split(":").slice(2).join(":");
  const route = entity.type === "character" ? `${novelRoute(entity.novelId)}/characters/${sourceId}` : `${novelRoute(entity.novelId)}/entities/${encodeURIComponent(entity.id)}`;
  return { id: `entity:${entity.id}`, type: "entity", novelId: entity.novelId, entityId: entity.id, entityType: entity.type, name: entity.name, description: entity.description, ...emptyFields(), aliases: entity.aliases, route };
}

export function normalizeEvent(event: NovelEvent, linkedChapter: Chapter | null, entityMap: EntityMap, labels: ChapterKindLabels): SearchDocument {
  const linkedLabel = linkedChapter ? formatChapterLabel(linkedChapter, labels) : event.chapter_title ?? "";
  return {
    id: `event:${event.novel_id}:${event.id}`, type: "event", novelId: event.novel_id, volumeId: event.chapter_volume_id ?? undefined, chapterId: event.chapter_id ?? undefined, eventId: event.id,
    title: event.title, content: `${event.description} ${linkedLabel}`.trim(), ...projectReferences([{ references: event.description_references }], entityMap), tagIds: [], tags: [], route: `${novelRoute(event.novel_id)}/timeline#event-${event.id}`,
  };
}
