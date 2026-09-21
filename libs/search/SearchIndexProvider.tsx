"use client";

import type MiniSearch from "minisearch";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import type { Entity, EntityId } from "@/libs/entities/types";
import { addToIndexAsync, buildIndexAsync } from "./buildIndex";
import {
  loadSearchDataset,
  loadSearchDatasetForNovel,
  type SearchDataset,
} from "./loader";
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
  start: (novelId: string | null) => void;
  ensureNovel: (novelId: string) => Promise<void>;
  ensureGlobal: () => Promise<void>;
  reload: () => void;
  rawSearch: (query: string) => SearchDocument[];
}

const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);
type Operation = (index: MiniSearch<SearchDocument>, documents: Map<string, SearchDocument>, entityMap: EntityMap) => void;

export function startSearchIndexOnce(
  started: { current: boolean },
  load: () => void,
): void {
  if (started.current) return;
  started.current = true;
  load();
}

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
  const datasetLoadCountRef = useRef(0);
  const datasetLoadFailedRef = useRef(false);
  const loadedNovelIdsRef = useRef(new Set<string>());
  const inFlightNovelLoadsRef = useRef(new Map<string, Promise<void>>());
  const globalLoadRef = useRef<Promise<void> | null>(null);
  const appendQueueRef = useRef(Promise.resolve());
  const buildId = useRef(0);

  const publish = useCallback((nextIndex: MiniSearch<SearchDocument>, nextDocuments: Map<string, SearchDocument>, nextEntities: EntityMap) => {
    indexRef.current = nextIndex; documentsRef.current = nextDocuments; entityMapRef.current = nextEntities;
    setIndex(nextIndex); setDocuments(nextDocuments); setEntityMap(nextEntities); setDependents(buildDependents(nextDocuments.values()));
  }, []);
  const apply = useCallback((operation: Operation) => {
    const target = indexRef.current;
    if (!target || reloadInFlightRef.current || datasetLoadCountRef.current > 0) { pendingRef.current.push(operation); return; }
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

  const appendDataset = useCallback(async (dataset: SearchDataset) => {
    const existingIndex = indexRef.current;
    const nextIndex = existingIndex ?? await buildIndexAsync(dataset.documents);
    if (existingIndex) await addToIndexAsync(nextIndex, dataset.documents);
    const nextDocuments = new Map(documentsRef.current);
    const nextEntities = new Map(entityMapRef.current);
    for (const document of dataset.documents) nextDocuments.set(document.id, document);
    for (const [id, entity] of dataset.entityMap) nextEntities.set(id, entity);
    for (const operation of pendingRef.current.splice(0)) operation(nextIndex, nextDocuments, nextEntities);
    publish(nextIndex, nextDocuments, nextEntities);
  }, [publish]);

  const appendDatasetSerialized = useCallback((dataset: SearchDataset) => {
    const next = appendQueueRef.current.then(() => appendDataset(dataset));
    appendQueueRef.current = next.catch(() => undefined);
    return next;
  }, [appendDataset]);

  const ensureNovel = useCallback(async (novelId: string): Promise<void> => {
    if (loadedNovelIdsRef.current.has(novelId)) return;
    const globalLoad = globalLoadRef.current;
    if (globalLoad) return globalLoad;
    const existing = inFlightNovelLoadsRef.current.get(novelId);
    if (existing) return existing;
    const load = (async () => {
      if (datasetLoadCountRef.current === 0) datasetLoadFailedRef.current = false;
      datasetLoadCountRef.current += 1;
      setStatus("loading");
      setError(null);
      try {
        const dataset = await loadSearchDatasetForNovel(novelId, labels);
        await appendDatasetSerialized(dataset);
        dataset.novelIds.forEach((id) => loadedNovelIdsRef.current.add(id));
      } catch (cause) {
        datasetLoadFailedRef.current = true;
        setError(cause instanceof Error ? cause.message : "Failed to load the search index.");
        setStatus("error");
        throw cause;
      } finally {
        datasetLoadCountRef.current -= 1;
        inFlightNovelLoadsRef.current.delete(novelId);
        if (datasetLoadCountRef.current === 0 && !reloadInFlightRef.current)
          setStatus(datasetLoadFailedRef.current ? "error" : "ready");
      }
    })();
    inFlightNovelLoadsRef.current.set(novelId, load);
    return load;
  }, [appendDatasetSerialized, labels]);

  const ensureGlobal = useCallback(async (): Promise<void> => {
    const existing = globalLoadRef.current;
    if (existing) return existing;
    const load = (async () => {
      if (datasetLoadCountRef.current === 0) datasetLoadFailedRef.current = false;
      datasetLoadCountRef.current += 1;
      setStatus("loading");
      setError(null);
      try {
        while (true) {
          const inFlight = [...inFlightNovelLoadsRef.current.values()];
          if (inFlight.length > 0) await Promise.all(inFlight);
          const dataset = await loadSearchDataset(labels, loadedNovelIdsRef.current);
          if (dataset.novelIds.length === 0) break;
          await appendDatasetSerialized(dataset);
          dataset.novelIds.forEach((id) => loadedNovelIdsRef.current.add(id));
        }
      } catch (cause) {
        datasetLoadFailedRef.current = true;
        setError(cause instanceof Error ? cause.message : "Failed to build the search index.");
        setStatus("error");
        throw cause;
      } finally {
        datasetLoadCountRef.current -= 1;
        globalLoadRef.current = null;
        if (datasetLoadCountRef.current === 0 && !reloadInFlightRef.current)
          setStatus(datasetLoadFailedRef.current ? "error" : "ready");
      }
    })();
    globalLoadRef.current = load;
    return load;
  }, [appendDatasetSerialized, labels]);

  const reload = useCallback(() => {
    const loadedIds = [...loadedNovelIdsRef.current];
    if (loadedIds.length === 0) {
      void ensureGlobal();
      return;
    }
    const nextBuildId = ++buildId.current;
    reloadInFlightRef.current = true;
    setStatus("loading");
    setError(null);
    void Promise.all(loadedIds.map((novelId) => loadSearchDatasetForNovel(novelId, labels)))
      .then(async (datasets) => {
        if (buildId.current !== nextBuildId) return;
        const loaded = datasets.flatMap((dataset) => dataset.documents);
        const loadedEntities = new Map(datasets.flatMap((dataset) => [...dataset.entityMap]));
        const nextIndex = await buildIndexAsync(loaded);
        if (buildId.current !== nextBuildId) return;
        const nextDocuments = new Map(loaded.map((document) => [document.id, document]));
        for (const operation of pendingRef.current.splice(0)) operation(nextIndex, nextDocuments, loadedEntities);
        publish(nextIndex, nextDocuments, loadedEntities);
        setStatus("ready");
      })
      .catch((cause: unknown) => {
        if (buildId.current === nextBuildId) {
          setError(cause instanceof Error ? cause.message : "Failed to build the search index.");
          setStatus("error");
        }
      })
      .finally(() => {
        if (buildId.current === nextBuildId) reloadInFlightRef.current = false;
      });
  }, [ensureGlobal, labels, publish]);

  const start = useCallback((novelId: string | null) => {
    void (novelId ? ensureNovel(novelId) : ensureGlobal());
  }, [ensureGlobal, ensureNovel]);
  const rawSearch = useCallback((query: string) => {
    const target = indexRef.current; if (!target || !query.trim()) return [];
    return target.search(query).flatMap((result) => documentsRef.current.get(String(result.id)) ?? []);
  }, []);
  const value = useMemo<SearchIndexContextValue>(() => ({ status, error, index, documents, dependents, entityMap, start, ensureNovel, ensureGlobal, reload, upsert, discard, upsertMany, discardMany, rawSearch }), [status, error, index, documents, dependents, entityMap, start, ensureNovel, ensureGlobal, reload, upsert, discard, upsertMany, discardMany, rawSearch]);
  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>;
}

export function useSearchIndex(): SearchIndexContextValue {
  const value = useContext(SearchIndexContext); if (!value) throw new Error("useSearchIndex must be used within a SearchIndexProvider"); return value;
}
export function useSearchMutations(): SearchMutations {
  const { upsert, discard, upsertMany, discardMany } = useSearchIndex(); return { upsert, discard, upsertMany, discardMany };
}
