import { describe, expect, it } from "vitest";
import {
  paginateStoryPages,
  paginateStorySequences,
} from "./timelinePagination";

describe("paginateStoryPages", () => {
  it("keeps only ten numbered story pages in one view and moves to the next ten", () => {
    const pages = Array.from({ length: 12 }, (_, index) => index + 1);

    expect(paginateStoryPages(pages, 1)).toEqual({
      current: 1,
      total: 2,
      items: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    });
    expect(paginateStoryPages(pages, 2)).toEqual({
      current: 2,
      total: 2,
      items: [11, 12],
    });
  });

  it("normalizes an out-of-range view to an available page", () => {
    expect(paginateStoryPages([4, 8], 9)).toEqual({
      current: 1,
      total: 1,
      items: [4, 8],
    });
  });
});

describe("paginateStorySequences", () => {
  it("keeps a numbered story page's events in story order and limits each sequence view to twenty", () => {
    const events = Array.from(
      { length: 23 },
      (_, index) => `event-${index + 1}`,
    );

    expect(paginateStorySequences(events, 1)).toEqual({
      current: 1,
      total: 2,
      items: Array.from({ length: 20 }, (_, index) => `event-${index + 1}`),
    });
    expect(paginateStorySequences(events, 2)).toEqual({
      current: 2,
      total: 2,
      items: ["event-21", "event-22", "event-23"],
    });
  });
});
