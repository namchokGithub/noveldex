import type {
  Chapter,
  ChapterWithCharacters,
  Novel,
  Tag,
  Volume,
} from "@/app/types";

import { apiClient } from "./client";

interface ApiResponse<T> {
  data: T;
}

export interface LastOrderNos {
  volume: number;
  chapter: number;
}

interface ChapterPayload {
  summary?: string;
  read_at?: string | null;
}

interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  read_at?: string | null;
}

interface VolumePayload {
  number: number;
  title: string;
}

export async function getNovels(): Promise<Novel[]> {
  const response = await apiClient.get<ApiResponse<Novel[]>>("/api/v1/novels");

  return response.data;
}

export async function getNovel(novelId: string): Promise<Novel> {
  const response = await apiClient.get<ApiResponse<Novel>>(
    `/api/v1/novels/${novelId}`,
  );

  return response.data;
}

export async function getVolumes(novelId: string): Promise<Volume[]> {
  const response = await apiClient.get<ApiResponse<Volume[]>>(
    `/api/v1/novels/${novelId}/volumes`,
  );

  return response.data ?? [];
}

export async function getVolume(
  novelId: string,
  volumeId: string,
): Promise<Volume> {
  const response = await apiClient.get<ApiResponse<Volume>>(
    `/api/v1/novels/${novelId}/volumes/${volumeId}`,
  );

  return response.data;
}

export async function createVolume(
  novelId: string,
  payload: VolumePayload,
): Promise<Volume> {
  const response = await apiClient.post<ApiResponse<Volume>>(
    `/api/v1/novels/${novelId}/volumes`,
    {
      body: payload,
    },
  );

  return response.data;
}

export async function updateVolume(
  novelId: string,
  volumeId: string,
  payload: VolumePayload,
): Promise<Volume> {
  const response = await apiClient.patch<ApiResponse<Volume>>(
    `/api/v1/novels/${novelId}/volumes/${volumeId}`,
    {
      body: payload,
    },
  );

  return response.data;
}

export async function deleteVolume(
  novelId: string,
  volumeId: string,
): Promise<void> {
  await apiClient.delete(`/api/v1/novels/${novelId}/volumes/${volumeId}`);
}

export async function getChaptersByVolume(
  novelId: string,
  volumeId: string,
): Promise<Chapter[]> {
  const response = await apiClient.get<ApiResponse<Chapter[]>>(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
  );

  return (response.data ?? []).map((chapter) => ({
    ...chapter,
    tags: chapter.tags ?? [],
  }));
}

export async function getChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<ChapterWithCharacters> {
  const response = await apiClient.get<ApiResponse<ChapterWithCharacters>>(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}`,
  );

  return {
    ...response.data,
    characters: response.data.characters ?? [],
    tags: response.data.tags ?? [],
  };
}

export async function getTags(novelId: string): Promise<Tag[]> {
  const response = await apiClient.get<ApiResponse<Tag[]>>(
    `/api/v1/novels/${novelId}/tags`,
  );

  return response.data ?? [];
}

export async function createTag(novelId: string, name: string): Promise<Tag> {
  const response = await apiClient.post<ApiResponse<Tag>>(
    `/api/v1/novels/${novelId}/tags`,
    {
      body: { name },
    },
  );

  return response.data;
}

export async function linkChapterTag(
  novelId: string,
  volumeId: string,
  chapterId: string,
  tagId: string,
): Promise<void> {
  await apiClient.post(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}/tags`,
    {
      body: { tag_id: tagId },
    },
  );
}

export async function unlinkChapterTag(
  novelId: string,
  volumeId: string,
  chapterId: string,
  tagId: string,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}/tags/${tagId}`,
  );
}

export async function updateChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  payload: ChapterPayload,
): Promise<void> {
  await apiClient.patch(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}`,
    {
      body: payload,
    },
  );
}

export async function deleteChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
): Promise<void> {
  await apiClient.delete(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters/${chapterId}`,
  );
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

export async function createChapter(
  novelId: string,
  volumeId: string,
  payload: ChapterCreatePayload,
): Promise<Chapter> {
  const response = await apiClient.post<ApiResponse<Chapter>>(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
    {
      body: payload,
    },
  );

  return response.data;
}
