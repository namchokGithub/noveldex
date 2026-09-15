# Phase 5.1 Adaptations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Track adaptation entries beneath volumes, expose a novel-wide Explore page, and include them in existing client-side search.

**Architecture:** Firestore remains authoritative. Adaptations live under a volume but duplicate `novel_id` and `volume_id` so the novel-wide page and search loader each use one collection-group query. Sort in TypeScript after one read; this avoids a new composite Firestore index. Reuse Timeline interaction patterns, `isAdmin`, `ConfirmDialog`, `Snackbar`, `userErrorMessage`, and SearchIndexProvider mutations.

**Tech Stack:** Next.js App Router, React 19, Firestore Lite, Firebase Auth, TypeScript, Tailwind, Vitest + Firestore emulator.

**Spec:** `docs/engineering/PROGRESS.md` — Phase 5.1: Adaptations.

## Global Constraints

- Runtime is direct Firestore Lite; no API server, Redis, SQL, or new dependencies.
- Reads public; writes require authenticated Firebase Auth user. UI uses `useAuth().isAdmin` only as convenience gate.
- Storage path: `novels/{novelId}/volumes/{volumeId}/adaptations/{adaptationId}`.
- Parent path is source of truth for ownership. Persist `novel_id` and `volume_id` only for collection-group reads/search context; never add `adapted_volume_id`.
- `entry_number` is source number; `sort_order` is manual position inside one medium/group; `group_sort_order` orders groups inside one medium.
- Do not build adaptation notes or chapter mapping in this phase.
- User performs manual visual/UI regression. No browser/E2E, snapshot, or component tests. Keep only focused Firestore/search unit tests below.
- Use `corepack pnpm` commands. Do not alter `.env.local`, production data, or rules’ guest/auth policy.

---

## File Map

| File                                                                       | Responsibility                                                           |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `app/types.ts`                                                             | `Adaptation`, enum unions, mutation payload-facing data                  |
| `libs/adaptations/order.ts`                                                | Pure stable ordering/group helper                                        |
| `libs/firebase/adaptations.ts`                                             | Firestore conversion, validation, CRUD, collection-group reads, reorder  |
| `libs/firebase/adaptations.test.ts`                                        | Minimal emulator coverage for persistence/order/isolation                |
| `libs/firebase/volumes.ts` + test                                          | Explicitly delete adaptation subcollection before deleting volume parent |
| `libs/api/index.ts`                                                        | Compatibility exports                                                    |
| `app/novels/[id]/adaptations/page.tsx`                                     | Server shell and data bootstrap for novel-wide route                     |
| `app/novels/[id]/adaptations/AdaptationTimeline.tsx`                       | Client-side grouped list, forms, mutation/search state                   |
| `app/novels/[id]/volumes/[volumeId]/AdaptationSection.tsx`                 | Compact volume-only read section + all-adaptations link                  |
| `app/novels/[id]/volumes/[volumeId]/page.tsx`                              | Loads and renders volume section                                         |
| `app/novels/[id]/page.tsx`                                                 | Adds Explore → Adaptations link                                          |
| `libs/search/types.ts`, `normalize.ts`, `loader.ts`                        | New document type, route, indexed text, one-query loading                |
| `libs/search/normalize.test.ts`                                            | Stable adaptation identity/route/context test                            |
| `components/commands/CommandPalette.tsx`, `locales/en.ts`, `locales/th.ts` | Result label plus UI copy                                                |
| `docs/engineering/PROGRESS.md`, `docs/_complete_logs.md`                   | Move completed Phase 5.1 checklist entries only when shipped             |

## Task 1: Domain Contract and Pure Ordering

**Files:**

- Modify: `app/types.ts`
- Create: `libs/adaptations/order.ts`
- Test: `libs/adaptations/order.test.ts`

**Interfaces:**

```ts
export const ADAPTATION_MEDIA = [
  "anime",
  "manga",
  "movie",
  "ova",
  "special",
  "game",
  "other",
] as const;
export const ADAPTATION_ENTRY_TYPES = [
  "episode",
  "chapter",
  "volume",
  "movie",
  "special",
] as const;
export type AdaptationMedium = (typeof ADAPTATION_MEDIA)[number];
export type AdaptationEntryType = (typeof ADAPTATION_ENTRY_TYPES)[number];

export interface Adaptation {
  id: string;
  novel_id: string;
  volume_id: string;
  medium: AdaptationMedium;
  group_label: string;
  group_sort_order: number;
  entry_type: AdaptationEntryType;
  entry_number: number;
  title: string;
  source_url: string | null;
  source_img_url: string | null;
  description: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export type AdaptationOrderEntry = Pick<Adaptation, "id" | "sort_order">;
export function compareAdaptations(a: Adaptation, b: Adaptation): number;
export function groupAdaptations(adaptations: Adaptation[]): AdaptationGroup[];
```

