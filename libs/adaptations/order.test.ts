import { describe, expect, it } from "vitest";
import type { Adaptation } from "@/app/types";
import { groupAdaptations } from "./order";

function adaptation(overrides: Partial<Adaptation>): Adaptation {
  return {
    id: "adaptation",
    novel_id: "novel-1",
    volume_id: "volume-1",
    medium: "anime",
    group_label: "Season 1",
    group_sort_order: 1,
    entry_type: "episode",
    entry_number: 1,
    title: "Episode",
    source_url: null,
    source_img_url: null,
    description: "",
    notes: [],
    adapted_chapter_ids: [],
    sort_order: 1,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

describe("groupAdaptations", () => {
  it("orders groups and entries from shuffled input", () => {
    const groups = groupAdaptations([
      adaptation({
        id: "manga-2",
        medium: "manga",
        group_label: "Volume 1",
        entry_number: 2,
        sort_order: 2,
      }),
      adaptation({ id: "anime-2", entry_number: 2, sort_order: 2 }),
      adaptation({
        id: "anime-special",
        group_label: "Specials",
        group_sort_order: 2,
        entry_type: "special",
        entry_number: 1,
      }),
      adaptation({
        id: "manga-1",
        medium: "manga",
        group_label: "Volume 1",
        entry_number: 1,
        sort_order: 1,
      }),
      adaptation({ id: "anime-1", entry_number: 1, sort_order: 1 }),
    ]);

    expect(groups.map((group) => group.key)).toEqual([
      "anime:Season 1:1",
      "anime:Specials:2",
      "manga:Volume 1:1",
    ]);
    expect(groups.map((group) => group.items.map((item) => item.id))).toEqual([
      ["anime-1", "anime-2"],
      ["anime-special"],
      ["manga-1", "manga-2"],
    ]);
  });
});
