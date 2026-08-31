import { doc, getDoc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("firestore bootstrap", () => {
  it("writes and reads a document against the emulator", async () => {
    const ref = doc(db, "_smoke_test", "ping");
    await setDoc(ref, { value: "pong" });

    const snapshot = await getDoc(ref);

    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()).toEqual({ value: "pong" });
  });
});
