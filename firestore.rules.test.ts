import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, increment, setDoc, updateDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-noveldex",
    firestore: {
      host: "127.0.0.1",
      port: 8081,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("firestore.rules", () => {
  it("lets a guest (unauthenticated) read", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(guestDb, "novels/n1")));
  });

  it("blocks a guest (unauthenticated) write", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(guestDb, "novels/n1"), { title: "Guest Novel" }),
    );
  });

  it("lets an authenticated user write", async () => {
    const authedDb = testEnv.authenticatedContext("test-uid").firestore();

    await assertSucceeds(
      setDoc(doc(authedDb, "novels/n1"), { title: "Authed Novel" }),
    );
  });

  it("lets an authenticated user update denormalized parent counters", async () => {
    const authedDb = testEnv.authenticatedContext("test-uid").firestore();
    const novel = doc(authedDb, "novels/n1");
    const volume = doc(authedDb, "novels/n1/volumes/v1");
    await assertSucceeds(setDoc(novel, { chapter_count: 0, read_count: 0 }));
    await assertSucceeds(setDoc(volume, { chapter_count: 0, read_count: 0 }));

    await assertSucceeds(
      updateDoc(novel, {
        chapter_count: increment(1),
        read_count: increment(1),
      }),
    );
    await assertSucceeds(
      updateDoc(volume, {
        chapter_count: increment(1),
        read_count: increment(1),
      }),
    );
  });
});
