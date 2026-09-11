import MiniSearch from "minisearch";
import { SEARCH_TEXT_FIELDS, type SearchDocument } from "./types";

export function buildIndex(documents: SearchDocument[]): MiniSearch<SearchDocument> {
  const index = new MiniSearch<SearchDocument>({
    idField: "id",
    fields: SEARCH_TEXT_FIELDS as string[],
    storeFields: [],
    extractField: (document, fieldName) => {
      const value = (document as unknown as Record<string, unknown>)[fieldName];
      return Array.isArray(value) ? value.join(" ") : typeof value === "string" ? value : "";
    },
  });
  index.addAll(documents);
  return index;
}
