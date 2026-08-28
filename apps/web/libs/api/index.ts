import type { PaginatedCharacters } from "@/app/types";

import { apiClient } from "./client";

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

export async function getCharacters(
  novelId: string,
  options?: { page?: number; perPage?: number },
): Promise<PaginatedCharacters> {
  const page = options?.page ?? 1;
  const perPage = options?.perPage ?? 10;
  const response = await apiClient.get<{ data: PaginatedCharacters }>(
    `/api/v1/novels/${novelId}/characters?page=${page}&per_page=${perPage}`,
  );

  return (
    response.data ?? {
      items: [],
      pagination: { page, per_page: perPage, total_items: 0, total_pages: 1 },
      summary: { total_characters: 0 },
    }
  );
}
