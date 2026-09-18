import { describe, expect, it } from "vitest";
import {
  createRichNoteDocument,
  richNoteDocumentToText,
} from "./document";

describe("rich note documents", () => {
  it("converts legacy plain text into paragraphs without losing reference syntax", () => {
    const document = createRichNoteDocument(
      "Rimuru arrives.\n\n[[location:Tempest]] is safe.",
    );

    expect(document).toEqual({
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Rimuru arrives." }] },
        {
          type: "paragraph",
          content: [
            { type: "text", text: "[[location:Tempest]] is safe." },
          ],
        },
      ],
    });
  });

  it("derives searchable text and preserves entity-reference syntax from formatted content", () => {
    expect(
      richNoteDocumentToText({
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: [
              { type: "text", text: "Meet ", marks: [{ type: "bold" }] },
              {
                type: "entityReference",
                attrs: { entityType: "location", label: "Tempest" },
              },
              { type: "text", text: "." },
            ],
          },
          {
            type: "bulletList",
            content: [
              {
                type: "listItem",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Visit again" }],
                  },
                ],
              },
            ],
          },
        ],
      }),
    ).toBe("Meet [[location:Tempest]].\nVisit again");
  });
});
