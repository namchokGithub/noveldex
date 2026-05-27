# Auto-populate Order Numbers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auto-fill the `number` field in `AddVolumeForm` and `AddChapterForm` with `last + 1` using the existing `GET /api/v1/master/last-order-nos` endpoint, fired on button click with silent fallback to manual entry on error.

**Architecture:** Add `getLastOrderNos` and `createChapter` helpers to the shared API layer, then wire each form to fetch on open, pre-fill via `defaultValue`, and reset on close. `AddChapterForm` also migrates from raw `fetch` to `createChapter` for consistency with the codebase.

**Tech Stack:** TypeScript, React 19, Next.js 16 App Router, `apiClient` from `apps/web/libs/api/client.ts`

**Spec:** `docs/superpowers/specs/2026-05-27-auto-populate-order-numbers-design.md`

---

## File Map

| Action | File | What changes |
|---|---|---|
| Modify | `apps/web/libs/api/index.ts` | Add `LastOrderNos` type, `getLastOrderNos`, `createChapter` |
| Modify | `apps/web/app/novels/[id]/AddVolumeForm.tsx` | Fetch on open, pre-fill number input |
| Modify | `apps/web/app/novels/[id]/AddChapterForm.tsx` | Fetch on open, pre-fill number input, replace raw fetch with `createChapter` |

---

## Task 1: Add API helpers to `libs/api/index.ts`

**Files:**
- Modify: `apps/web/libs/api/index.ts`

- [ ] **Step 1.1: Add `LastOrderNos` type and `getLastOrderNos` function**

Open `apps/web/libs/api/index.ts`. After the existing imports block (lines 1–9), add the type. Then add the function after the last export in the file.

Add the type near the top, after the existing `interface ApiResponse<T>` block:

```ts
export interface LastOrderNos {
  volume: number;
  chapter: number;
}
```

Add the function at the bottom of the file:

```ts
export async function getLastOrderNos(params: {
  novel_id?: string;
  volume_id?: string;
}): Promise<LastOrderNos> {
  const response = await apiClient.get<ApiResponse<LastOrderNos>>(
    "/api/v1/master/last-order-nos",
    params,
  );
  return response.data;
}
```

> Note: `apiClient.get` signature is `(path: string, query?: QueryParams)` — the params object is passed as the second arg directly. No changes to `client.ts` needed.

- [ ] **Step 1.2: Add `ChapterCreatePayload` type and `createChapter` function**

In the same file, add the interface near the existing `ChapterPayload` interface (around line 15):

```ts
interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  read_at?: string | null;
}
```

Add the function at the bottom of the file (after `getLastOrderNos`):

```ts
export async function createChapter(
  novelId: string,
  volumeId: string,
  payload: ChapterCreatePayload,
): Promise<Chapter> {
  const response = await apiClient.post<ApiResponse<Chapter>>(
    `/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
    { body: payload },
  );
  return response.data;
}
```

- [ ] **Step 1.3: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 1.4: Commit**

```bash
git add apps/web/libs/api/index.ts
git commit -m "feat(web/api): add getLastOrderNos and createChapter helpers"
```

---

## Task 2: Auto-populate number in `AddVolumeForm`

**Files:**
- Modify: `apps/web/app/novels/[id]/AddVolumeForm.tsx`

- [ ] **Step 2.1: Add import for `getLastOrderNos`**

At the top of `AddVolumeForm.tsx`, update the `@/libs/api` import:

```ts
import { createVolume, getLastOrderNos } from "@/libs/api";
```

- [ ] **Step 2.2: Add `nextNumber` and `fetchingNumber` state**

Inside the component, after the existing `const [submitting, setSubmitting] = useState(false);` line, add:

```ts
const [nextNumber, setNextNumber] = useState<number | null>(null);
const [fetchingNumber, setFetchingNumber] = useState(false);
```

- [ ] **Step 2.3: Add `handleOpenForm` function**

Replace the inline `onClick={() => setOpen(true)}` pattern by adding a dedicated handler. Add this function after `handleCloseForm`:

```ts
async function handleOpenForm() {
  setFetchingNumber(true);
  try {
    const nos = await getLastOrderNos({ novel_id: novelId });
    setNextNumber(nos.volume + 1);
  } catch {
    setNextNumber(null); // silent fallback — user types manually
  } finally {
    setFetchingNumber(false);
    setOpen(true);
  }
}
```

- [ ] **Step 2.4: Update the trigger button**

Find the button that currently reads:

```tsx
<button
  onClick={() => setOpen(true)}
  className={primaryButtonClassName}>
  {t("addVolume.button")}
