import { beforeEach, expect, it, vi } from "vitest";
import type { Entity } from "./types";

vi.mock("@/libs/firebase/characters", () => ({
  getAllCharacters: vi.fn(),
}));
vi.mock("@/libs/firebase/entities", () => ({
  getEntities: vi.fn(),
}));

import { getEntities } from "@/libs/firebase/entities";
import { firestoreEntityLookup } from "./firestoreLookup";

const entities: Entity[] = [
  {
    id: "novel-1:location:tempest",
    novelId: "novel-1",
    type: "location",
    name: "Tempest",
    aliases: [],
    description: "",
  },
  {
    id: "novel-1:item:mask",
    novelId: "novel-1",
    type: "item",
    name: "Mask",
    aliases: [],
    description: "",
  },
];

beforeEach(() => {
  vi.mocked(getEntities).mockReset();
  vi.mocked(getEntities).mockResolvedValue(entities);
});

it("shares one generic entity load across reference types in a novel", async () => {
  const lookup = firestoreEntityLookup();

  await expect(
    lookup.findByName("novel-1", "Tempest", "location"),
  ).resolves.toEqual([entities[0]]);
  await expect(
    lookup.findByName("novel-1", "Mask", "item"),
  ).resolves.toEqual([entities[1]]);

  expect(getEntities).toHaveBeenCalledOnce();
  expect(getEntities).toHaveBeenCalledWith("novel-1");
});
