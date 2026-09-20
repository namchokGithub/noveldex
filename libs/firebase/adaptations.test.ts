import { doc, getDoc, setDoc, Timestamp } from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  chapterIdsForVolume,
  createAdaptation,
  getAdaptationsByChapter,
  getAdaptationsForNovel,
  reorderAdaptations,
  updateAdaptation,
} from "./adaptations";
import { createChapter } from "./chapters";
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

const payload = {
  medium: "anime" as const,
  group_label: "Season 1",
  group_sort_order: 1,
  entry_type: "episode" as const,
  entry_number: 1,
  title: "Storm Dragon",
};

describe("adaptations", () => {
  it("reads only chapter ids from the selected volume when validating adapted chapters", async () => {
    await setDoc(doc(db, "novels", "novel-1"), {
      volume_count: 2,
      chapter_count: 0,
      read_count: 0,
    });
    await Promise.all(
      ["volume-1", "volume-2"].map((volumeId, index) =>
        setDoc(doc(db, "novels", "novel-1", "volumes", volumeId), {
          number: index + 1,
          chapter_count: 0,
          read_count: 0,
        }),
      ),
    );

    const matching = await createChapter("novel-1", "volume-1", {
      number: 1,
      title_en: "Matching chapter",
    });
    const otherVolume = await createChapter("novel-1", "volume-2", {
      number: 1,
      title_en: "Other volume chapter",
    });

    const adaptation = await createAdaptation("novel-1", "volume-1", {
      ...payload,
      adapted_chapter_ids: [matching.id],
    });
    await expect(
      updateAdaptation("novel-1", "volume-1", adaptation.id, {
        adapted_chapter_ids: [matching.id],
      }),
    ).resolves.toMatchObject({ adapted_chapter_ids: [matching.id] });
    await expect(
      createAdaptation("novel-1", "volume-1", {
        ...payload,
        entry_number: 2,
        adapted_chapter_ids: [otherVolume.id],
      }),
    ).rejects.toThrow("adapted chapters must belong to this volume");
    await expect(
      updateAdaptation("novel-1", "volume-1", adaptation.id, {
        adapted_chapter_ids: [otherVolume.id],
      }),
    ).rejects.toThrow("adapted chapters must belong to this volume");

    await expect(chapterIdsForVolume("novel-1", "volume-1")).resolves.toEqual(
      new Set([matching.id]),
    );
  });

  it("persists parent context and assigns the next position in its group", async () => {
    const first = await createAdaptation("novel-1", "volume-1", payload);
    const second = await createAdaptation("novel-1", "volume-1", {
      ...payload,
      entry_number: 2,
      title: "Demon Lord",
    });
    const snapshot = await getDoc(
      doc(
        db,
        "novels",
        "novel-1",
        "volumes",
        "volume-1",
        "adaptations",
        first.id,
      ),
    );

    expect(snapshot.data()).toMatchObject({
      novel_id: "novel-1",
      volume_id: "volume-1",
      source_url: null,
      source_img_url: null,
      description: "",
      sort_order: 1,
    });
    expect(second.sort_order).toBe(2);
    expect(first.notes).toEqual([]);
  });

  it("reads only one novel and follows the adaptation ordering contract", async () => {
    await createAdaptation("novel-1", "volume-1", {
      ...payload,
      medium: "manga",
      title: "Manga",
    });
    await createAdaptation("novel-1", "volume-2", {
      ...payload,
      title: "Episode 2",
      entry_number: 2,
    });
    await createAdaptation("novel-2", "volume-1", {
      ...payload,
      title: "Other novel",
    });

    const adaptations = await getAdaptationsForNovel("novel-1");

    expect(adaptations.map((adaptation) => adaptation.title)).toEqual([
      "Episode 2",
      "Manga",
    ]);
  });

  it("lists only adaptations mapped to a chapter in the same volume", async () => {
    const linkedRef = doc(
      db,
      "novels",
      "novel-1",
      "volumes",
      "volume-1",
      "adaptations",
      "linked",
    );
    const unrelatedRef = doc(
      db,
      "novels",
      "novel-1",
      "volumes",
      "volume-1",
      "adaptations",
      "unrelated",
    );
    const base = {
      ...payload,
      novel_id: "novel-1",
      volume_id: "volume-1",
      source_url: null,
      source_img_url: null,
      description: "",
      notes: [],
      sort_order: 1,
      created_at: Timestamp.now(),
      updated_at: Timestamp.now(),
    };
    await setDoc(linkedRef, { ...base, adapted_chapter_ids: ["chapter-1"] });
    await setDoc(unrelatedRef, { ...base, adapted_chapter_ids: ["chapter-2"] });

    const adaptations = await getAdaptationsByChapter(
      "novel-1",
      "volume-1",
      "chapter-1",
    );

    expect(adaptations.map((adaptation) => adaptation.id)).toEqual(["linked"]);
  });

  it("reorders only sort_order within the selected volume", async () => {
    const first = await createAdaptation("novel-1", "volume-1", payload);
    const second = await createAdaptation("novel-1", "volume-1", {
      ...payload,
      entry_number: 2,
      title: "Demon Lord",
    });

    await reorderAdaptations("novel-1", "volume-1", [
      { id: second.id, sort_order: 1 },
      { id: first.id, sort_order: 2 },
    ]);

    const reordered = await getAdaptationsForNovel("novel-1");
    expect(reordered.map((adaptation) => adaptation.id)).toEqual([
      second.id,
      first.id,
    ]);
    expect(reordered.map((adaptation) => adaptation.entry_number)).toEqual([
      2, 1,
    ]);
  });
});
