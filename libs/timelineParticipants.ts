export function characterIdsInTimeline(
  events: Iterable<{ character_ids: readonly string[] }>,
): Set<string> {
  const result = new Set<string>();
  for (const event of events) {
    for (const characterId of event.character_ids) result.add(characterId);
  }
  return result;
}
