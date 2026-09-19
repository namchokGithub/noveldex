export const CROSS_REFERENCE_PREVIEW_LIMIT = 5;

export function crossReferencePreview<T>(items: T[]) {
  return {
    items: items.slice(0, CROSS_REFERENCE_PREVIEW_LIMIT),
    remaining: Math.max(0, items.length - CROSS_REFERENCE_PREVIEW_LIMIT),
  };
}
