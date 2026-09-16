export function chapterPreview(chapterIds: string[]) {
  const [visibleId, ...hiddenIds] = chapterIds;
  return { visibleId, hiddenIds };
}
