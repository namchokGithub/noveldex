import {
  doc,
  getDoc,
  runTransaction,
  setDoc,
  Timestamp,
} from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createCharacter,
  deleteCharacter,
  getAllCharacters,
  getCharacter,
  getCharacters,
  getCharactersPage,
  decodeCharacterCursor,
  encodeCharacterCursor,
  resolveCharacterCursorSearch,
  updateCharacter,
} from "./characters";
import { applyCharacterChapterCountDeltas } from "./counters";
import {
  clearFirestoreEmulator,
  connectFirestoreTestEmulator,
} from "./testUtils";

beforeAll(async () => {
  await connectFirestoreTestEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
  for (const novelId of ["novel-1", "novel-2"]) {
    await setDoc(doc(db, "novels", novelId), {
      character_count: 0,
      volume_count: 0,
      chapter_count: 0,
      read_count: 0,
    });
  }
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
  notes: Array<{ id: string; content: string; character_ids: string[] }> = [],
) {
  await setDoc(
    doc(db, "novels", novelId, "volumes", "vol-1", "chapters", chapterId),
    {
      number,
      title: `Chapter ${number}`,
      title_en: `Chapter ${number}`,
      title_th: "",
      summary: "",
      notes: notes.map((note) => ({
        ...note,
        created_at: Timestamp.now(),
        updated_at: Timestamp.now(),
      })),
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
  it("maintains the Novel character total across create and delete", async () => {
    const character = await createCharacter("novel-1", {
      name: "Alice",
      role: "minor",
      description: "",
      aliases: [],
    });
    expect(
      (await getDoc(doc(db, "novels", "novel-1"))).data()?.character_count,
    ).toBe(1);

    await deleteCharacter("novel-1", character.id);
    expect(
      (await getDoc(doc(db, "novels", "novel-1"))).data()?.character_count,
    ).toBe(0);
  });

  it("paginates duplicate names in both directions with an opaque cursor", async () => {
    const now = Timestamp.now();
    await setDoc(doc(db, "novels", "novel-1"), {
      title: "Novel",
      author: "Author",
      status: "reading",
      description: "",
      cover_url: "",
      character_count: 6,
      created_at: now,
      updated_at: now,
    });
    for (const [id, name] of [
      ["a", "Alice"],
      ["b", "Alice"],
      ["c", "Bob"],
      ["d", "Carol"],
      ["e", "Dave"],
      ["f", "Eve"],
    ] as const) {
      await setDoc(doc(db, "novels", "novel-1", "characters", id), {
        name,
        name_search: name.toLowerCase(),
        aliases: [],
        role_id: "role-minor",
        role: "minor",
        role_name: "Minor",
        profile_image_url: null,
        description: "",
        chapter_count: 0,
        created_at: now,
        updated_at: now,
      });
    }

    const first = await getCharactersPage("novel-1", { page: 1, perPage: 5 });
    const second = await getCharactersPage("novel-1", {
      page: 2,
      perPage: 5,
      after: first.nextCursor,
    });
    const previous = await getCharactersPage("novel-1", {
      page: 1,
      perPage: 5,
      before: second.previousCursor,
    });

    expect(first.items.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(second.items.map((item) => item.id)).toEqual(["f"]);
    expect(previous.items.map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
    ]);
    expect(first.pagination.total_items).toBe(6);
  });

  it("finds a case-insensitive name prefix and sorts its matches", async () => {
    await createCharacter("novel-1", {
      name: "Rimuru Tempest",
      role: "minor",
      description: "",
      aliases: [],
    });
    await createCharacter("novel-1", {
      name: "Rimuru Mikami",
      role: "protagonist",
      description: "",
      aliases: [],
    });
    await createCharacter("novel-1", {
      name: "Shizu",
      role: "minor",
      description: "",
      aliases: [],
    });

    const page = await getCharactersPage("novel-1", {
      page: 1,
      perPage: 5,
      search: "rim",
      sort: "name",
      direction: "asc",
    });

    expect(page.items.map((character) => character.name)).toEqual([
      "Rimuru Mikami",
      "Rimuru Tempest",
    ]);
    expect(page.pagination.total_items).toBe(2);
  });

  it("sorts characters by updated time and role in either direction", async () => {
    const older = Timestamp.fromMillis(1_000);
    const newer = Timestamp.fromMillis(2_000);
    await setDoc(doc(db, "novels", "novel-1"), { character_count: 2 }, { merge: true });
    await setDoc(doc(db, "novels", "novel-1", "characters", "alice"), {
      name: "Alice",
      name_search: "alice",
      aliases: [],
      role_id: "role-minor",
      role: "minor",
      role_name: "Minor",
      profile_image_url: null,
      description: "",
      created_at: older,
      updated_at: older,
    });
    await setDoc(doc(db, "novels", "novel-1", "characters", "rimuru"), {
      name: "Rimuru",
      name_search: "rimuru",
      aliases: [],
      role_id: "role-protagonist",
      role: "protagonist",
      role_name: "Protagonist",
      profile_image_url: null,
      description: "",
      created_at: newer,
      updated_at: newer,
    });

    const byUpdated = await getCharactersPage("novel-1", {
      perPage: 5,
      sort: "updated_at",
      direction: "desc",
    });
    const byRole = await getCharactersPage("novel-1", {
      perPage: 5,
      sort: "role",
      direction: "desc",
    });

    expect(byUpdated.items.map((character) => character.name)).toEqual([
      "Rimuru",
      "Alice",
    ]);
    expect(byRole.items.map((character) => character.name)).toEqual([
      "Rimuru",
      "Alice",
    ]);
  });

  it("rejects malformed character cursors and preserves the cursor contract", () => {
    const cursor = { values: ["alice"], id: "character-1" };
    expect(decodeCharacterCursor(encodeCharacterCursor(cursor))).toEqual(
      cursor,
    );
    expect(decodeCharacterCursor('{"values":[1],"id":"character-1"}')).toBeNull();
    expect(decodeCharacterCursor('{"values":["alice"],"id":"a/b"}')).toBeNull();
    expect(resolveCharacterCursorSearch({ after: "invalid" })).toEqual({
      after: null,
      before: null,
    });
    expect(
      resolveCharacterCursorSearch({ after: encodeCharacterCursor(cursor) }),
    ).toEqual({ after: cursor, before: null });
  });

  it("applies character chapter deltas without creating missing references", async () => {
    const existingRef = doc(db, "novels", "novel-1", "characters", "existing");
    await setDoc(existingRef, { chapter_count: 1 });

    await runTransaction(db, async (transaction) => {
      await applyCharacterChapterCountDeltas(transaction, "novel-1", [
        { characterId: "existing", delta: 2 },
        { characterId: "missing", delta: -1 },
      ]);
    });

    expect((await getDoc(existingRef)).data()?.chapter_count).toBe(3);
    expect(
      (
        await getDoc(doc(db, "novels", "novel-1", "characters", "missing"))
      ).exists(),
    ).toBe(false);
  });

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

  it("persists appearance, personality, and trivia through create and update", async () => {
    const character = await createCharacter("novel-1", {
      name: "Alice",
      role: "minor",
      description: "A careful observer.",
      aliases: [],
      appearance: "Silver hair",
      personality: "Thoughtful and reserved",
      trivia: "Collects old maps",
    });

    expect(character).toMatchObject({
      appearance: "Silver hair",
      personality: "Thoughtful and reserved",
      trivia: "Collects old maps",
    });

    const updated = await updateCharacter("novel-1", character.id, {
      appearance: "Short silver hair",
      personality: "Thoughtful but bold",
      trivia: "Can read three scripts",
    });

    expect(updated).toMatchObject({
      appearance: "Short silver hair",
      personality: "Thoughtful but bold",
      trivia: "Can read three scripts",
    });
    await expect(getCharacter("novel-1", character.id)).resolves.toMatchObject({
      appearance: "Short silver hair",
      personality: "Thoughtful but bold",
      trivia: "Can read three scripts",
    });
  });

  it("persists optional character design data without duplicating core fields", async () => {
    const character = await createCharacter("novel-1", {
      name: "Alice",
      role: "minor",
      description: "",
      aliases: ["Al"],
      data: {
        biographical_and_biological: {
          name_thai: "อลิซ",
          blessings: ["Moon blessing", "Forest blessing"],
          species: "Human",
        },
        social: {
          occupations: ["Scholar", "Guide"],
          affiliations: ["North Guild"],
        },
        debut: { anime: "Episode 4" },
      },
    });

    expect(character.data).toEqual({
      biographical_and_biological: {
        name_thai: "อลิซ",
        blessings: ["Moon blessing", "Forest blessing"],
        species: "Human",
      },
      social: {
        occupations: ["Scholar", "Guide"],
        affiliations: ["North Guild"],
      },
      debut: { anime: "Episode 4" },
    });
    expect(character.name).toBe("Alice");
    expect(character.aliases).toEqual(["Al"]);

    const updated = await updateCharacter("novel-1", character.id, {
      data: {
        ...character.data,
        social: { ...character.data?.social, rank: "A" },
      },
    });
    expect(updated.data?.social?.rank).toBe("A");
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

  it("includes only notes that reference the character in chapter appearances", async () => {
    const character = await createCharacter("novel-1", {
      name: "Alice",
      role: "minor",
      description: "",
      aliases: [],
    });
    await seedChapterWithCharacter("novel-1", "ch-1", 1, character.id, [
      {
        id: "alice-note",
        content: "Alice arrives.",
        character_ids: [character.id],
      },
      {
        id: "other-note",
        content: "Someone else leaves.",
        character_ids: ["other"],
      },
    ]);

    const fetched = await getCharacter("novel-1", character.id);

    expect(fetched.chapters?.[0]?.notes?.map((note) => note.id)).toEqual([
      "alice-note",
    ]);
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
    await seedChapterWithCharacter(
      "novel-2",
      "ch-cross-novel",
      1,
      character.id,
    );

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
    await createCharacter("novel-1", {
      name: "A",
      role: "minor",
      description: "",
      aliases: [],
    });
    await createCharacter("novel-1", {
      name: "B",
      role: "minor",
      description: "",
      aliases: [],
    });
    await createCharacter("novel-2", {
      name: "C",
      role: "minor",
      description: "",
      aliases: [],
    });

    const all = await getAllCharacters("novel-1");

    expect(all.map((c) => c.name).sort()).toEqual(["A", "B"]);
  });

  it("getCharacters paginates with a summary", async () => {
    for (let i = 0; i < 3; i += 1) {
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
