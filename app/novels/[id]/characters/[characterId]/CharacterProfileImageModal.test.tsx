import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";

import { I18nProvider } from "@/components/i18n/I18nProvider";
import CharacterProfileImageModal from "./CharacterProfileImageModal";

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
