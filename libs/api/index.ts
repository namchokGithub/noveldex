// Novels domain via Firestore
export { getNovels, getNovel, createNovel } from "@/libs/firebase/novels";
export type { NovelCreatePayload } from "@/libs/firebase/novels";

// Tags domain via Firestore
export {
  getTags,
  getTagsByIds,
  getTagsPage,
  createTag,
  TAG_NAME_MAX_LENGTH,
} from "@/libs/firebase/tags";
export type { TagCursor } from "@/libs/firebase/tags";

// Volumes domain via Firestore
export {
  decodeVolumeCursor,
  encodeVolumeCursor,
  getVolumesPage,
  resolveVolumeCursorSearch,
  getVolumesFlat,
  getVolume,
  getVolumeMetadata,
  getAdjacentVolumeMetadata,
  createVolume,
  updateVolume,
  deleteVolume,
} from "@/libs/firebase/volumes";
export type {
  VolumeCreatePayload,
  VolumeCursor,
  VolumePage,
  VolumePayload,
  VolumeMetadata,
  VolumeSearchSource,
} from "@/libs/firebase/volumes";

// Chapters domain via Firestore
export {
  getChaptersByVolume,
  getChaptersFlat,
  getChaptersFlatDetailed,
  getChapterNotesForEntity,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  linkChapterTag,
  unlinkChapterTag,
  reorderChapters,
} from "@/libs/firebase/chapters";
export type {
  ChapterPayload,
  ChapterCreatePayload,
  ChapterOrderEntry,
} from "@/libs/firebase/chapters";

// LastOrderNos domain via Firestore
export { getLastOrderNos } from "@/libs/firebase/lastOrderNos";
export type { LastOrderNos } from "@/libs/firebase/lastOrderNos";

// Character roles domain via Firestore
export { getCharacterRoles } from "@/libs/firebase/characterRoles";

// Characters domain via Firestore
export {
  getCharacters,
  getCharactersPage,
  getAllCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  updateCharacterGallery,
  deleteCharacter,
  decodeCharacterCursor,
  encodeCharacterCursor,
  resolveCharacterCursorSearch,
} from "@/libs/firebase/characters";
export type {
  CharacterCreatePayload,
  CharacterUpdatePayload,
} from "@/libs/firebase/characters";

// Events domain via Firestore
export {
  getEvents,
  getEventsByChapter,
  getEventsByVolume,
  getEventsForCharacter,
  getEventsForEntity,
  createEvent,
  updateEvent,
  deleteEvent,
} from "@/libs/firebase/events";
export type { EventPayload } from "@/libs/firebase/events";
export {
  getEntityReferencePage,
} from "@/libs/firebase/entityReferences";
export type {
  EntityReference as EntityReferenceIndexEntry,
  EntityReferenceCursor,
  EntityReferencePage,
} from "@/libs/firebase/entityReferences";
// Adaptations domain via Firestore
export {
  getAdaptationsByVolume,
  getLatestAdaptationByVolume,
  getAdaptationsByChapter,
  getAdaptation,
  getAdaptationsForNovel,
  getAdaptationsForChapterIds,
  createAdaptation,
  updateAdaptation,
  deleteAdaptation,
  reorderAdaptations,
} from "@/libs/firebase/adaptations";
export type {
  AdaptationCreatePayload,
  AdaptationPayload,
} from "@/libs/firebase/adaptations";
export {
  createEntity,
  deleteEntity,
  decodeEntityCursor,
  encodeEntityCursor,
  getEntities,
  getEntitiesPage,
  getEntitiesPageByNamePrefix,
  getEntity,
  updateEntity,
  updateEntityGallery,
} from "@/libs/firebase/entities";
export type {
  EntityCreatePayload,
  EntityCursor,
  EntityPage,
  EntityUpdatePayload,
} from "@/libs/firebase/entities";
export type {
  Entity,
  EntityId,
  EntityReference,
  EntityType,
  GenericEntityType,
} from "@/libs/entities/types";
