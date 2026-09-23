import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  createEntity,
  decodeEntityCursor,
  encodeEntityCursor,
  getEntitiesPageByNamePrefix,
  getEntitiesPage,
  updateEntity,
} from "./entities";
import type { EntityNote } from "@/libs/entities/types";
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

it("normalizes entity names and aliases before persisting", async () => {
  const entity = await createEntity("novel-1", {
    type: "location",
    name: "  Tempest  ",
    aliases: [" Jura ", "", "Jura", "Tempest"],
    description: "",
  });

  expect(entity.name).toBe("Tempest");
  expect(entity.aliases).toEqual(["Jura"]);
});

it("rejects invalid entity types and empty names", async () => {
  await expect(
    createEntity("novel-1", {
      type: "invalid" as never,
      name: "Tempest",
      aliases: [],
      description: "",
    }),
  ).rejects.toThrow("type is invalid");
  await expect(
    createEntity("novel-1", {
      type: "location",
      name: "   ",
      aliases: [],
      description: "",
    }),
  ).rejects.toThrow("name is required");
});

describe("getEntitiesPageByNamePrefix", () => {
  it("returns only entities of the requested type whose names start with the prefix", async () => {
    for (const name of ["Tempest", "Temple", "Jura"]) {
      await createEntity("novel-1", {
        type: "location",
        name,
        aliases: [],
        description: "",
      });
    }
    await createEntity("novel-1", {
      type: "concept",
      name: "Tempest theory",
      aliases: [],
      description: "",
    });

    const result = await getEntitiesPageByNamePrefix(
      "novel-1",
      "location",
      "Tem",
      null,
      20,
    );

    expect(result.entities.map((entity) => entity.name)).toEqual([
      "Tempest",
      "Temple",
    ]);
  });
});

it("persists entity-only rich-text notes without reference fields", async () => {
  const entity = await createEntity("novel-1", {
    type: "location",
    name: "Tempest",
    aliases: [],
    description: "",
  });
  const notes: EntityNote[] = [
    {
      id: "note-1",
      content: "Capital city",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  ];

  const updated = await updateEntity("novel-1", entity.id, { notes });

  expect(updated.notes).toEqual(notes);
});

it("persists entity gallery images with the shared gallery model", async () => {
  const entity = await createEntity("novel-1", {
    type: "location",
    name: "Tempest",
    aliases: [],
    description: "",
  });

  const updated = await updateEntity("novel-1", entity.id, {
    gallery: [
      {
        id: "image-1",
        image_url: "https://example.com/tempest.jpg",
        source_url: "https://example.com/source",
        category: "official",
        sort_order: 1,
      },
    ],
  });

  expect(updated.gallery?.[0]?.category).toBe("official");
});