- [ ] Add the union types, interface, and order-entry type to `app/types.ts`; use `null` only for optional URLs and an empty string for optional description, matching existing client models.
- [ ] Implement `compareAdaptations`: `medium.localeCompare` → `group_sort_order` → `group_label.localeCompare` → `sort_order` → `entry_number` → `id`. `groupAdaptations` must call this comparator and return immutable groups keyed by `medium:group_label:group_sort_order`.
- [ ] Add one pure test: shuffled entries from two groups produce exact group order and entry order. This protects the ordering contract without UI tests.
- [ ] Run: `corepack pnpm exec vitest run libs/adaptations/order.test.ts`.

## Task 2: Firestore Adapter, Validation, and Volume Cascade

**Files:**

- Create: `libs/firebase/adaptations.ts`
- Create: `libs/firebase/adaptations.test.ts`
- Modify: `libs/firebase/volumes.ts`, `libs/firebase/volumes.test.ts`, `libs/api/index.ts`

**Interfaces:**

```ts
export interface AdaptationCreatePayload {
  medium: AdaptationMedium;
  group_label: string;
  group_sort_order: number;
  entry_type: AdaptationEntryType;
  entry_number: number;
  title: string;
  source_url?: string | null;
  source_img_url?: string | null;
  description?: string;
  sort_order?: number;
}
export type AdaptationPayload = Partial<AdaptationCreatePayload>;

export function getAdaptationsByVolume(
  novelId: string,
  volumeId: string,
): Promise<Adaptation[]>;
export function getAdaptationsForNovel(novelId: string): Promise<Adaptation[]>;
export function createAdaptation(
  novelId: string,
  volumeId: string,
  payload: AdaptationCreatePayload,
): Promise<Adaptation>;
export function updateAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
  payload: AdaptationPayload,
): Promise<Adaptation>;
export function deleteAdaptation(
  novelId: string,
  volumeId: string,
  adaptationId: string,
): Promise<void>;
export function reorderAdaptations(
  novelId: string,
  volumeId: string,
  entries: AdaptationOrderEntry[],
): Promise<void>;
```

- [ ] Implement `adaptationsCol`, `adaptationRef`, `AdaptationDoc`, and `toAdaptation`. Write `novel_id`, `volume_id`, all required fields, and `withCreateTimestamps` / `withUpdateTimestamp`.
- [ ] Validate: allowed enum values; trimmed non-empty `title`/`group_label`; positive integers for `group_sort_order`, `entry_number`, and supplied `sort_order`; `description` max 500; optional URL values trim to `null` or must parse via `new URL`.
- [ ] On create without `sort_order`, read the volume’s adaptations once and set `max(sort_order)` within identical `medium + group_label + group_sort_order`, plus one. Reads return `compareAdaptations` output. `getAdaptationsForNovel` uses `collectionGroup(db, "adaptations")` + `where("novel_id", "==", novelId)`, then sorts client-side. No `orderBy`, so no index change.
- [ ] Reorder accepts entries from one volume, validates every id belongs to it, and uses chunked `writeBatch` updates with `updated_at`; do not alter source `entry_number` or group fields.
- [ ] In `deleteVolume`, fetch adaptation docs and delete them in batches before deleting the parent volume. Firestore never cascades subcollections automatically.
- [ ] Add only emulator tests: create writes parent-context fields and auto-position; novel collection-group read excludes another novel and follows comparator; reorder changes only `sort_order`; deleting a volume deletes adaptation documents.
- [ ] Run: `corepack pnpm exec vitest run libs/firebase/adaptations.test.ts libs/firebase/volumes.test.ts`.

## Task 3: Search Projection and Incremental Search Updates

**Files:**

- Modify: `libs/search/types.ts`, `libs/search/normalize.ts`, `libs/search/loader.ts`, `libs/search/normalize.test.ts`
- Modify: `components/commands/CommandPalette.tsx`, `locales/en.ts`, `locales/th.ts`

**Interfaces:**

```ts
// SearchDocumentType adds "adaptation"; SearchDocument adds adaptationId?: string.
export function adaptationRoute(novelId: string, adaptationId: string): string;
export function normalizeAdaptation(
  adaptation: Adaptation,
  volume: VolumeSearchSource | undefined,
): SearchDocument;
```

- [ ] Add `"adaptation"` and optional `adaptationId`. `normalizeAdaptation` identity is `adaptation:${novel_id}:${volume_id}:${id}`; route is `/novels/${novel_id}/adaptations#adaptation-${id}`; `volumeId` is present for scope/cascade support.
- [ ] Put title in `title`, description in `description`, and medium/group/entry metadata plus localized-independent `Volume {number} {title}` context in `content`. Keep empty reference/tag fields through `emptyFields()`.
- [ ] In `loadNovel`, include `getAdaptationsForNovel(novelId)` in existing `Promise.all`, build volume map from already-loaded `getVolumesFlat`, and normalize adaptations. Do not query once per volume.
- [ ] Add `command.resultType.adaptation` EN/TH. Existing command context resolution uses `volumeId`; no new command-palette architecture.
- [ ] Extend `normalize.test.ts` with one adaptation asserting ID, `volumeId`, indexed context/content, and hash route. No palette/component test.
- [ ] Run: `corepack pnpm exec vitest run libs/search/normalize.test.ts libs/search/buildIndex.test.ts libs/search/scope.test.ts`.

