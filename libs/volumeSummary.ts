export function summarizeVolumeContents({
  chapters,
  eventCount,
  adaptationCount,
}: {
  chapters: Array<{ kind: string; notes: unknown[] }>;
  eventCount: number;
  adaptationCount: number;
}) {
  return {
    chapters: chapters.filter((chapter) => chapter.kind === "chapter").length,
    notes: chapters.reduce((count, chapter) => count + chapter.notes.length, 0),
    events: eventCount,
    adaptations: adaptationCount,
  };
}
