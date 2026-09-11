import type { SearchDocument } from "./types";

export type SearchScope =
  | { kind: "global" }
  | { kind: "novel"; novelId: string }
  | { kind: "volume"; novelId: string; volumeId: string }
  | { kind: "chapter"; novelId: string; volumeId: string; chapterId: string };

export function scopeFromPathname(pathname: string): SearchScope {
  const chapter = pathname.match(/^\/novels\/([^/]+)\/volumes\/([^/]+)\/chapters\/([^/]+)/);
  if (chapter) return { kind: "chapter", novelId: chapter[1], volumeId: chapter[2], chapterId: chapter[3] };
  const volume = pathname.match(/^\/novels\/([^/]+)\/volumes\/([^/]+)/);
  if (volume) return { kind: "volume", novelId: volume[1], volumeId: volume[2] };
  const novel = pathname.match(/^\/novels\/([^/]+)/);
  return novel ? { kind: "novel", novelId: novel[1] } : { kind: "global" };
}

export function widerScopes(scope: SearchScope): SearchScope[] {
  if (scope.kind === "chapter") return [
    { kind: "volume", novelId: scope.novelId, volumeId: scope.volumeId },
    { kind: "novel", novelId: scope.novelId }, { kind: "global" },
  ];
  if (scope.kind === "volume") return [{ kind: "novel", novelId: scope.novelId }, { kind: "global" }];
  if (scope.kind === "novel") return [{ kind: "global" }];
  return [];
}

export function matchesScope(document: SearchDocument, scope: SearchScope): boolean {
  if (scope.kind === "global") return true;
  if (document.novelId !== scope.novelId) return false;
  if (scope.kind === "novel") return true;
  if (document.volumeId !== scope.volumeId) return false;
  if (scope.kind === "volume") return true;
  return document.chapterId === scope.chapterId;
}