## Task 4: Volume Detail Summary and Explore Entry Point

**Files:**

- Create: `app/novels/[id]/volumes/[volumeId]/AdaptationSection.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/page.tsx`, `app/novels/[id]/page.tsx`, `locales/en.ts`, `locales/th.ts`

**Interfaces:**

```ts
export default function AdaptationSection({
  novelId,
  volumeId,
  adaptations,
}: {
  novelId: string;
  volumeId: string;
  adaptations: Adaptation[];
}): JSX.Element;
```

- [ ] Server-load `getAdaptationsByVolume(id, volumeId)` with existing parallel page reads. Pass results to `AdaptationSection`.
- [ ] Render a compact read-only grouped summary. Empty state says no adaptations. Each item shows medium, group label, entry type/number, title, optional source image/link; link footer routes to `/novels/${novelId}/adaptations`.
- [ ] Add Adaptations card to Novel detail Explore beside Characters and Timeline. Use existing card classes and responsive two-column layout; no count query beyond data already needed by the new page.
- [ ] Add EN/TH labels for section title, empty state, view all, media/entry labels, and source link alt text.
- [ ] Manual check only: guest sees section/card; no mutation trigger appears.

## Task 5: Novel-wide Adaptations Page and CRUD

**Files:**

- Create: `app/novels/[id]/adaptations/page.tsx`
- Create: `app/novels/[id]/adaptations/AdaptationTimeline.tsx`
- Create: `app/novels/[id]/adaptations/AdaptationFormFields.tsx`
- Modify: `locales/en.ts`, `locales/th.ts`

**Interfaces:**

```ts
type AdaptationFormState = {
  volume_id: string;
  medium: AdaptationMedium;
  group_label: string;
  group_sort_order: string;
  entry_type: AdaptationEntryType;
  entry_number: string;
  title: string;
  source_url: string;
  source_img_url: string;
  description: string;
  sort_order: string;
};
```

- [ ] `page.tsx` loads `getNovel`, `getVolumesFlat`, and `getAdaptationsForNovel` in parallel; preserves typed not-found handling from other routes. It passes server data to client timeline.
- [ ] Reuse Timeline page state shape: loading not needed after server bootstrap; local items state; add/edit state; one saving/deleting id; `ConfirmDialog`; `Snackbar`; `userErrorMessage`; clear mutation state if auth changes to guest.
- [ ] `AdaptationFormFields` has volume select, enum selects, positive-number fields, title, optional URL/image URL, description, and sort order. `openAdd` defaults volume to first available and sort order to `max + 1` within selected group. Changing group recomputes only default add sort order; editing preserves existing value.
- [ ] Group UI through `groupAdaptations`. Heading includes medium and group label; entry `id="adaptation-${id}"` supports search hash navigation. Show owning localized volume title on every entry. Add image only when `source_img_url` is valid; source link opens safely with `target="_blank" rel="noreferrer"`.
- [ ] Admin sees Add, Edit, Delete and reorder controls; guest sees same read list without controls. Reorder only within one rendered group and calls `reorderAdaptations`; edits move an entry between groups only through normal update.
- [ ] After create/update call `upsert(normalizeAdaptation(saved, volumeById.get(saved.volume_id)))`; after delete call `discard(adaptationSearchId)`. Do not reload the whole MiniSearch index. Refresh local list from returned values; use `router.refresh()` only for server-rendered volume summary coherence.
- [ ] Manual checks only: create, edit to another group/volume, delete confirm/cancel, reorder, search hash navigation, guest view, mobile form.

## Task 6: Closeout and Focused Verification

**Files:**

- Modify: `docs/engineering/PROGRESS.md`, `docs/_complete_logs.md`

- [ ] Run focused non-UI suite:

```bash
corepack pnpm exec vitest run \
  libs/adaptations/order.test.ts \
  libs/firebase/adaptations.test.ts \
  libs/firebase/volumes.test.ts \
  libs/search/normalize.test.ts \
  libs/search/buildIndex.test.ts \
  libs/search/scope.test.ts
corepack pnpm lint
git diff --check
```

- [ ] Do not add or run browser/E2E/component regression tests. User performs manual UI verification from Task 5.
- [ ] After user confirms manual flows, move only shipped Phase 5.1 initial items from `PROGRESS.md` to `_complete_logs.md`. Leave “Later: notes” and “Later: chapter mapping” open.
- [ ] Commit suggested boundary: `feat(adaptations): add volume adaptation tracking and novel timeline`.

## Review Checklist

- Schema fields, ownership, URL behavior, sorting, CRUD, guest UI, Volume summary, Explore route, and search all map to a task above.
- No Firestore index required: novel-wide read filters one collection-group field and sorts client-side.
- No notes/mappings sneak into initial document.
- No placeholder tasks; each produced interface is named above.
