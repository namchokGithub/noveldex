export function canNavigatePage(
  currentPage: number,
  totalPages: number,
  direction: "previous" | "next",
) {
  return direction === "previous" ? currentPage > 1 : currentPage < totalPages;
}

export function normalizeCursorPage(
  requestedPage: number,
  hasValidCursor: boolean,
): number {
  return hasValidCursor && Number.isInteger(requestedPage) && requestedPage > 0
    ? requestedPage
    : 1;
}

export function buildCursorPageSearch(
  currentSearch: string,
  {
    page,
    perPage,
    cursor,
  }: {
    page: number;
    perPage: number;
    cursor: { name: "after" | "before"; value: string } | null;
  },
): string {
  const params = new URLSearchParams(currentSearch);
  params.set("page", String(page));
  params.set("per_page", String(perPage));
  params.delete("after");
  params.delete("before");
  if (cursor) params.set(cursor.name, cursor.value);
  return params.toString();
}
