import { doc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { getCharacterRoles } from "./characterRoles";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("getCharacterRoles", () => {
  it("returns only active roles, ordered by name", async () => {
    await setDoc(doc(db, "character_roles", "r1"), {
      code: "protagonist",
      name: "Protagonist",
      is_active: true,
    });
    await setDoc(doc(db, "character_roles", "r2"), {
      code: "antagonist",
      name: "Antagonist",
      is_active: true,
    });
    await setDoc(doc(db, "character_roles", "r3"), {
      code: "retired",
      name: "Retired Role",
      is_active: false,
    });

    const roles = await getCharacterRoles();

    expect(roles.map((r) => r.name)).toEqual(["Antagonist", "Protagonist"]);
    expect(roles.every((r) => r.is_active)).toBe(true);
  });

  it("returns an empty array when no roles exist", async () => {
    expect(await getCharacterRoles()).toEqual([]);
  });
});
