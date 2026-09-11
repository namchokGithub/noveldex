"use client";

import type MiniSearch from "minisearch";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import type { Entity, EntityId } from "@/libs/entities/types";
import { buildIndexAsync } from "./buildIndex";
import { loadSearchDataset } from "./loader";
import type { EntityMap } from "./normalize";
import type { SearchDocument } from "./types";
import { shouldVacuum } from "./vacuumSchedule";

export type SearchIndexStatus = "idle" | "loading" | "ready" | "error";

function buildDependents(documents: Iterable<SearchDocument>): Map<EntityId, Set<string>> {
  const result = new Map<EntityId, Set<string>>();
  for (const document of documents) for (const entityId of document.referenceIds) {
    const ids = result.get(entityId) ?? new Set<string>();
    ids.add(document.id);
    result.set(entityId, ids);
  }
  return result;
}

function entityFromDocument(document: SearchDocument): Entity | null {
  if (document.type !== "entity" || !document.entityId || !document.entityType || !document.name) return null;
  return { id: document.entityId, novelId: document.novelId, type: document.entityType, name: document.name, aliases: document.aliases, description: document.description ?? "" };
}

export interface SearchMutations {
  upsert: (document: SearchDocument) => void;
  discard: (id: string) => void;
  upsertMany: (documents: SearchDocument[]) => void;
  discardMany: (ids: string[]) => void;
}

export interface SearchIndexContextValue extends SearchMutations {
  status: SearchIndexStatus;
  error: string | null;
  index: MiniSearch<SearchDocument> | null;
  documents: Map<string, SearchDocument>;
  dependents: Map<EntityId, Set<string>>;
  entityMap: EntityMap;
  reload: () => void;
  rawSearch: (query: string) => SearchDocument[];
}

const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);
type Operation = (index: MiniSearch<SearchDocument>, documents: Map<string, SearchDocument>, entityMap: EntityMap) => void;

export function SearchIndexProvider({ children }: { children: ReactNode }) {
  const labels = useChapterKindLabels();
  const [status, setStatus] = useState<SearchIndexStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<MiniSearch<SearchDocument> | null>(null);
  const [documents, setDocuments] = useState<Map<string, SearchDocument>>(new Map());
  const [dependents, setDependents] = useState<Map<EntityId, Set<string>>>(new Map());
  const [entityMap, setEntityMap] = useState<EntityMap>(new Map());
  const indexRef = useRef<MiniSearch<SearchDocument> | null>(null);
  const documentsRef = useRef<Map<string, SearchDocument>>(new Map());
  const entityMapRef = useRef<EntityMap>(new Map());
  const dirtyCountRef = useRef(0);
  const pendingRef = useRef<Operation[]>([]);
  const reloadInFlightRef = useRef(false);
  const buildId = useRef(0);
  const hasStartedInitialBuild = useRef(false);

  const publish = useCallback((nextIndex: MiniSearch<SearchDocument>, nextDocuments: Map<string, SearchDocument>, nextEntities: EntityMap) => {
    indexRef.current = nextIndex; documentsRef.current = nextDocuments; entityMapRef.current = nextEntities;
    setIndex(nextIndex); setDocuments(nextDocuments); setEntityMap(nextEntities); setDependents(buildDependents(nextDocuments.values()));
  }, []);
  const apply = useCallback((operation: Operation) => {
    const target = indexRef.current;
    if (!target || reloadInFlightRef.current) { pendingRef.current.push(operation); return; }
    const nextDocuments = new Map(documentsRef.current), nextEntities = new Map(entityMapRef.current);
    operation(target, nextDocuments, nextEntities); publish(target, nextDocuments, nextEntities);
  }, [publish]);
  const upsertMany = useCallback((next: SearchDocument[]) => apply((target, nextDocuments, nextEntities) => {
    for (const document of next) {
      if (nextDocuments.has(document.id)) target.replace(document); else target.add(document);
      nextDocuments.set(document.id, document);
      const entity = entityFromDocument(document); if (entity) nextEntities.set(entity.id, entity);
    }
  }), [apply]);
  const discardMany = useCallback((ids: string[]) => apply((target, nextDocuments, nextEntities) => {
    let discarded = 0;
    for (const id of ids) {
      const document = nextDocuments.get(id); if (!document) continue;
      target.discard(id); nextDocuments.delete(id); if (document.entityId) nextEntities.delete(document.entityId); discarded += 1;
    }
    dirtyCountRef.current += discarded;
    if (discarded > 0 && shouldVacuum(dirtyCountRef.current, nextDocuments.size)) void target.vacuum().then(() => { dirtyCountRef.current = 0; });
  }), [apply]);
  const upsert = useCallback((document: SearchDocument) => upsertMany([document]), [upsertMany]);
  const discard = useCallback((id: string) => discardMany([id]), [discardMany]);

  const reload = useCallback(() => {
    const nextBuildId = ++buildId.current; reloadInFlightRef.current = true; setStatus("loading"); setError(null);
    void loadSearchDataset(labels).then(async ({ documents: loaded, entityMap: loadedEntities }) => {
      if (buildId.current !== nextBuildId) return;
      const nextIndex = await buildIndexAsync(loaded);
      if (buildId.current !== nextBuildId) return;
      const nextDocuments = new Map(loaded.map((document) => [document.id, document])), nextEntities = new Map(loadedEntities);
      for (const operation of pendingRef.current.splice(0)) operation(nextIndex, nextDocuments, nextEntities);
      publish(nextIndex, nextDocuments, nextEntities); reloadInFlightRef.current = false; setStatus("ready");
    }).catch((cause: unknown) => { if (buildId.current === nextBuildId) { reloadInFlightRef.current = false; setError(cause instanceof Error ? cause.message : "Failed to build the search index."); setStatus("error"); } });
  }, [labels, publish]);
  useEffect(() => { if (hasStartedInitialBuild.current) return; hasStartedInitialBuild.current = true; const frame = window.requestAnimationFrame(reload); return () => window.cancelAnimationFrame(frame); }, [reload]);
  const rawSearch = useCallback((query: string) => {
    const target = indexRef.current; if (!target || !query.trim()) return [];
    return target.search(query).flatMap((result) => documentsRef.current.get(String(result.id)) ?? []);
  }, []);
  const value = useMemo<SearchIndexContextValue>(() => ({ status, error, index, documents, dependents, entityMap, reload, upsert, discard, upsertMany, discardMany, rawSearch }), [status, error, index, documents, dependents, entityMap, reload, upsert, discard, upsertMany, discardMany, rawSearch]);
  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>;
}

export function useSearchIndex(): SearchIndexContextValue {
  const value = useContext(SearchIndexContext); if (!value) throw new Error("useSearchIndex must be used within a SearchIndexProvider"); return value;
}
export function useSearchMutations(): SearchMutations {
  const { upsert, discard, upsertMany, discardMany } = useSearchIndex(); return { upsert, discard, upsertMany, discardMany };
}
