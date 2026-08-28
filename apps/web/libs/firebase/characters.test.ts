import { doc, setDoc, Timestamp } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createCharacter,
  deleteCharacter,
  getAllCharacters,
  getCharacter,
  getCharacters,
  updateCharacter,
} from "./characters";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
  await setDoc(doc(db, "character_roles", "role-protagonist"), {
    code: "protagonist",
    name: "Protagonist",
    is_active: true,
  });
  await setDoc(doc(db, "character_roles", "role-minor"), {
    code: "minor",
    name: "Minor",
    is_active: true,
  });
});

async function seedChapterWithCharacter(
  novelId: string,
  chapterId: string,
  number: number,
  characterId: string,
) {
  await setDoc(
    doc(db, "novels", novelId, "volumes", "vol-1", "chapters", chapterId),
    {
      number,
      title: `Chapter ${number}`,
      summary: "",
      read_at: null,
      novel_id: novelId,
      volume_id: "vol-1",
      tag_ids: [],
      character_ids: [characterId],
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    },
  );
}

describe("characters", () => {
  it("creates a character resolving role_id to role/role_name", async () => {
    const character = await createCharacter("novel-1", {
      name: "Alice",
      role_id: "role-protagonist",
      description: "",
      aliases: [],
    });

    expect(character.name).toBe("Alice");
    expect(character.role_id).toBe("role-protagonist");
    expect(character.role).toBe("protagonist");
    expect(character.role_name).toBe("Protagonist");
    expect(character.aliases).toEqual([]);
    expect(character.chapter_count).toBe(0);
  });

  it("creates a character resolving a role code to role_id/role_name", async () => {
    const character = await createCharacter("novel-1", {
      name: "Bob",
      role: "minor",
      description: "",
      aliases: [],
    });

    expect(character.role_id).toBe("role-minor");
    expect(character.role).toBe("minor");
    expect(character.role_name).toBe("Minor");
  });

  it("updating role_id clears the old role code resolution and re-resolves", async () => {
    const character = await createCharacter("novel-1", {
      name: "Carol",
      role: "minor",
      description: "",
      aliases: [],
    });

    const updated = await updateCharacter("novel-1", character.id, {
      role_id: "role-protagonist",
    });

    expect(updated.role_id).toBe("role-protagonist");
    expect(updated.role).toBe("protagonist");
    expect(updated.role_name).toBe("Protagonist");
  });

  it("computes chapter_count and chapters[] via collectionGroup array-contains, ordered by number", async () => {
    const character = await createCharacter("novel-1", {
      name: "Dave",
      role: "minor",
      description: "",
      aliases: [],
    });
    await seedChapterWithCharacter("novel-1", "ch-2", 2, character.id);
    await seedChapterWithCharacter("novel-1", "ch-1", 1, character.id);

    const fetched = await getCharacter("novel-1", character.id);

    expect(fetched.chapter_count).toBe(2);
    expect(fetched.chapters?.map((c) => c.number)).toEqual([1, 2]);
  });

  it("scopes chapter hydration to the character's own novel via the novel_id filter", async () => {
    const character = await createCharacter("novel-1", {
      name: "Frank",
      role: "minor",
      description: "",
      aliases: [],
    });
    // Seeded directly (not via app logic, which never lets a novel-2 chapter
    // reference a novel-1 character) to prove the novel_id filter, not just
    // the array-contains filter, is doing the scoping.
    await seedChapterWithCharacter("novel-2", "ch-cross-novel", 1, character.id);

    const fetched = await getCharacter("novel-1", character.id);

    expect(fetched.chapter_count).toBe(0);
    expect(fetched.chapters).toEqual([]);
  });

  it("falls back to the minor role when neither role_id nor role is provided", async () => {
    const character = await createCharacter("novel-1", {
      name: "Grace",
      description: "",
      aliases: [],
    });

    expect(character.role_id).toBe("role-minor");
    expect(character.role).toBe("minor");
    expect(character.role_name).toBe("Minor");
  });

  it("leaves role fields untouched when updating an unrelated field", async () => {
    const character = await createCharacter("novel-1", {
      name: "Heidi",
      role: "protagonist",
      description: "original description",
      aliases: [],
    });

    const updated = await updateCharacter("novel-1", character.id, {
      description: "updated description",
    });

    expect(updated.description).toBe("updated description");
    expect(updated.role_id).toBe(character.role_id);
    expect(updated.role).toBe(character.role);
    expect(updated.role_name).toBe(character.role_name);
  });

  it("getAllCharacters returns every character for a novel, unpaginated", async () => {
    await createCharacter("novel-1", { name: "A", role: "minor", description: "", aliases: [] });
    await createCharacter("novel-1", { name: "B", role: "minor", description: "", aliases: [] });
    await createCharacter("novel-2", { name: "C", role: "minor", description: "", aliases: [] });

    const all = await getAllCharacters("novel-1");

    expect(all.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });

  it("getCharacters paginates with a summary", async () => {
    for (let i = 0; i < 3; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await createCharacter("novel-1", {
        name: `Char ${i}`,
        role: "minor",
        description: "",
        aliases: [],
      });
    }

    const page = await getCharacters("novel-1", { page: 1, perPage: 5 });

    expect(page.items).toHaveLength(3);
    expect(page.summary).toEqual({ total_characters: 3 });
  });

  it("throws when getting a character that does not exist", async () => {
    await expect(getCharacter("novel-1", "does-not-exist")).rejects.toThrow();
  });

  it("deletes a character", async () => {
    const character = await createCharacter("novel-1", {
      name: "Eve",
      role: "minor",
      description: "",
      aliases: [],
    });

    await deleteCharacter("novel-1", character.id);

    await expect(getCharacter("novel-1", character.id)).rejects.toThrow();
  });
});
