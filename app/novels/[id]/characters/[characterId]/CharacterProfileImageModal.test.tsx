import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { I18nProvider } from "@/components/i18n/I18nProvider";
import CharacterProfileImageModal, {
  modalImageUrl,
} from "./CharacterProfileImageModal";

it("keeps signed image URLs unchanged for the modal", () => {
  const sourceUrl =
    "https://preview.redd.it/rimuru.jpeg?auto=webp&s=9538726216e0b0c5b8765980fc11faa35d9ba0e5";

  expect(modalImageUrl(sourceUrl)).toBe(sourceUrl);
});

it("shows initials without attempting to build a modal URL when no profile image exists", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <CharacterProfileImageModal name="Rimuru Tempest" profileImageUrl={null} />
    </I18nProvider>,
  );

  expect(markup).toContain(">RI<");
});

it("renders an accessible button for viewing a character profile image", () => {
  const markup = renderToStaticMarkup(
    <I18nProvider>
      <CharacterProfileImageModal
        name="Rimuru Tempest"
        profileImageUrl="https://images.example.com/rimuru.jpg"
      />
    </I18nProvider>,
  );

  expect(markup).toContain('aria-label="View profile image for Rimuru Tempest"');
  expect(markup).toContain('src="https://images.example.com/rimuru.jpg"');
});
