export function modalKeyboardAction(key: string, busy: boolean) {
  return key === "Escape" && !busy ? "close" : "none";
}
