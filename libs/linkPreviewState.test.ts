import { expect, it } from "vitest";

import { createLinkPreviewRequestGate } from "./linkPreviewState";

it("invalidates a preview response after its link is cleared", () => {
  const gate = createLinkPreviewRequestGate();
  const request = gate.start();

  gate.clear();

  expect(gate.isCurrent(request)).toBe(false);
});

it("keeps only the most recently requested link preview current", () => {
  const gate = createLinkPreviewRequestGate();
  const first = gate.start();
  const second = gate.start();

  expect(gate.isCurrent(first)).toBe(false);
  expect(gate.isCurrent(second)).toBe(true);
});
