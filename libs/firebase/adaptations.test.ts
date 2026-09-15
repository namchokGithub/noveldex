import { doc, getDoc } from "firebase/firestore/lite";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import {
  createAdaptation,
  getAdaptationsForNovel,
  reorderAdaptations,
} from "./adaptations";
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
