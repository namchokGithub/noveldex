export const STORY_PAGES_PER_VIEW = 10;
export const STORY_SEQUENCES_PER_VIEW = 20;

export interface TimelinePagination<T> {
  current: number;
  total: number;
  items: T[];
}

function paginate<T>(
  items: T[],
  requested: number,
  perView: number,
): TimelinePagination<T> {
  const total = Math.max(1, Math.ceil(items.length / perView));
  const current = Math.min(Math.max(requested, 1), total);
  const start = (current - 1) * perView;
  return { current, total, items: items.slice(start, start + perView) };
}

export function paginateStoryPages(
  pageNumbers: number[],
  requested: number,
): TimelinePagination<number> {
  return paginate(pageNumbers, requested, STORY_PAGES_PER_VIEW);
}

export function paginateStorySequences<T>(
  events: T[],
  requested: number,
): TimelinePagination<T> {
  return paginate(events, requested, STORY_SEQUENCES_PER_VIEW);
}
