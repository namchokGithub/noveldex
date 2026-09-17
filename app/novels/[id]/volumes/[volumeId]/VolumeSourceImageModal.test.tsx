import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { I18nProvider } from "@/components/i18n/I18nProvider";
import VolumeSourceImageModal from "./VolumeSourceImageModal";

it("renders an accessible thumbnail button for the volume source image", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <VolumeSourceImageModal
        title="Volume One"
        sourceImgUrl="https://images.example.com/volume-one.jpg"
      />
    </I18nProvider>,
  );

  expect(markup).toContain('aria-label="View source image for Volume One"');
});
