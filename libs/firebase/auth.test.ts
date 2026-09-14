import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auth, signInAdmin, signOutAdmin } from "./auth";
import {
  clearAuthEmulator,
  createTestAdminUser,
  connectAuthTestEmulator,
} from "./testUtils";

beforeAll(() => {
  connectAuthTestEmulator();
});

beforeEach(async () => {
  await clearAuthEmulator();
});

describe("auth", () => {
  it("signs in an existing admin account", async () => {
    await createTestAdminUser("admin@example.com", "correct-horse-battery");

    await signInAdmin("admin@example.com", "correct-horse-battery");

    expect(auth.currentUser?.email).toBe("admin@example.com");
  });

  it("rejects an unknown account", async () => {
    await expect(
      signInAdmin("nobody@example.com", "whatever"),
    ).rejects.toThrow();
  });

  it("signs out the current user", async () => {
    await createTestAdminUser("admin@example.com", "correct-horse-battery");
    await signInAdmin("admin@example.com", "correct-horse-battery");

    await signOutAdmin();

    expect(auth.currentUser).toBeNull();
  });
});