</button>
```

Replace it with:

```tsx
<button
  onClick={handleOpenForm}
  disabled={fetchingNumber}
  className={primaryButtonClassName}>
  {fetchingNumber ? t("common.loading") : t("addVolume.button")}
</button>
```

> `t("common.loading")` — verify this key exists in your i18n files. If not, use the string `"Loading…"` as a fallback until the key is added.

- [ ] **Step 2.5: Pre-fill the number input with `defaultValue`**

Find the number input:

```tsx
<input
  name="number"
  type="number"
  min={1}
  required
  className={inputClassName}
  placeholder="1"
/>
```

Replace with:

```tsx
<input
  name="number"
  type="number"
  min={1}
  required
  className={inputClassName}
  defaultValue={nextNumber ?? undefined}
  placeholder="1"
/>
```

> Use `defaultValue`, not `value` — this keeps the input uncontrolled so the user can freely edit it after it's pre-filled.

- [ ] **Step 2.6: Reset `nextNumber` on close**

Find `handleCloseForm`:

```ts
function handleCloseForm() {
  setOpen(false);
  setConfirmOpen(false);
  setDraft(null);
  setError(null);
}
```

Add `setNextNumber(null)`:

```ts
function handleCloseForm() {
  setOpen(false);
  setConfirmOpen(false);
  setDraft(null);
  setError(null);
  setNextNumber(null);
}
```

This ensures re-opening the form always re-fetches fresh data.

- [ ] **Step 2.7: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 2.8: Manual browser verification**

Start the dev stack: `make dev` (from repo root).

Open a novel detail page that has at least one volume. Click "Add Volume". Verify:
- Button shows loading state briefly while fetch fires.
- Modal opens with number input pre-filled to `(last volume number + 1)`.
- You can edit the pre-filled value manually.
- Cancel and re-open — number re-fetches (not stale from previous open).

Also verify: kill the API (`make api` only) and click "Add Volume". Confirm the modal opens with an empty number field (silent fallback, no error toast).

- [ ] **Step 2.9: Commit**

```bash
git add apps/web/app/novels/\[id\]/AddVolumeForm.tsx
git commit -m "feat(web): auto-populate volume number from last order on form open"
```

---

## Task 3: Auto-populate number in `AddChapterForm`

**Files:**
- Modify: `apps/web/app/novels/[id]/AddChapterForm.tsx`

- [ ] **Step 3.1: Update imports**

Replace the current top-of-file constant and add the API imports. Remove the `BASE` constant (raw fetch is being replaced):

```ts
// Remove this line:
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
```

Add to imports:

```ts
import { createChapter, getLastOrderNos } from '@/libs/api'
```

- [ ] **Step 3.2: Add `nextNumber` and `fetchingNumber` state**

After the existing `const [snackbar, setSnackbar] = useState(...)` line, add:

```ts
const [nextNumber, setNextNumber] = useState<number | null>(null)
const [fetchingNumber, setFetchingNumber] = useState(false)
```

- [ ] **Step 3.3: Add `handleOpenForm` function**

Add after the `useEffect` block:

```ts
async function handleOpenForm() {
  setFetchingNumber(true)
  try {
    const nos = await getLastOrderNos({ volume_id: volumeId })
    setNextNumber(nos.chapter + 1)
  } catch {
    setNextNumber(null) // silent fallback — user types manually
  } finally {
    setFetchingNumber(false)
    setOpen(true)
  }
}
```

- [ ] **Step 3.4: Replace `handleSubmit` raw fetch with `createChapter`**

The current `handleSubmit` uses raw `fetch`. Replace the entire `try` block inside `handleSubmit`:

Current:
```ts
try {
  const res = await fetch(
    `${BASE}/api/v1/novels/${novelId}/volumes/${volumeId}/chapters`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }
  )

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const message = body.error ?? `Request failed: ${res.status}`
    setError(message)
    setSnackbar({ tone: 'error', message })
    return
  }

  form.reset()
  setOpen(false)
  setSnackbar({ tone: 'success', message: t('addChapter.success') })
  router.refresh()
} catch {
  const message = t('common.networkError')
  setError(message)
  setSnackbar({ tone: 'error', message })
}
```

Replace with:
```ts
try {
  await createChapter(novelId, volumeId, data)
  form.reset()
  setNextNumber(null)
  setOpen(false)
  setSnackbar({ tone: 'success', message: t('addChapter.success') })
  router.refresh()
} catch (err) {
  const message = err instanceof Error ? err.message : t('common.networkError')
  setError(message)
  setSnackbar({ tone: 'error', message })
}
```

> `createChapter` throws on non-OK responses (via `apiClient` → `request`), so no manual `res.ok` check needed.

- [ ] **Step 3.5: Update the trigger button**

Find:
```tsx
<button onClick={() => setOpen(true)} className={primaryButtonClassName}>
  {t('addChapter.button')}
