function segmenter() {
  return typeof Intl.Segmenter === "function" ? new Intl.Segmenter("th", { granularity: "word" }) : null;
}

export function tokenize(text: string, options?: { segmenter?: Intl.Segmenter | null }): string[] {
  const activeSegmenter = options?.segmenter === undefined ? segmenter() : options.segmenter;
  if (activeSegmenter) return [...activeSegmenter.segment(text)].filter((part) => part.isWordLike).map((part) => part.segment);
  return text.split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
}

export function processTerm(term: string): string | false {
  const normalized = term.trim().normalize("NFC");
  return normalized ? normalized.toLowerCase() : false;
}
