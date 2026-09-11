import type MiniSearch from "minisearch";
import type { SearchResult as MiniSearchResult } from "minisearch";
import { matchesScope, type SearchScope } from "./scope";
import type { SearchDocument } from "./types";

const DEFAULT_LIMIT = 30;
const PREFIX_MIN_LENGTH = 2;
const FUZZY_MIN_LENGTH = 5;
const FUZZY_DISTANCE_RATIO = 0.2;
const MAX_FUZZY = 1;
const FIELD_BOOSTS = { name: 10, title: 10, author: 10, referenceNames: 6, aliases: 4, tags: 2, content: 1, description: 1 };
const FIELD_TIER: Record<string, number> = { name: 0, title: 0, author: 0, referenceNames: 1, aliases: 2, tags: 3, content: 4, description: 4 };

type Ranked = { id: string; matchTier: number; fieldTier: number; score: number };

function fieldTier(match: Record<string, string[]>): number {
  const fields = Object.values(match).flat();
  return fields.length ? Math.min(...fields.map((field) => FIELD_TIER[field] ?? 4)) : 4;
}

export function searchDocuments(index: MiniSearch<SearchDocument>, documents: Map<string, SearchDocument>, query: string, scope: SearchScope, options: { limit?: number } = {}): SearchDocument[] {
  if (!query.trim()) return [];
  const limit = options.limit ?? DEFAULT_LIMIT;
  const finalTermIsComplete = /\s$/u.test(query);
  const filter = (result: { id: unknown }) => {
    const document = documents.get(String(result.id));
    return document ? matchesScope(document, scope) : false;
  };
  const collected = new Map<string, Ranked>();
  const collect = (results: MiniSearchResult[], matchTier: number) => {
    results.forEach((result) => {
      const candidate = { id: String(result.id), matchTier, fieldTier: fieldTier(result.match), score: result.score };
      const existing = collected.get(candidate.id);
      if (!existing || candidate.matchTier < existing.matchTier || (candidate.matchTier === existing.matchTier && (candidate.fieldTier < existing.fieldTier || (candidate.fieldTier === existing.fieldTier && candidate.score > existing.score)))) collected.set(candidate.id, candidate);
    });
  };

  collect(index.search(query, { prefix: false, fuzzy: false, boost: FIELD_BOOSTS, combineWith: "AND", filter }), 0);
  if (collected.size < limit) collect(index.search(query, { prefix: (term, index, terms) => !finalTermIsComplete && index === terms.length - 1 && term.length >= PREFIX_MIN_LENGTH, fuzzy: false, boost: FIELD_BOOSTS, combineWith: "AND", filter }), 1);
  if (collected.size < limit) collect(index.search(query, { prefix: false, fuzzy: (term) => term.length >= FUZZY_MIN_LENGTH ? FUZZY_DISTANCE_RATIO : false, maxFuzzy: MAX_FUZZY, boost: FIELD_BOOSTS, combineWith: "AND", filter }), 2);

  return [...collected.values()]
    .sort((a, b) => a.matchTier - b.matchTier || a.fieldTier - b.fieldTier || b.score - a.score || a.id.localeCompare(b.id))
    .slice(0, limit)
    .flatMap((result) => {
      const document = documents.get(result.id);
      return document ? [document] : [];
    });
}
