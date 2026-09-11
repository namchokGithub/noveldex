import type { SearchDocument } from "./types";

export type DeleteTarget =
  | { type: "chapter"; novelId: string; volumeId: string; chapterId: string }
  | { type: "volume"; novelId: string; volumeId: string };

export function descendantsOf(target: DeleteTarget, documents: Map<string, SearchDocument>): string[] {
  return [...documents.values()].filter((document) => {
    if (document.type === "event" || document.novelId !== target.novelId || document.volumeId !== target.volumeId) return false;
    return target.type === "volume" || document.chapterId === target.chapterId;
  }).map((document) => document.id);
}
