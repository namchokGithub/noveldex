import { describe, expect, it } from "vitest";

import {
  fullScreenModalBackdropClassName,
  roleColorClassNames,
} from "./ui";

it("uses a viewport-wide backdrop for full-screen modals", () => {
  expect(fullScreenModalBackdropClassName).toContain("fixed inset-0");
});

describe("roleColorClassNames", () => {
  it("uses the role palette for every supported character role", () => {
    expect(roleColorClassNames).toMatchObject({
      protagonist: "border border-[#93C5FD] bg-[#DBEAFE] text-[#1D4ED8]",
      antagonist: "border border-[#FCA5A5] bg-[#FEE2E2] text-[#B91C1C]",
      main: "border border-[#C4B5FD] bg-[#EDE9FE] text-[#7C3AED]",
      supporting: "border border-[#6EE7B7] bg-[#D1FAE5] text-[#047857]",
      minor: "border border-[#D6D3D1] bg-[#F5F5F4] text-[#57534E]",
    });
  });
});
