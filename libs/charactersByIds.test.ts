import { expect, it } from "vitest";
import { charactersByIds } from "./charactersByIds";

it("returns only available characters in the chapter character_ids order", () => {
  const characters = [
    { id: "one", name: "One" },
    { id: "two", name: "Two" },
    { id: "unrelated", name: "Unrelated" },
  ];

  expect(charactersByIds(characters, ["two", "missing", "one"])).toEqual([
    { id: "two", name: "Two" },
    { id: "one", name: "One" },
  ]);
});
