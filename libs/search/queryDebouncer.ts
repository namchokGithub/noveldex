export interface QueryDebouncer {
  handleInput(value: string): void;
  handleCompositionStart(): void;
  handleCompositionEnd(value: string): void;
  cancel(): void;
}

export function createQueryDebouncer(onQuery: (value: string) => void, delayMs = 150): QueryDebouncer {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let composing = false;
  const schedule = (value: string) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => { timeout = null; onQuery(value); }, delayMs);
  };
  return {
    handleInput(value) { if (!composing) schedule(value); },
    handleCompositionStart() { composing = true; if (timeout) { clearTimeout(timeout); timeout = null; } },
    handleCompositionEnd(value) { composing = false; schedule(value); },
    cancel() { if (timeout) { clearTimeout(timeout); timeout = null; } },
  };
}
