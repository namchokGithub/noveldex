import { expect, it } from "vitest";
import { characterIdsInTimeline } from "./timelineParticipants";

it("returns each character represented by at least one timeline event once", () => {
  expect(
    characterIdsInTimeline([
      { character_ids: ["rimuru", "shion"] },
      { character_ids: ["rimuru"] },
      { character_ids: [] },
    ]),
  ).toEqual(new Set(["rimuru", "shion"]));
});
