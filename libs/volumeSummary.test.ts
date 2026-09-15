import { describe, expect, it } from "vitest";
import { summarizeVolumeContents } from "./volumeSummary";

describe("summarizeVolumeContents", () => {
  it("counts regular chapters, embedded notes, events, and adaptations", () => {
    expect(
      summarizeVolumeContents({
        chapters: [
          { kind: "chapter", notes: [{}, {}] },
          { kind: "prologue", notes: [{}] },
        ],
        eventCount: 3,
        adaptationCount: 4,
      }),
    ).toEqual({ chapters: 1, notes: 3, events: 3, adaptations: 4 });
  });
});
