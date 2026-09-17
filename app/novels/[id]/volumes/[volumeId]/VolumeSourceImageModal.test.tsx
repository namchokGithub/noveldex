import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { I18nProvider } from "@/components/i18n/I18nProvider";
import VolumeSourceImageModal, { modalImageUrl } from "./VolumeSourceImageModal";

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

it("uses a distinct URL for the full-size modal image", () => {
  expect(
    modalImageUrl(
      "https://static.wikia.nocookie.net/example/images/volume.jpg?cb=123",
    ),
  ).toBe(
    "https://static.wikia.nocookie.net/example/images/volume.jpg?cb=123&view=modal",
  );
});
