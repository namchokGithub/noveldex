import { Timestamp } from "firebase/firestore/lite";
import { describe, expect, it } from "vitest";
import { chapterCounterContribution, chapterCounterDelta } from "./counters";

describe("chapter counters", () => {
  it("counts an unread regular chapter", () => {
    expect(
      chapterCounterContribution({ kind: "chapter", read_at: null }),
    ).toEqual({ chapter_count: 1, read_count: 0 });
  });

  it("counts a read regular chapter", () => {
    expect(
      chapterCounterContribution({ kind: "chapter", read_at: Timestamp.now() }),
    ).toEqual({ chapter_count: 1, read_count: 1 });
  });

  it("excludes special entries even when read", () => {
    expect(
      chapterCounterContribution({
        kind: "prologue",
        read_at: Timestamp.now(),
      }),
    ).toEqual({ chapter_count: 0, read_count: 0 });
  });

  it("adds one read count when an unread chapter becomes read", () => {
    expect(
      chapterCounterDelta(
        { kind: "chapter", read_at: null },
        { kind: "chapter", read_at: Timestamp.now() },
      ),
    ).toEqual({ chapter_count: 0, read_count: 1 });
  });
});
