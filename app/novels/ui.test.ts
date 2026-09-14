import { expect, it } from "vitest";
import { fullScreenModalBackdropClassName } from "./ui";

it("uses a viewport-wide backdrop for full-screen modals", () => {
  expect(fullScreenModalBackdropClassName).toContain("fixed inset-0");
});
