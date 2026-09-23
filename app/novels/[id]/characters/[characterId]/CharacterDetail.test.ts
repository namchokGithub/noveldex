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
    expect(detailSource).toContain("data: designData");
  });
});
