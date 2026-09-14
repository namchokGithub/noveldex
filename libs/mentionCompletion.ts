export function completeActiveMention(value: string, name: string) {
  return value.replace(/\[\[[^\]]*$/, `[[${name}]]`);
}
