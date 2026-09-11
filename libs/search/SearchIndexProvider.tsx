"use client";

import type MiniSearch from "minisearch";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useChapterKindLabels } from "@/components/chapters/ChapterLabel";
import type { EntityId } from "@/libs/entities/types";
import { buildIndex } from "./buildIndex";
import { loadSearchDataset } from "./loader";
import type { SearchDocument } from "./types";

export type SearchIndexStatus = "idle" | "loading" | "ready" | "error";

function buildDependents(documents: Iterable<SearchDocument>): Map<EntityId, Set<string>> {
  const result = new Map<EntityId, Set<string>>();
  for (const document of documents) {
    for (const entityId of document.referenceIds) {
      const ids = result.get(entityId) ?? new Set<string>();
      ids.add(document.id);
      result.set(entityId, ids);
    }
  }
  return result;
}

export interface SearchIndexContextValue {
  status: SearchIndexStatus;
  error: string | null;
  index: MiniSearch<SearchDocument> | null;
  documents: Map<string, SearchDocument>;
  dependents: Map<EntityId, Set<string>>;
  reload: () => void;
  upsert: (document: SearchDocument) => void;
  discard: (id: string) => void;
  rawSearch: (query: string) => SearchDocument[];
}

const SearchIndexContext = createContext<SearchIndexContextValue | null>(null);

export function SearchIndexProvider({ children }: { children: ReactNode }) {
  const labels = useChapterKindLabels();
  const [status, setStatus] = useState<SearchIndexStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [index, setIndex] = useState<MiniSearch<SearchDocument> | null>(null);
  const [documents, setDocuments] = useState<Map<string, SearchDocument>>(new Map());
  const [dependents, setDependents] = useState<Map<EntityId, Set<string>>>(new Map());
  const buildId = useRef(0);
  const hasStartedInitialBuild = useRef(false);

  const reload = useCallback(() => {
    const nextBuildId = ++buildId.current;
    setStatus("loading");
    setError(null);
    void loadSearchDataset(labels).then(({ documents: nextDocuments }) => {
      if (buildId.current !== nextBuildId) return;
      const nextMap = new Map(nextDocuments.map((document) => [document.id, document]));
      setIndex(buildIndex(nextDocuments));
      setDocuments(nextMap);
      setDependents(buildDependents(nextMap.values()));
      setStatus("ready");
    }).catch((cause: unknown) => {
      if (buildId.current !== nextBuildId) return;
      setError(cause instanceof Error ? cause.message : "Failed to build the search index.");
      setStatus("error");
    });
  }, [labels]);
  useEffect(() => {
    if (hasStartedInitialBuild.current) return;
    hasStartedInitialBuild.current = true;
    const frame = window.requestAnimationFrame(reload);
    // The index is intentionally built once for the app session. Locale changes do
    // not rebuild it; localized label ranking belongs to the query/UI phase.
    return () => window.cancelAnimationFrame(frame);
  }, [reload]);

  const upsert = useCallback((document: SearchDocument) => {
    if (!index) return;
    const nextDocuments = new Map(documents);
    if (nextDocuments.has(document.id)) index.replace(document);
    else index.add(document);
    nextDocuments.set(document.id, document);
    setDocuments(nextDocuments);
    setDependents(buildDependents(nextDocuments.values()));
  }, [documents, index]);

  const discard = useCallback((id: string) => {
    if (!index || !documents.has(id)) return;
    index.discard(id);
    const nextDocuments = new Map(documents);
    nextDocuments.delete(id);
    setDocuments(nextDocuments);
    setDependents(buildDependents(nextDocuments.values()));
  }, [documents, index]);

  const rawSearch = useCallback((query: string) => {
    if (!index || !query.trim()) return [];
    return index.search(query).flatMap((result) => {
      const document = documents.get(String(result.id));
      return document ? [document] : [];
    });
  }, [documents, index]);

  const value = useMemo<SearchIndexContextValue>(() => ({ status, error, index, documents, dependents, reload, upsert, discard, rawSearch }), [status, error, index, documents, dependents, reload, upsert, discard, rawSearch]);
  return <SearchIndexContext.Provider value={value}>{children}</SearchIndexContext.Provider>;
}

export function useSearchIndex(): SearchIndexContextValue {
  const value = useContext(SearchIndexContext);
  if (!value) throw new Error("useSearchIndex must be used within a SearchIndexProvider");
  return value;
}

export function useSearchMutations() {
  const { upsert, discard } = useSearchIndex();
  return { upsert, discard };
}
