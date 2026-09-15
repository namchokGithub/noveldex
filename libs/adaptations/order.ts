import type { Adaptation } from "@/app/types";

export interface AdaptationGroup {
  key: string;
  medium: Adaptation["medium"];
  group_label: string;
  group_sort_order: number;
  items: Adaptation[];
}

export function compareAdaptations(a: Adaptation, b: Adaptation): number {
  return (
    a.medium.localeCompare(b.medium) ||
    a.group_sort_order - b.group_sort_order ||
    a.group_label.localeCompare(b.group_label) ||
    a.sort_order - b.sort_order ||
    a.entry_number - b.entry_number ||
    a.id.localeCompare(b.id)
  );
}

export function groupAdaptations(adaptations: Adaptation[]): AdaptationGroup[] {
  const groups = new Map<string, AdaptationGroup>();

  for (const adaptation of [...adaptations].sort(compareAdaptations)) {
    const key = `${adaptation.medium}:${adaptation.group_label}:${adaptation.group_sort_order}`;
    const group = groups.get(key);
    if (group) {
      group.items.push(adaptation);
      continue;
    }
    groups.set(key, {
      key,
      medium: adaptation.medium,
      group_label: adaptation.group_label,
      group_sort_order: adaptation.group_sort_order,
      items: [adaptation],
    });
  }

  return [...groups.values()];
}
