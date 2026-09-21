import {
  doc,
  getDoc,
  setDoc,
  Timestamp,
  updateDoc,
} from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createEvent,
  deleteEvent,
  getEvents,
  getEventsByChapter,
  updateEvent,
} from "./events";
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

async function seedChapter(
  novelId: string,
  volumeId: string,
  chapterId: string,
  number: number,
  title: string,
) {
  await setDoc(
    doc(db, "novels", novelId, "volumes", volumeId),
    {
      number: 1,
      chapter_count: 0,
      read_count: 0,
      adaptation_count: 0,
      event_count: 0,
    },
    { merge: true },
  );
  await setDoc(
    doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId),
    {
      number,
      title,
      summary: "",
      read_at: null,
      novel_id: novelId,
      volume_id: volumeId,
      tag_ids: [],
      character_ids: [],
      event_count: 0,
    },
  );
}

async function seedCharacter(
  novelId: string,
  characterId: string,
  name: string,
) {
  await setDoc(doc(db, "novels", novelId, "characters", characterId), {
    name,
    aliases: [],
    role_id: "role-minor",
    role: "minor",
    role_name: "Minor",
    profile_image_url: null,
    description: "",
    created_at: Timestamp.now(),
    updated_at: Timestamp.now(),
  });
}

describe("events", () => {
  it("creates an event with no chapter link", async () => {
    const event = await createEvent("novel-1", {
      title: "The Beginning",
      description: "It all started here.",
      story_date: "Year 1",
      sort_order: 0,
      chapter_id: null,
    });

    expect(event.title).toBe("The Beginning");
    expect(event.chapter_id).toBeNull();
    expect(event.chapter_title).toBeNull();
    expect(event.character_names).toEqual([]);
  });

  it("creates an event linked to a chapter, denormalizing chapter title/number", async () => {
    await seedChapter("novel-1", "vol-1", "ch-1", 3, "The Duel");

    const event = await createEvent("novel-1", {
      title: "Duel scene",
      description: "",
      story_date: "Year 2",
      sort_order: 1,
      chapter_id: "ch-1",
      chapter_volume_id: "vol-1",
    });

    expect(event.chapter_id).toBe("ch-1");
    expect(event.chapter_volume_id).toBe("vol-1");
    expect(event.chapter_title).toBe("The Duel");
    expect(event.chapter_number).toBe(3);
    expect(
      (await getDoc(doc(db, "novels", "novel-1", "volumes", "vol-1"))).data(),
    ).toMatchObject({ event_count: 1 });
    expect(
      (
        await getDoc(
          doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", "ch-1"),
        )
      ).data(),
    ).toMatchObject({ event_count: 1 });
  });

  it("updating chapter_id re-denormalizes chapter fields, and clearing it nulls them", async () => {
    await seedChapter("novel-1", "vol-1", "ch-1", 1, "First");
    await seedChapter("novel-1", "vol-1", "ch-2", 2, "Second");
    const event = await createEvent("novel-1", {
      title: "E",
      description: "",
      story_date: "Y1",
      sort_order: 0,
      chapter_id: "ch-1",
      chapter_volume_id: "vol-1",
    });

    const moved = await updateEvent("novel-1", event.id, {
      chapter_id: "ch-2",
      chapter_volume_id: "vol-1",
    });
    expect(moved.chapter_title).toBe("Second");
    expect(moved.chapter_number).toBe(2);
    expect(
      (
        await getDoc(
          doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", "ch-1"),
        )
      ).data(),
    ).toMatchObject({ event_count: 0 });
    expect(
      (
        await getDoc(
          doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", "ch-2"),
        )
      ).data(),
    ).toMatchObject({ event_count: 1 });

    const cleared = await updateEvent("novel-1", event.id, {
      chapter_id: null,
    });
    expect(cleared.chapter_id).toBeNull();
    expect(cleared.chapter_volume_id).toBeNull();
    expect(cleared.chapter_title).toBeNull();
    expect(cleared.chapter_number).toBeNull();
    expect(
      (await getDoc(doc(db, "novels", "novel-1", "volumes", "vol-1"))).data(),
    ).toMatchObject({ event_count: 0 });
  });

  it("lists events for a novel ordered by sort_order", async () => {
    await createEvent("novel-1", {
      title: "B",
      description: "",
      story_date: "",
      sort_order: 2,
      chapter_id: null,
    });
    await createEvent("novel-1", {
      title: "A",
      description: "",
      story_date: "",
      sort_order: 1,
      chapter_id: null,
    });

    const events = await getEvents("novel-1");

    expect(events.map((e) => e.title)).toEqual(["A", "B"]);
  });

  it("lists only events linked to a chapter", async () => {
    await seedChapter("novel-1", "vol-1", "chapter-1", 1, "First");
    await seedChapter("novel-1", "vol-1", "chapter-2", 2, "Second");
    await createEvent("novel-1", {
      title: "Linked",
      description: "",
      story_date: "",
      sort_order: 1,
      chapter_id: "chapter-1",
      chapter_volume_id: "vol-1",
    });
    await createEvent("novel-1", {
      title: "Elsewhere",
      description: "",
      story_date: "",
      sort_order: 2,
      chapter_id: "chapter-2",
      chapter_volume_id: "vol-1",
    });

    const events = await getEventsByChapter("novel-1", "chapter-1");

    expect(events.map((event) => event.title)).toEqual(["Linked"]);
  });

  it("resolves character_ids to character_names via getEvents", async () => {
    await seedCharacter("novel-1", "char-1", "Alice");
    const event = await createEvent("novel-1", {
      title: "Meeting",
      description: "",
      story_date: "Year 1",
      sort_order: 0,
      chapter_id: null,
    });

    await updateDoc(doc(db, "novels", "novel-1", "events", event.id), {
      character_ids: ["char-1"],
    });

    const events = await getEvents("novel-1");
    const found = events.find((e) => e.id === event.id);

    expect(found?.character_names).toEqual(["Alice"]);
  });

  it("uses a supplied character-name map without reading characters again", async () => {
    const event = await createEvent("novel-1", {
      title: "Meeting",
      description: "",
      story_date: "Year 1",
      sort_order: 0,
      chapter_id: null,
    });
    await updateDoc(doc(db, "novels", "novel-1", "events", event.id), {
      character_ids: ["char-from-page"],
    });

    const events = await getEvents(
      "novel-1",
      new Map([["char-from-page", "Alice"]]),
    );

    expect(
      events.find((item) => item.id === event.id)?.character_names,
    ).toEqual(["Alice"]);
  });

  it("persists page_number and character_ids supplied by the event form", async () => {
    await seedCharacter("novel-1", "char-1", "Alice");
    await seedCharacter("novel-1", "char-2", "Bob");

    const event = await createEvent("novel-1", {
      title: "Page event",
      description: "",
      sort_order: 2,
      page_number: 12,
      character_ids: ["char-1", "char-2"],
      chapter_id: null,
    });

    expect(event.page_number).toBe(12);
    expect(event.character_ids).toEqual(["char-1", "char-2"]);
    expect(event.character_names).toEqual(["Alice", "Bob"]);

    const updated = await updateEvent("novel-1", event.id, {
      page_number: null,
      character_ids: ["char-2"],
    });
    expect(updated.page_number).toBeNull();
    expect(updated.character_ids).toEqual(["char-2"]);
    expect(updated.character_names).toEqual(["Bob"]);
  });

  it("deletes a linked event and clamps counters at zero", async () => {
    await seedChapter("novel-1", "vol-1", "ch-1", 1, "First");
    const event = await createEvent("novel-1", {
      title: "Gone",
      description: "",
      story_date: "",
      sort_order: 0,
      chapter_id: "ch-1",
      chapter_volume_id: "vol-1",
    });

    await updateDoc(doc(db, "novels", "novel-1", "volumes", "vol-1"), {
      event_count: 0,
    });
    await updateDoc(
      doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", "ch-1"),
      { event_count: 0 },
    );

    await deleteEvent("novel-1", event.id);

    const remaining = await getEvents("novel-1");
    expect(remaining.find((e) => e.id === event.id)).toBeUndefined();
    expect(
      (await getDoc(doc(db, "novels", "novel-1", "volumes", "vol-1"))).data(),
    ).toMatchObject({ event_count: 0 });
    expect(
      (
        await getDoc(
          doc(db, "novels", "novel-1", "volumes", "vol-1", "chapters", "ch-1"),
        )
      ).data(),
    ).toMatchObject({ event_count: 0 });
  });
});
