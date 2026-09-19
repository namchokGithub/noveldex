import { describe, expect, it, vi } from "vitest";
import { startSearchIndexOnce } from "./SearchIndexProvider";

describe("startSearchIndexOnce", () => {
  it("does not load before start and starts the dataset once", () => {
    const load = vi.fn();
    const started = { current: false };

    expect(load).not.toHaveBeenCalled();

    startSearchIndexOnce(started, load);
    startSearchIndexOnce(started, load);

    expect(load).toHaveBeenCalledTimes(1);
  });
});
