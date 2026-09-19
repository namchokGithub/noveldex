import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Select, nextSelectOptionIndex } from "./Select";

describe("Select", () => {
  it("submits its selected value through a hidden form control", () => {
    const markup = renderToStaticMarkup(
      <Select
        name="status"
        defaultValue="reading"
        options={[
          { value: "reading", label: "Reading" },
          { value: "completed", label: "Completed" },
        ]}
      />,
    );

    expect(markup).toContain('name="status"');
    expect(markup).toContain('value="reading"');
    expect(markup).toContain("Reading");
  });

  it("renders the current controlled option", () => {
    const markup = renderToStaticMarkup(
      <Select
        value="10"
        options={[
          { value: "5", label: "5" },
          { value: "10", label: "10" },
        ]}
      />,
    );

    expect(markup).toContain(">10<");
  });

  it("moves between enabled options and wraps with arrow keys", () => {
    const options = [
      { value: "one", label: "One" },
      { value: "two", label: "Two", disabled: true },
      { value: "three", label: "Three" },
    ];

    expect(nextSelectOptionIndex(0, options, "ArrowDown")).toBe(2);
    expect(nextSelectOptionIndex(0, options, "ArrowUp")).toBe(2);
  });
});
