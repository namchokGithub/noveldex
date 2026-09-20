import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { NovelFlyoutPanel, novelNavigationItems } from "./NovelFlyoutMenu";

it("builds novel-scoped shortcuts from the current novel id", () => {
  expect(novelNavigationItems("novel 1")).toEqual([
    { label: "Home", href: "/novels" },
    { label: "Volume list", href: "/novels/novel%201" },
    { label: "Entities", href: "/novels/novel%201/entities" },
    { label: "Adaptations", href: "/novels/novel%201/adaptations" },
    { label: "Characters", href: "/novels/novel%201/characters" },
    { label: "Timeline", href: "/novels/novel%201/timeline" },
  ]);
});

it("keeps the mobile flyout within the top control width", () => {
  const markup = renderToStaticMarkup(
    <NovelFlyoutPanel items={novelNavigationItems("novel-1")} />,
  );

  expect(markup).toContain("left-3");
  expect(markup).toContain("right-3");
  expect(markup).toContain("w-auto");
  expect(markup).toContain("sm:left-auto");
  expect(markup).toContain("sm:right-0");
  expect(markup).toContain("sm:w-88");
});
