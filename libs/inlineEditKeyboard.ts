export function shouldCancelInlineEdit(key: string, busy: boolean) {
  return key === "Escape" && !busy;
}
