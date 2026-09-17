import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import NovelCover from "./NovelCover";

it("shows the complete image when the contain fit is requested", () => {
  const markup = renderToStaticMarkup(
    <NovelCover
      title="A novel"
      coverUrl="https://example.com/cover.jpg"
      fit="contain"
    />,
  );

  expect(markup).toContain("object-contain");
});
