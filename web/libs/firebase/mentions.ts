const MENTION_PATTERN = /\[\[([^\]]+)\]\]/g;

export function extractMentions(summary: string): string[] {
  const names = new Set<string>();
  for (const match of summary.matchAll(MENTION_PATTERN)) {
    const name = match[1].trim();
    if (name) names.add(name);
  }
  return Array.from(names);
}
