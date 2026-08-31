import { doc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { getLastOrderNos } from "./lastOrderNos";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("getLastOrderNos", () => {
  it("returns 0 for both when neither param matches anything", async () => {
    expect(await getLastOrderNos({})).toEqual({ volume: 0, chapter: 0 });
  });

  it("returns the highest volume number for a novel_id", async () => {
    await setDoc(doc(db, "novels", "novel-1", "volumes", "v1"), { number: 3, title: "A" });
    await setDoc(doc(db, "novels", "novel-1", "volumes", "v2"), { number: 7, title: "B" });

    expect(await getLastOrderNos({ novel_id: "novel-1" })).toEqual({ volume: 7, chapter: 0 });
  });

  it("returns the highest chapter number for a volume_id, via the denormalized volume_id field", async () => {
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "v1", "chapters", "c1"),
      { number: 4, title: "A", volume_id: "v1", novel_id: "novel-1" },
    );
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "v1", "chapters", "c2"),
      { number: 9, title: "B", volume_id: "v1", novel_id: "novel-1" },
    );

    expect(await getLastOrderNos({ volume_id: "v1" })).toEqual({ volume: 0, chapter: 9 });
  });

  it("returns both when both params are given", async () => {
    await setDoc(doc(db, "novels", "novel-1", "volumes", "v1"), { number: 2, title: "A" });
    await setDoc(
      doc(db, "novels", "novel-1", "volumes", "v1", "chapters", "c1"),
      { number: 5, title: "X", volume_id: "v1", novel_id: "novel-1" },
    );

    expect(await getLastOrderNos({ novel_id: "novel-1", volume_id: "v1" })).toEqual({
      volume: 2,
      chapter: 5,
    });
  });
});
