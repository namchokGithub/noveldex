import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryDebouncer } from "./queryDebouncer";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("createQueryDebouncer", () => {
  it("debounces and cancels pending work", () => {
    const callback = vi.fn(); const debouncer = createQueryDebouncer(callback);
    debouncer.handleInput("r"); vi.advanceTimersByTime(100); debouncer.handleInput("ri"); vi.advanceTimersByTime(149);
    expect(callback).not.toHaveBeenCalled(); vi.advanceTimersByTime(1); expect(callback).toHaveBeenCalledWith("ri");
    debouncer.handleInput("rim"); debouncer.cancel(); vi.advanceTimersByTime(150); expect(callback).toHaveBeenCalledTimes(1);
  });
  it("waits for IME composition to finish", () => {
    const callback = vi.fn(); const debouncer = createQueryDebouncer(callback);
    debouncer.handleCompositionStart(); debouncer.handleInput("ริ"); vi.advanceTimersByTime(150); expect(callback).not.toHaveBeenCalled();
    debouncer.handleCompositionEnd("ริมุรุ"); vi.advanceTimersByTime(150); expect(callback).toHaveBeenCalledWith("ริมุรุ");
  });
});
