export function createLinkPreviewRequestGate() {
  let current = 0;

  return {
    start() {
      current += 1;
      return current;
    },
    clear() {
      current += 1;
    },
    isCurrent(request: number) {
      return request === current;
    },
  };
}
