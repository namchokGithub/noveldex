import { ENTITY_TYPES, type Entity, type EntityId, type EntityReference, type EntityType } from "./types";

const REFERENCE_PATTERN = /\[\[([^\]]+)\]\]/g;

export interface RawReferenceToken {
  raw: string;
  start: number;
  length: number;
  typed: EntityType | null;
  label: string;
}

export type ReferenceToken =
  | { status: "resolved"; reference: EntityReference }
  | { status: "unresolved"; typed: EntityType | null; label: string }
  | { status: "ambiguous"; typed: EntityType | null; label: string; candidates: EntityId[] };

export interface ReferenceOccurrence {
  start: number;
  length: number;
  raw: string;
  token: ReferenceToken;
}

export interface EntityLookup {
  findByName(novelId: string, name: string, type: EntityType): Promise<Entity[]>;
}

export function extractReferenceTokens(content: string): RawReferenceToken[] {
  return Array.from(content.matchAll(REFERENCE_PATTERN)).flatMap((match) => {
    const inner = match[1].trim();
    const separator = inner.indexOf(":");
    const prefix = separator < 0 ? "" : inner.slice(0, separator).trim();
    const typed = ENTITY_TYPES.includes(prefix as EntityType) ? prefix as EntityType : null;
    const label = (typed ? inner.slice(separator + 1) : inner).trim();
    if (!label) return [];
    return [{ raw: match[0], start: match.index ?? 0, length: match[0].length, typed, label }];
  });
}

export async function resolveReferenceOccurrences(novelId: string, content: string, lookup: EntityLookup): Promise<ReferenceOccurrence[]> {
  return Promise.all(extractReferenceTokens(content).map(async (token) => {
    const type = token.typed ?? "character";
    const candidates = await lookup.findByName(novelId, token.label, type);
    const resolved: ReferenceToken = candidates.length === 1
      ? { status: "resolved", reference: { entityId: candidates[0].id, entityType: candidates[0].type, label: token.label } }
      : candidates.length > 1
        ? { status: "ambiguous", typed: token.typed, label: token.label, candidates: candidates.map((candidate) => candidate.id) }
        : { status: "unresolved", typed: token.typed, label: token.label };
    return { start: token.start, length: token.length, raw: token.raw, token: resolved };
  }));
}
