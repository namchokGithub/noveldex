// Novels domain via Firestore
export { getNovels, getNovel, createNovel } from "@/libs/firebase/novels";
export type { NovelCreatePayload } from "@/libs/firebase/novels";

// Tags domain via Firestore
export {
  getTags,
  getTagsPage,
  createTag,
  TAG_NAME_MAX_LENGTH,
} from "@/libs/firebase/tags";
export type { TagCursor } from "@/libs/firebase/tags";

// Volumes domain via Firestore
export {
  getVolumes,
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
  getAllCharacters,
  getCharacter,
  createCharacter,
  updateCharacter,
  deleteCharacter,
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
// Adaptations domain via Firestore
export {
  getAdaptationsByVolume,
  getAdaptationsByChapter,
  getAdaptation,
  getAdaptationsForNovel,
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
  getEntity,
  updateEntity,
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
