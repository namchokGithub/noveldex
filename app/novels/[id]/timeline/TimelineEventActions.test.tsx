import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TimelineEventActions } from "./TimelineEventActions";

describe("TimelineEventActions", () => {
  it("shows text Edit and Delete controls to an administrator", () => {
    const markup = renderToStaticMarkup(
      <TimelineEventActions
        isAdmin
        deleting={false}
        editLabel="Edit"
        deleteLabel="Delete"
        onEdit={() => undefined}
        onDelete={() => undefined}
      />,
    );

    expect(markup).toContain(">Edit<");
    expect(markup).toContain(">Delete<");
    expect(markup).not.toContain("✏");
    expect(markup).not.toContain(">×<");
  });

  it("does not render mutation controls to a guest", () => {
    expect(
      renderToStaticMarkup(
        <TimelineEventActions
          isAdmin={false}
          deleting={false}
          editLabel="Edit"
          deleteLabel="Delete"
          onEdit={() => undefined}
          onDelete={() => undefined}
        />,
      ),
    ).toBe("");
  });
});
