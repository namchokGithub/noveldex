export function nextListIndex(index: number, length: number, key: string) {
  if (length === 0) return -1;
  if (key === "ArrowDown") return index < 0 ? 0 : (index + 1) % length;
  if (key === "ArrowUp") return index < 0 ? length - 1 : (index - 1 + length) % length;
  return index;
}
