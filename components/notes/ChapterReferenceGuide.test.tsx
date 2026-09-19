import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import ChapterReferenceGuide from "./ChapterReferenceGuide";

it("shows typed keyword syntax and the matching reference colors", () => {
  const markup = renderToStaticMarkup(<ChapterReferenceGuide defaultOpen />);

  expect(markup).toContain("[[Rimuru]]");
  expect(markup).toContain("[[location:Tempest]]");
  expect(markup).toContain("#047857");
  expect(markup).toContain("#7C3AED");
});
