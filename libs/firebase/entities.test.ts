import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createEntity,
  decodeEntityCursor,
  encodeEntityCursor,
  getEntitiesPage,
} from "./entities";
import {
  clearFirestoreEmulator,
  connectFirestoreTestEmulator,
} from "./testUtils";

beforeAll(async () => {
  await connectFirestoreTestEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("getEntitiesPage", () => {
  it("serializes a cursor for the URL without losing Unicode names", () => {
    const cursor = { name: "สกิลนักล่า", id: "entity/1" };

    expect(decodeEntityCursor(encodeEntityCursor(cursor))).toEqual(cursor);
    expect(decodeEntityCursor("not-a-cursor")).toBeNull();
  });

  it("returns one typed cursor page without reading other entity types", async () => {
    for (const name of ["Alpha", "Bravo", "Charlie"]) {
      await createEntity("novel-1", {
        type: "concept",
        name,
        aliases: [],
        description: "",
      });
    }
    await createEntity("novel-1", {
      type: "location",
      name: "Ignored location",
      aliases: [],
      description: "",
    });

    const first = await getEntitiesPage("novel-1", "concept", null, 2);

    expect(first.entities.map((entity) => entity.name)).toEqual([
      "Alpha",
      "Bravo",
    ]);
    expect(first.nextCursor).toBeTruthy();

    const second = await getEntitiesPage(
      "novel-1",
      "concept",
      first.nextCursor,
      2,
    );

    expect(second.entities.map((entity) => entity.name)).toEqual(["Charlie"]);
    expect(second.nextCursor).toBeNull();
  });
});
