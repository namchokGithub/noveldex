export function charactersByIds<T extends { id: string }>(
  characters: readonly T[],
  ids: Iterable<string>,
): T[] {
  const byId = new Map(characters.map((character) => [character.id, character]));
  return [...ids]
    .map((id) => byId.get(id))
    .filter((character): character is T => Boolean(character));
}
