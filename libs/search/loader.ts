import { getAllCharacters, getChaptersFlatDetailed, getEntities, getEvents, getNovels, getVolumesFlat } from "@/libs/api";
import type { ChapterKindLabels } from "@/libs/chapterLabel";
import { buildEntityId } from "@/libs/entities/keys";
import type { Entity } from "@/libs/entities/types";
import { normalizeChapter, normalizeEntity, normalizeEvent, normalizeNote, normalizeNovel, normalizeVolume, type EntityMap } from "./normalize";
import type { SearchDocument } from "./types";

async function loadNovel(novelId: string, labels: ChapterKindLabels): Promise<{ documents: SearchDocument[]; entities: Entity[] }> {
  const [volumes, chapters, characters, genericEntities, events] = await Promise.all([
    getVolumesFlat(novelId), getChaptersFlatDetailed(novelId), getAllCharacters(novelId), getEntities(novelId), getEvents(novelId),
  ]);
  const entities: Entity[] = [
    ...characters.map((character) => ({ id: buildEntityId(novelId, "character", character.id), novelId, type: "character" as const, name: character.name, aliases: character.aliases, description: character.description })),
    ...genericEntities,
  ];
  const entityMap: EntityMap = new Map(entities.map((entity) => [entity.id, entity]));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return { entities, documents: [
    ...volumes.map(normalizeVolume),
    ...chapters.map((chapter) => normalizeChapter(novelId, chapter, entityMap, labels)),
    ...chapters.flatMap((chapter) => chapter.notes.map((note) => normalizeNote(novelId, chapter.volume_id, chapter.id, note, chapter.tags, entityMap))),
    ...entities.map(normalizeEntity),
    ...events.map((event) => normalizeEvent(event, event.chapter_id ? chapterById.get(event.chapter_id) ?? null : null, entityMap, labels)),
  ] };
}

export async function loadSearchDataset(labels: ChapterKindLabels): Promise<{ documents: SearchDocument[]; entityMap: EntityMap }> {
  const novels = await getNovels();
  const datasets = await Promise.all(novels.map((novel) => loadNovel(novel.id, labels)));
  return {
    documents: [...novels.map(normalizeNovel), ...datasets.flatMap((dataset) => dataset.documents)],
    entityMap: new Map(datasets.flatMap((dataset) => dataset.entities).map((entity) => [entity.id, entity])),
  };
}
