import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { I18nProvider } from "@/components/i18n/I18nProvider";
import VolumeOverview from "./VolumeOverview";

it("omits the chapters summary card", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <VolumeOverview
        novelId="novel-1"
        chapters={[]}
        events={[]}
        adaptations={[]}
      />
    </I18nProvider>,
  );

  expect(markup).not.toContain("Chapters");
  expect(markup).toContain("Notes");
});
