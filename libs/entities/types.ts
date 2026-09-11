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

export interface Entity {
  id: EntityId;
  novelId: string;
  type: EntityType;
  name: string;
  aliases: string[];
  description: string;
}

export interface EntityReference {
  entityId: EntityId;
  entityType: EntityType;
  label: string;
}
