import { doc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { createEvent, deleteEvent, getEvents, updateEvent } from "./events";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

async function seedChapter(novelId: string, volumeId: string, chapterId: string, number: number, title: string) {
  await setDoc(doc(db, "novels", novelId, "volumes", volumeId, "chapters", chapterId), {
    number,
    title,
    summary: "",
    read_at: null,
    novel_id: novelId,
    volume_id: volumeId,
    tag_ids: [],
    character_ids: [],
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

    const cleared = await updateEvent("novel-1", event.id, { chapter_id: null });
    expect(cleared.chapter_id).toBeNull();
    expect(cleared.chapter_volume_id).toBeNull();
    expect(cleared.chapter_title).toBeNull();
    expect(cleared.chapter_number).toBeNull();
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

  it("deletes an event", async () => {
    const event = await createEvent("novel-1", {
      title: "Gone",
      description: "",
      story_date: "",
      sort_order: 0,
      chapter_id: null,
    });

    await deleteEvent("novel-1", event.id);

    const remaining = await getEvents("novel-1");
    expect(remaining.find((e) => e.id === event.id)).toBeUndefined();
  });
});
