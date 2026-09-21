import {
  getAdaptationsForNovel,
  getAllCharacters,
  getChaptersFlatDetailed,
  getEntities,
  getEvents,
  getNovel,
  getNovels,
  getVolumesFlat,
} from "@/libs/api";
import type { Novel } from "@/app/types";
import type { ChapterKindLabels } from "@/libs/chapterLabel";
import { buildEntityId } from "@/libs/entities/keys";
import type { Entity } from "@/libs/entities/types";
import {
  normalizeAdaptation,
  normalizeChapter,
  normalizeEntity,
  normalizeEvent,
  normalizeNote,
  normalizeNovel,
  normalizeVolume,
  type EntityMap,
} from "./normalize";
import type { SearchDocument } from "./types";

export interface SearchDataset {
  documents: SearchDocument[];
  entityMap: EntityMap;
  novelIds: string[];
}

async function loadNovel(
  novel: Novel,
  labels: ChapterKindLabels,
): Promise<{ documents: SearchDocument[]; entities: Entity[] }> {
  const novelId = novel.id;
  const charactersPromise = getAllCharacters(novelId);
  const characterNameById = charactersPromise.then(
    (characters) =>
      new Map(characters.map((character) => [character.id, character.name])),
  );
  const [volumes, chapters, characters, genericEntities, events, adaptations] =
    await Promise.all([
      getVolumesFlat(novelId),
      getChaptersFlatDetailed(novelId),
      charactersPromise,
      getEntities(novelId),
      getEvents(novelId, characterNameById),
      getAdaptationsForNovel(novelId),
    ]);
  const entities: Entity[] = [
    ...characters.map((character) => ({
      id: buildEntityId(novelId, "character", character.id),
      novelId,
      type: "character" as const,
      name: character.name,
      aliases: character.aliases,
      description: character.description,
    })),
    ...genericEntities,
  ];
  const entityMap: EntityMap = new Map(
    entities.map((entity) => [entity.id, entity]),
  );
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const volumeById = new Map(volumes.map((volume) => [volume.id, volume]));
  return {
    entities,
    documents: [
      ...volumes.map(normalizeVolume),
      ...chapters.map((chapter) =>
        normalizeChapter(novelId, chapter, entityMap, labels),
      ),
      ...chapters.flatMap((chapter) =>
        chapter.notes.map((note) =>
          normalizeNote(
            novelId,
            chapter.volume_id,
            chapter.id,
            note,
            chapter.tags,
            entityMap,
          ),
        ),
      ),
      ...entities.map(normalizeEntity),
      ...events.map((event) =>
        normalizeEvent(
          event,
          event.chapter_id ? (chapterById.get(event.chapter_id) ?? null) : null,
          entityMap,
          labels,
        ),
      ),
      ...adaptations.map((adaptation) =>
        normalizeAdaptation(
          adaptation,
          volumeById.get(adaptation.volume_id),
          entityMap,
        ),
      ),
    ],
  };
}

export async function loadSearchDatasetForNovel(
  novelId: string,
  labels: ChapterKindLabels,
): Promise<SearchDataset> {
  const novel = await getNovel(novelId);
  const dataset = await loadNovel(novel, labels);
  return {
    documents: [normalizeNovel(novel), ...dataset.documents],
    entityMap: new Map(
      dataset.entities.map((entity) => [entity.id, entity]),
    ),
    novelIds: [novel.id],
  };
}

export async function loadSearchDataset(
  labels: ChapterKindLabels,
  loadedNovelIds: ReadonlySet<string> = new Set(),
): Promise<SearchDataset> {
  const novels = await getNovels();
  const remainingNovels = novels.filter(
    (novel) => !loadedNovelIds.has(novel.id),
  );
  const datasets = await Promise.all(
    remainingNovels.map((novel) => loadNovel(novel, labels)),
  );
  return {
    documents: [
      ...remainingNovels.map(normalizeNovel),
      ...datasets.flatMap((dataset) => dataset.documents),
    ],
    entityMap: new Map(
      datasets
        .flatMap((dataset) => dataset.entities)
        .map((entity) => [entity.id, entity]),
    ),
    novelIds: remainingNovels.map((novel) => novel.id),
  };
}
