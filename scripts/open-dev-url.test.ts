import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptPath = fileURLToPath(new URL("./open-dev-url.sh", import.meta.url));

describe("macOS development URL opener", () => {
  it("opens a new tab in an existing Chrome or Safari window", async () => {
    const script = await readFile(scriptPath, "utf8");

    expect(script).toContain('make new tab at end of tabs of front window with properties {URL:"$url"}');
  });
});
