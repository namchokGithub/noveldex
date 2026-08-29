// Novels domain via Firestore
export { getNovels, getNovel, createNovel } from "@/libs/firebase/novels";
export type { NovelCreatePayload } from "@/libs/firebase/novels";

// Tags domain via Firestore
export { getTags, createTag } from "@/libs/firebase/tags";

// Volumes domain via Firestore
export { getVolumes, getVolume, createVolume, updateVolume, deleteVolume } from "@/libs/firebase/volumes";
export type { VolumePayload } from "@/libs/firebase/volumes";

// Chapters domain via Firestore
export {
  getChaptersByVolume,
  getChaptersFlat,
  getChapter,
  createChapter,
  updateChapter,
  deleteChapter,
  linkChapterTag,
  unlinkChapterTag,
  reorderChapters,
} from "@/libs/firebase/chapters";
export type { ChapterPayload, ChapterCreatePayload, ChapterOrderEntry } from "@/libs/firebase/chapters";

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
export type { CharacterCreatePayload, CharacterUpdatePayload } from "@/libs/firebase/characters";

// Events domain via Firestore
export { getEvents, createEvent, updateEvent, deleteEvent } from "@/libs/firebase/events";
export type { EventPayload } from "@/libs/firebase/events";
