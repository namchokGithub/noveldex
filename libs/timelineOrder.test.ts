import { describe, expect, it } from "vitest";
import { eventOrder, nextEventPosition } from "./timelineOrder";
import type { NovelEvent } from "@/app/types";

function event(
  id: string,
  chapter_id: string | null,
  page_number: number | null,
  sort_order = 0,
): NovelEvent {
  return {
    id,
    novel_id: "n",
    chapter_id,
    chapter_volume_id: chapter_id ? "v" : null,
    chapter_title: null,
    chapter_number: null,
    page_number,
    title: "",
    description: "",
    story_date: "",
    sort_order,
    character_ids: [],
    character_names: [],
    created_at: "",
    updated_at: "",
  };
}
describe("eventOrder", () => {
  it("orders placement, page, sort order, then id", () => {
    const chapters = [{ id: "c", volume_id: "v", sort_order: 1 }],
      volumes = [{ id: "v", number: 1 }];
    expect(
      eventOrder(
        event("placed", "c", 1),
        event("unplaced", null, null),
        chapters,
        volumes,
      ),
    ).toBeLessThan(0);
    expect(
      eventOrder(
        event("a", null, null, 1),
        event("b", null, null, 1),
        chapters,
        volumes,
      ),
    ).toBeLessThan(0);
  });
});

describe("nextEventPosition", () => {
  it("uses only events in the selected volume, chapter, and page", () => {
    expect(
      nextEventPosition(
        [
          event("a", "c", 10, 3),
          event("b", "c", 10, 8),
          event("other-page", "c", 11, 20),
          event("other-chapter", "c2", 10, 30),
        ],
        { volumeId: "v", chapterId: "c", pageNumber: 10 },
      ),
    ).toBe(9);
  });

  it("starts at zero when the selected group has no events", () => {
    expect(
      nextEventPosition([event("other", "c", 12, 3)], {
        volumeId: "v",
        chapterId: "c",
        pageNumber: 10,
      }),
    ).toBe(0);
  });
});
