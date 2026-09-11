import { describe, expect, it } from "vitest";
import { shouldVacuum } from "./vacuumSchedule";

describe("shouldVacuum", () => {
  it("waits below the threshold", () => expect(shouldVacuum(5, 1000)).toBe(false));
  it("runs at ten percent", () => expect(shouldVacuum(100, 1000)).toBe(true));
  it("does not run for an empty index", () => expect(shouldVacuum(0, 0)).toBe(false));
});
