import { extractReferenceTokens, resolveReferenceOccurrences, type EntityLookup, type ReferenceOccurrence } from "./references";

export interface PreviousReferenceState {
  content: string;
  occurrences: ReferenceOccurrence[];
}

export async function reconcileReferenceOccurrences(
  novelId: string,
  content: string,
  previous: PreviousReferenceState | null,
  lookup: EntityLookup,
): Promise<ReferenceOccurrence[]> {
  if (previous?.content === content) return previous.occurrences;
  const tokens = extractReferenceTokens(content);
  const priorByRaw = new Map<string, ReferenceOccurrence[]>();
  previous?.occurrences.forEach((occurrence) => priorByRaw.set(occurrence.raw, [...(priorByRaw.get(occurrence.raw) ?? []), occurrence]));
  const result: Array<ReferenceOccurrence | null> = tokens.map((token) => {
    const prior = priorByRaw.get(token.raw)?.shift();
    return prior ? { ...prior, start: token.start, length: token.length, raw: token.raw } : null;
  });
  await Promise.all(result.map(async (occurrence, index) => {
    if (occurrence) return;
    const [fresh] = await resolveReferenceOccurrences(novelId, tokens[index].raw, lookup);
    result[index] = { ...fresh, start: tokens[index].start, length: tokens[index].length, raw: tokens[index].raw };
  }));
  return result as ReferenceOccurrence[];
}
