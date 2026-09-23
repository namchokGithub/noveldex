import type { RichNoteDocument } from "@/libs/richNotes/document";

export type EntityType =
  | "character"
  | "location"
  | "skill"
  | "organization"
  | "item"
  | "concept";

export const ENTITY_TYPES: readonly EntityType[] = [
  "character", "location", "skill", "organization", "item", "concept",
];

export const GENERIC_ENTITY_TYPES = [
  "location", "skill", "organization", "item", "concept",
] as const;

export type GenericEntityType = (typeof GENERIC_ENTITY_TYPES)[number];
export type EntityId = string;

export interface EntityNote {
  id: string;
  content: string;
  content_json?: RichNoteDocument;
  created_at: string;
  updated_at: string;
}

export interface Entity {
  id: EntityId;
  novelId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description: string;
  notes?: EntityNote[];
}

export interface EntityReference {
  entityId: EntityId;
  entityType: EntityType;
  label: string;
}