</button>
```

Replace with:
```tsx
<button
  onClick={handleOpenForm}
  disabled={fetchingNumber}
  className={primaryButtonClassName}
>
  {fetchingNumber ? t('common.loading') : t('addChapter.button')}
</button>
```

- [ ] **Step 3.6: Pre-fill the number input with `defaultValue`**

Find:
```tsx
<input
  name="number"
  type="number"
  min={1}
  required
  className={inputClassName}
  placeholder="1"
/>
```

Replace with:
```tsx
<input
  name="number"
  type="number"
  min={1}
  required
  className={inputClassName}
  defaultValue={nextNumber ?? undefined}
  placeholder="1"
/>
```

- [ ] **Step 3.7: Reset `nextNumber` on cancel/close**

Find the cancel button handler:
```tsx
onClick={() => {
  setOpen(false)
  setError(null)
}}
```

Replace with:
```tsx
onClick={() => {
  setOpen(false)
  setError(null)
  setNextNumber(null)
}}
```

- [ ] **Step 3.8: Type-check**

```bash
cd apps/web && pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3.9: Manual browser verification**

Navigate to a volume page with at least one chapter. Click "Add Chapter". Verify:
- Button shows loading state briefly while fetch fires.
- Modal opens with number input pre-filled to `(last chapter number + 1)`.
- You can edit the pre-filled value manually.
- Cancel and re-open — number re-fetches fresh.
- Submit a chapter with the pre-filled number — chapter created successfully.

Also verify: kill the API and click "Add Chapter". Modal opens with empty number field (silent fallback).

- [ ] **Step 3.10: Commit**

```bash
git add apps/web/app/novels/\[id\]/AddChapterForm.tsx
git commit -m "feat(web): auto-populate chapter number from last order on form open"
```

---

## Self-Review Checklist (completed)

- [x] Spec §API layer → Task 1 covers `getLastOrderNos` + `createChapter`
- [x] Spec §AddVolumeForm → Task 2 covers fetch-on-open, pre-fill, reset, button state
- [x] Spec §AddChapterForm → Task 3 covers same + raw-fetch replacement
- [x] Error handling table: success → pre-fill, failure → silent null, 0 entries → pre-fills 1
- [x] `defaultValue` not `value` — explicitly noted in steps 2.5 and 3.6
- [x] `nextNumber` reset on close — steps 2.6 and 3.7
- [x] Type consistency: `LastOrderNos.volume`, `LastOrderNos.chapter` used consistently across tasks
- [x] `createChapter` defined in Task 1, used in Task 3 — no forward reference issues
