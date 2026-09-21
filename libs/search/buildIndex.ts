import MiniSearch from "minisearch";
import { processTerm, tokenize } from "./tokenize";
import { SEARCH_TEXT_FIELDS, type SearchDocument } from "./types";

function createIndex() {
  return new MiniSearch<SearchDocument>({
    idField: "id",
    fields: SEARCH_TEXT_FIELDS as string[],
    storeFields: [],
    tokenize: (text) => tokenize(text),
    processTerm,
    extractField: (document, fieldName) => {
      const value = (document as unknown as Record<string, unknown>)[fieldName];
      return Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
    },
  });
}

export function buildIndex(documents: SearchDocument[]): MiniSearch<SearchDocument> {
  const index = createIndex(); index.addAll(documents); return index;
}

export async function buildIndexAsync(documents: SearchDocument[], chunkSize = 500): Promise<MiniSearch<SearchDocument>> {
  const index = createIndex();
  for (let start = 0; start < documents.length; start += chunkSize) {
    index.addAll(documents.slice(start, start + chunkSize));
    if (start + chunkSize < documents.length) await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
  return index;
}

export async function addToIndexAsync(
  index: MiniSearch<SearchDocument>,
  documents: SearchDocument[],
  chunkSize = 500,
): Promise<void> {
  for (let start = 0; start < documents.length; start += chunkSize) {
    index.addAll(documents.slice(start, start + chunkSize));
    if (start + chunkSize < documents.length)
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  }
}
