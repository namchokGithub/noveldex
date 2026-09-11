import type { EntityId, EntityType } from "@/libs/entities/types";

export type SearchDocumentType = "novel" | "volume" | "chapter" | "note" | "entity" | "event";

export interface SearchDocument {
  id: string;
  type: SearchDocumentType;
  novelId: string;
  volumeId?: string;
  chapterId?: string;
  noteId?: string;
  eventId?: string;
  entityId?: EntityId;
  entityType?: EntityType;
  name?: string;
  title?: string;
  author?: string;
  content?: string;
  description?: string;
  referenceIds: EntityId[];
  referenceNames: string[];
  referenceTypes: EntityType[];
  aliases: string[];
  tagIds: string[];
  tags: string[];
  route: string;
}

export const SEARCH_TEXT_FIELDS: Array<keyof SearchDocument> = [
  "name", "title", "author", "referenceNames", "aliases", "tags", "content", "description",
];
