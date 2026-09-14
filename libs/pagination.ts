export function canNavigatePage(
  currentPage: number,
  totalPages: number,
  direction: "previous" | "next",
) {
  return direction === "previous" ? currentPage > 1 : currentPage < totalPages;
}
