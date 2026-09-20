import { expect, it } from "vitest";
import {
  decodeVolumeCursor,
  encodeVolumeCursor,
  previousVolumeCursor,
  resolveVolumeCursorSearch,
} from "./volumes";

it("rejects cursor document IDs containing a path separator", () => {
  const malformedCursor = encodeURIComponent(
    JSON.stringify({ number: 2, id: "volume/2a" }),
  );

  expect(decodeVolumeCursor(malformedCursor)).toBeNull();
});

it("resets cursor navigation when any supplied volume cursor is malformed", () => {
  const validCursor = encodeVolumeCursor({ number: 2, id: "volume-2a" });

  expect(
    resolveVolumeCursorSearch({ after: "not-a-cursor", before: validCursor }),
  ).toEqual({ after: null, before: null });
});

it("suppresses Previous on page one but keeps it on a later cursor page", () => {
  const cursor = { number: 2, id: "volume-2a" };

  expect(previousVolumeCursor(1, cursor)).toBeNull();
  expect(previousVolumeCursor(2, cursor)).toEqual(cursor);
});
