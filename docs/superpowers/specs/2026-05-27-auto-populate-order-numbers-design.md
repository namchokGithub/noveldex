# Auto-populate Order Numbers in Volume/Chapter Forms

**Date:** 2026-05-27  
**Status:** Approved

---

## Goal

Auto-fill the `number` field in `AddVolumeForm` and `AddChapterForm` with the next suggested order number (last + 1) using the existing `GET /api/v1/master/last-order-nos` endpoint. User retains full manual override capability.

---

## Architecture

**Trigger:** Fetch fires on button click (lazy), not on page mount. Fresh data at moment of use; zero cost if form never opened.

**Approach:** Inline state in each form component — no shared hook, no prop drilling. The two forms have different params (`novel_id` vs `volume_id`) and different response fields (`volume` vs `chapter`), so a shared abstraction saves nothing.

---

## Changes

### 1. `libs/api/index.ts`

Add type and two new functions:

```ts
export interface LastOrderNos {
  volume: number;
  chapter: number;
}

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

interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  read_at?: string | null;
}

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

`apiClient.get` already accepts `QueryParams` as second arg — no client.ts changes needed.

### 2. `AddVolumeForm.tsx`

- Add `nextNumber: number | null` and `fetchingNumber: boolean` state.
- Replace `onClick={() => setOpen(true)}` with `handleOpenForm`:
  - Set `fetchingNumber(true)`.
  - Call `getLastOrderNos({ novel_id: novelId })`.
  - On success: `setNextNumber(nos.volume + 1)`.
  - On error: `setNextNumber(null)` — form opens anyway, user types manually.
  - Always: `setFetchingNumber(false)`, `setOpen(true)`.
- Button shows loading text and is disabled while `fetchingNumber`.
- Number input uses `defaultValue={nextNumber ?? undefined}` (not `value`) so user can freely edit.
- `handleCloseForm` resets `nextNumber` to `null` so re-open always re-fetches.

### 3. `AddChapterForm.tsx`

Same pattern as Volume with two differences:
- Param is `volume_id: volumeId`.
- Uses `nos.chapter + 1`.

Also fixes: replace raw `fetch` with `createChapter` from `libs/api/index.ts` (aligns with codebase convention).

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Fetch succeeds | Input pre-filled with `last + 1` |
| Fetch fails (network/server) | Input empty, `placeholder="1"` shown, user types manually |
| API returns 0 (no entries yet) | Input pre-filled with `1` |

No error toast for the pre-fill fetch failure — silent fallback keeps UX smooth for a non-critical enhancement.

---

## What Does NOT Change

- Confirm dialog flow
- Snackbar feedback on create success/error
- Form validation (`required`, `min={1}`)
- Submit logic (aside from `AddChapterForm` using `createChapter` instead of raw fetch)
- `router.refresh()` on success
