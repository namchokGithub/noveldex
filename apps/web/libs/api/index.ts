import type { CharacterRole, PaginatedCharacters } from "@/app/types";

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
} from "@/libs/firebase/chapters";
export type { ChapterPayload, ChapterCreatePayload } from "@/libs/firebase/chapters";

interface ApiResponse<T> {
  data: T;
}

export interface LastOrderNos {
  volume: number;
  chapter: number;
}

export interface ChapterOrderEntry {
  id: string;
  number: number;
}

export async function reorderChapters(
  novelId: string,
  volumeId: string,
  chapters: ChapterOrderEntry[],
): Promise<void> {
  await apiClient.patch(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/reorder`,
    { body: { chapters } },
  );
}

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

export async function getCharacterRoles(): Promise<CharacterRole[]> {
  const response = await apiClient.get<ApiResponse<CharacterRole[]>>(
    "/api/v1/master/character-roles",
  );
  return response.data ?? [];
}

export async function getLastOrderNos(params: {
  novel_id?: string;
  volume_id?: string;
}): Promise<LastOrderNos> {
  const response = await apiClient.get<ApiResponse<LastOrderNos>>(
    "/api/v1/master/last-order-nos",
    params,
  );

  return response.data;
}
