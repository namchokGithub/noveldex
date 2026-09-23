import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const detailSource = readFileSync(
  resolve(import.meta.dirname, "CharacterDetail.tsx"),
  "utf8",
);
const editorSource = readFileSync(
  resolve(
    import.meta.dirname,
    "../../../../../components/notes/RichNoteEditor.tsx",
  ),
  "utf8",
);
const gallerySource = readFileSync(
  resolve(import.meta.dirname, "CharacterGallery.tsx"),
  "utf8",
);

describe("character profile rich sections", () => {
  it("renders and saves appearance, personality, and trivia on the detail page", () => {
    expect(detailSource).toContain('t("character.appearance")');
    expect(detailSource).toContain('t("character.personality")');
    expect(detailSource).toContain('t("character.trivia")');
    expect(detailSource).toContain("appearance_content_json");
    expect(detailSource).toContain("personality_content_json");
    expect(detailSource).toContain("trivia_content_json");
  });

  it("supports disabling entity references for profile editors", () => {
    expect(editorSource).toContain("enableEntityReferences = true");
    expect(detailSource).toContain("enableEntityReferences={false}");
  });

  it("renders the optional character design data groups", () => {
    expect(detailSource).toContain("biographical_and_biological");
    expect(detailSource).toContain('label: "Social"');
    expect(detailSource).toContain('label: "Debut"');
    expect(detailSource).toContain("data={designData}");
  });

  it("renders and saves the character gallery separately from profile data", () => {
    expect(detailSource).toContain("CharacterGallery");
    expect(detailSource).toContain("gallery={gallery}");
    expect(detailSource).toContain("canEdit={isAdmin}");
    expect(detailSource).toContain("updateCharacterGallery");
  });

  it("keeps image edits separate while batching only gallery rearrangement", () => {
    expect(gallerySource).toContain("Save image");
    expect(gallerySource).toContain("Save order");
    expect(gallerySource).toContain("Add image");
  });

  it("centers the selected gallery image and provides carousel controls", () => {
    expect(gallerySource).toContain("activeImageId");
    expect(gallerySource).toContain("ChevronLeft");
    expect(gallerySource).toContain("Previous image");
    expect(gallerySource).toContain("Next image");
  });

  it("opens gallery images in an accessible preview modal", () => {
    expect(gallerySource).toContain("GalleryImagePreviewModal");
    expect(gallerySource).toContain("View full image");
    expect(gallerySource).toContain("onClose");
  });
});
