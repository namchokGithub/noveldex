const DIRTY_RATIO_THRESHOLD = 0.1;

export function shouldVacuum(dirtyCount: number, totalCount: number): boolean {
  return totalCount > 0 && dirtyCount / totalCount >= DIRTY_RATIO_THRESHOLD;
}
