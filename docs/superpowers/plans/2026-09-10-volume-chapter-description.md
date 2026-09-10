# Volume + Chapter Description Field Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional, 500-character `description` field to both `Volume` and `Chapter` in NovelDex, editable only on their respective detail pages.

**Architecture:** Firestore is schemaless, so this is a pure additive field on two existing documents (`novels/{novelId}/volumes/{volumeId}` and `.../chapters/{chapterId}`) plus one new small edit form for volumes (which currently has no edit UI on its detail page) and one new field block inside the existing chapter editor. No new collections, no migration, no index/rules changes.

**Tech Stack:** Next.js 16 App Router, React 19, Firebase Web SDK (`firebase/firestore`), Vitest + Firestore emulator for `libs/firebase` tests.

**Spec:** None — this was classified as a **bounded** change during brainstorming (extends an existing flow in a small, well-scoped way) and the design below was presented in chat and approved by the user directly. No separate spec document was written; this plan is self-contained.

## Global Constraints

- `description` is **optional** on both `Volume` and `Chapter`, max **500 characters**, plain string (no markdown/mentions parsing — unlike chapter `notes[]`, this field does not run `extractMentions`).
- Shown and editable **only on the volume/chapter detail pages** — never on the volumes list (`VolumeManager.tsx`), the chapters list (`ChapterListWithFilters`), or any card view.
- **Not** wired into the Ctrl/Cmd+Shift+K quick search (`components/commands/CommandPalette.tsx`) — that component's scope (title/summary/notes) is unchanged.
- **No** Firestore rules or `firestore.indexes.json` changes — the field is never queried, filtered, or sorted on.
- Missing field on an existing document reads back as `""` (same convention as the legacy `summary`/`notes` fallback) — no backfill script.
- Follow the existing per-field edit pattern already used in `ChapterEditor.tsx`: a `[value, error, saving]` state triple per field, an explicit "Save" button (not save-on-blur), and the shared `Snackbar` component from `app/novels/ui.tsx` for success/error feedback (per `docs/ai/CLAUDE.md` guardrail: "Use `Snackbar` for mutation results").
- `libs/firebase/*.test.ts` tests require the Firestore emulator: run `make firebase-emulators` (or `corepack pnpm run emulators`) in one terminal before `corepack pnpm test` in another.
- Run `corepack pnpm lint` after each task's code changes.
- This repo has no component-level test harness (no React Testing Library/jsdom setup — only `libs/firebase/*.test.ts` against the Firestore emulator exists). UI tasks below are verified with `corepack pnpm build` (type-check) + `corepack pnpm lint` + a manual dev-server check, matching the codebase's existing practice rather than introducing new test infrastructure.

---

### Task 1: Volume domain model — add `description`

**Files:**
- Modify: `libs/firebase/volumes.ts`
- Modify: `app/types.ts:12-21` (`Volume` interface)
- Modify: `libs/api/index.ts:9-10`
- Test: `libs/firebase/volumes.test.ts`

**Interfaces:**
- Produces: `Volume.description: string`, `VolumeCreatePayload { number: number; title: string; description?: string }`, `VolumePayload { number?: number; title?: string; description?: string }` — see step 3 below for the exact shape.

- [ ] **Step 1: Write the failing tests**

Add to `libs/firebase/volumes.test.ts`, inside the existing `describe("volumes", ...)` block (after the `"updates a volume's number and title"` test):

```ts
  it("creates and updates a volume's description, defaulting to an empty string when omitted", async () => {
    const volume = await createVolume("novel-1", {
      number: 1,
      title: "Volume One",
      description: "A quiet arrival.",
    });
    expect(volume.description).toBe("A quiet arrival.");

    const withoutDescription = await createVolume("novel-1", {
      number: 2,
      title: "Volume Two",
    });
    expect(withoutDescription.description).toBe("");

    const updated = await updateVolume("novel-1", volume.id, {
      description: "Revised opening.",
    });
    expect(updated.description).toBe("Revised opening.");
    expect(updated.title).toBe("Volume One");
    expect(updated.number).toBe(1);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- volumes.test.ts`
Expected: FAIL — TypeScript error, `Object literal may only specify known properties, and 'description' does not exist in type 'VolumePayload'.`

- [ ] **Step 3: Implement the minimal change**

In `libs/firebase/volumes.ts`:

1. Add `description?: string;` to `VolumeDoc` (line 22-27):

```ts
interface VolumeDoc {
  number: number;
  title: string;
  description?: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

2. In `toVolume` (line 52-64), default the missing field to `""`:

```ts
async function toVolume(novelId: string, id: string, data: VolumeDoc): Promise<Volume> {
  const { chapter_count, read_count } = await volumeAggregates(novelId, id);
  return {
    id,
    novel_id: novelId,
    number: data.number,
    title: data.title,
    description: data.description ?? "",
    chapter_count,
    read_count,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}
```

3. Replace the single `VolumePayload` interface (line 66-69) with a create/update split, mirroring `ChapterCreatePayload`/`ChapterPayload` in `libs/firebase/chapters.ts:216-222,263-268`:

```ts
export interface VolumeCreatePayload {
  number: number;
  title: string;
  description?: string;
}

export interface VolumePayload {
  number?: number;
  title?: string;
  description?: string;
}
```

4. Change `createVolume`'s parameter type (line 119) from `VolumePayload` to `VolumeCreatePayload`:

```ts
export async function createVolume(novelId: string, payload: VolumeCreatePayload): Promise<Volume> {
```

`updateVolume` (line 125-137) keeps taking `VolumePayload` — no other change needed there, since it already forwards the payload straight into `updateDoc(ref, withUpdateTimestamp(payload))` with no per-field allowlist, so a partial `{ description }` object already works.

In `app/types.ts`, add `description: string` to the `Volume` interface (line 12-21):

```ts
export interface Volume {
  id: string
  novel_id: string
  number: number
  title: string
  description: string
  chapter_count: number
  read_count: number
  created_at: string
  updated_at: string
}
```

In `libs/api/index.ts`, export the new type alongside the existing one (line 9-10):

```ts
// Volumes domain via Firestore
export { getVolumes, getVolume, createVolume, updateVolume, deleteVolume } from "@/libs/firebase/volumes";
export type { VolumePayload, VolumeCreatePayload } from "@/libs/firebase/volumes";
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `corepack pnpm test -- volumes.test.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors. (`corepack pnpm build` will surface any remaining call site that passed an incompatible object to `createVolume`/`updateVolume` — per this plan's research, `app/novels/[id]/AddVolumeForm.tsx:71` and `app/novels/[id]/VolumeManager.tsx:107` both already pass `{ number, title }`, which stays valid against the new types unchanged.)

- [ ] **Step 6: Commit**

```bash
git add libs/firebase/volumes.ts libs/firebase/volumes.test.ts app/types.ts libs/api/index.ts
git commit -m "$(cat <<'EOF'
feat(volumes): add optional description field

EOF
)"
```

---

### Task 2: Volume UI — description editor on the volume detail page

**Files:**
- Create: `app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/page.tsx`
- Modify: `locales/en.ts`
- Modify: `locales/th.ts`

**Interfaces:**
- Consumes: `updateVolume(novelId: string, volumeId: string, payload: VolumePayload): Promise<Volume>` from Task 1; `Volume.description: string` from Task 1; `cardClassName`, `primaryButtonClassName`, `Snackbar`, `smallLabelClassName`, `textareaClassName` from `app/novels/ui.tsx` (`textareaClassName` already exists at `app/novels/ui.tsx:43`, no change needed there).
- Produces: `VolumeDescriptionEditor` component, default export, props `{ novelId: string; volumeId: string; initialDescription: string }`.

- [ ] **Step 1: Add locale keys**

In `locales/en.ts`, insert this new block right after the `"volumeManager.notFound"` line (end of the `volumeManager.*` block, before the blank line that precedes `"chapter.filters.tags"`):

```ts
  "volumeManager.notFound": "Volume not found.",

  "volume.descriptionPlaceholder": "Short volume description",
  "volume.saveDescription": "Save description",
  "volume.descriptionSaved": "Description saved successfully.",

  "chapter.filters.tags": "Tags:",
```

In `locales/th.ts`, insert the matching block in the same position:

```ts
  "volumeManager.notFound": "ไม่พบเล่มนี้",

  "volume.descriptionPlaceholder": "คำอธิบายสั้น ๆ ของเล่มนี้",
  "volume.saveDescription": "บันทึกคำอธิบาย",
  "volume.descriptionSaved": "บันทึกคำอธิบายสำเร็จ",

  "chapter.filters.tags": "แท็ก:",
```

(Check the exact existing text of the `"volumeManager.notFound"` and `"chapter.filters.tags"` lines in each file before editing — reuse them verbatim as the anchor, only inserting the three new lines between them.)

- [ ] **Step 2: Create the component**

Create `app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  cardClassName,
  primaryButtonClassName,
  Snackbar,
  smallLabelClassName,
  textareaClassName,
} from "@/app/novels/ui";
import { useI18n } from "@/components/i18n/I18nProvider";
import { updateVolume } from "@/libs/api";

const MAX_LENGTH = 500;

export default function VolumeDescriptionEditor({
  novelId,
  volumeId,
  initialDescription,
}: {
  novelId: string;
  volumeId: string;
  initialDescription: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const [description, setDescription] = useState(initialDescription);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!snackbar) return;
    const timeoutId = window.setTimeout(() => setSnackbar(null), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [snackbar]);

  async function saveDescription() {
    setError(null);
    setSaving(true);
    try {
      await updateVolume(novelId, volumeId, { description });
      setSnackbar({ tone: "success", message: t("volume.descriptionSaved") });
      router.refresh();
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : t("common.networkError");
      setError(message);
      setSnackbar({ tone: "error", message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cardClassName}>
      <label className={smallLabelClassName}>{t("common.description")}</label>
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value.slice(0, MAX_LENGTH))}
        maxLength={MAX_LENGTH}
        rows={4}
        className={textareaClassName}
        placeholder={t("volume.descriptionPlaceholder")}
      />
      <div className="mt-1 flex justify-end">
        <p className="text-xs text-stone-400">
          {description.length}/{MAX_LENGTH}
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      <div className="mt-2 flex justify-end">
        <button
          onClick={saveDescription}
          disabled={saving}
          className={primaryButtonClassName}
        >
          {saving ? t("common.saving") : t("volume.saveDescription")}
        </button>
      </div>

      <Snackbar
        open={Boolean(snackbar)}
        tone={snackbar?.tone}
        message={snackbar?.message}
        onClose={() => setSnackbar(null)}
        closeLabel={t("common.ok")}
      />
    </div>
  );
}
```

- [ ] **Step 3: Wire it into the volume detail page**

In `app/novels/[id]/volumes/[volumeId]/page.tsx`, add the import:

```tsx
import VolumeDescriptionEditor from "./VolumeDescriptionEditor";
```

Then render it right after the `SectionHeading` block and before the "Chapters" count card (i.e. right after the closing `/>` of `<SectionHeading ... />` and before `<div className={cardClassName}>` that shows the chapter count):

```tsx
        <SectionHeading
          eyebrow={`Volume ${volume.number}`}
          title={volume.title}
          description={`Manage chapters inside this volume. Updated ${formatDisplayDate(volume.updated_at) ?? volume.updated_at}.`}
          action={<AddChapterForm novelId={id} volumeId={volume.id} />}
        />

        <VolumeDescriptionEditor
          novelId={id}
          volumeId={volume.id}
          initialDescription={volume.description}
        />

        <div className={cardClassName}>
```

- [ ] **Step 4: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

Then, with `make firebase-emulators` and `corepack pnpm dev` running, manually:
1. Open a novel → a volume detail page (`/novels/{id}/volumes/{volumeId}`).
2. Confirm a "Description" textarea appears below the volume header, above the chapter count.
3. Type a description, click "Save description" — confirm a success Snackbar appears.
4. Reload the page — confirm the description persisted.
5. Confirm the description does **not** appear on the novel's volume list (`/novels/{id}`) or in the Ctrl/Cmd+Shift+K quick search results.

- [ ] **Step 5: Commit**

```bash
git add "app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx" "app/novels/[id]/volumes/[volumeId]/page.tsx" locales/en.ts locales/th.ts
git commit -m "$(cat <<'EOF'
feat(volumes): edit volume description on the volume detail page

EOF
)"
```

---

### Task 3: Chapter domain model — add `description`

**Files:**
- Modify: `libs/firebase/chapters.ts`
- Modify: `app/types.ts:48-59` (`Chapter` interface)
- Test: `libs/firebase/chapters.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1/2 (independent domain).
- Produces: `Chapter.description: string`, `ChapterCreatePayload.description?: string`, `ChapterPayload.description?: string` — consumed by Task 4.

- [ ] **Step 1: Write the failing test**

Add to `libs/firebase/chapters.test.ts`, inside `describe("chapters", ...)` (after the `"updates a chapter's title/summary/read_at without touching its number"` test):

```ts
  it("creates and updates a chapter's description, defaulting to an empty string when omitted", async () => {
    await seedVolume("novel-1", "vol-1");
    const chapter = await createChapter("novel-1", "vol-1", {
      number: 1,
      title: "One",
      description: "A short recap.",
    });
    expect(chapter.description).toBe("A short recap.");

    const withoutDescription = await createChapter("novel-1", "vol-1", {
      number: 2,
      title: "Two",
    });
    expect(withoutDescription.description).toBe("");

    await updateChapter("novel-1", "vol-1", chapter.id, {
      description: "Revised recap.",
    });
    const fetched = await getChapter("novel-1", "vol-1", chapter.id);
    expect(fetched.description).toBe("Revised recap.");
    expect(fetched.title).toBe("One");
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `corepack pnpm test -- chapters.test.ts`
Expected: FAIL — TypeScript error, `Object literal may only specify known properties, and 'description' does not exist in type 'ChapterCreatePayload'.`

- [ ] **Step 3: Implement the minimal change**

In `libs/firebase/chapters.ts`:

1. Add `description?: string;` to `ChapterDoc` (line 25-40), next to `summary`:

```ts
interface ChapterDoc {
  number: number;
  title: string;
  summary: string;
  description?: string;
  notes?: ChapterNoteDoc[];
  read_at: Timestamp | null;
  novel_id: string;
  volume_id: string;
  tag_ids: string[];
  character_ids: string[];
  character_mention_counts?: Record<string, number>;
  mentioned_character_names?: string[];
  mentioned_character_name_counts?: Record<string, number>;
  created_at: Timestamp;
  updated_at: Timestamp;
}
```

2. In `toChapter` (line 77-92), default the missing field to `""`:

```ts
function toChapter(id: string, data: ChapterDoc, tags: Tag[]): Chapter {
  const notes = notesForChapter(data);
  return {
    id,
    volume_id: data.volume_id,
    number: data.number,
    title: data.title,
    // Keep the legacy field populated for older callers, but make notes canonical.
    summary: notes.map((note) => note.content).join("\n") || data.summary || "",
    description: data.description ?? "",
    notes,
    read_at: data.read_at ? tsToIso(data.read_at) : null,
    tags,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}
```

3. Add `description?: string;` to `ChapterCreatePayload` (line 216-222):

```ts
export interface ChapterCreatePayload {
  number: number;
  title: string;
  summary?: string;
  description?: string;
  notes?: ChapterNote[];
  read_at?: string | null;
}
```

4. In `createChapter` (line 224-261), pass it through in the `tx.set(...)` call (line 240-256):

```ts
    tx.set(
      chapterRefNew,
      withCreateTimestamps({
        number: payload.number,
        title: payload.title,
        summary: payload.summary ?? "",
        description: payload.description ?? "",
        notes: notesToDoc(notes),
        read_at: payload.read_at ? Timestamp.fromDate(new Date(payload.read_at)) : null,
        novel_id: novelId,
        volume_id: volumeId,
        tag_ids: [],
        character_ids: [],
        character_mention_counts: {},
        mentioned_character_names: [],
        mentioned_character_name_counts: {},
      }),
    );
```

5. Add `description?: string;` to `ChapterPayload` (line 263-268):

```ts
export interface ChapterPayload {
  title?: string;
  summary?: string;
  description?: string;
  notes?: ChapterNote[];
  read_at?: string | null;
}
```

6. In `updateChapter` (line 270-330), add one line to the allowlist right after the `summary` line (line 278):

```ts
  const update: Record<string, unknown> = {};
  if (payload.title !== undefined) update.title = payload.title;
  if (payload.summary !== undefined) update.summary = payload.summary;
  if (payload.description !== undefined) update.description = payload.description;
  if (payload.read_at !== undefined) {
```

In `app/types.ts`, add `description: string` to the `Chapter` interface (line 48-59):

```ts
export interface Chapter {
  id: string
  volume_id: string
  number: number
  title: string
  summary: string
  description: string
  notes: ChapterNote[]
  read_at: string | null
  tags: Tag[]
  created_at: string
  updated_at: string
}
```

Note: `ChapterSummary` (line 61-69, used by `getChaptersFlat` for chapter list views and the quick search) is **not** changed — per this plan's scope, `description` is a detail-page-only field and is deliberately excluded from list/summary views and search.

- [ ] **Step 4: Run the test to verify it passes**

Run: `corepack pnpm test -- chapters.test.ts`
Expected: PASS (all tests in the file, including the new one)

- [ ] **Step 5: Type-check and lint**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add libs/firebase/chapters.ts libs/firebase/chapters.test.ts app/types.ts
git commit -m "$(cat <<'EOF'
feat(chapters): add optional description field

EOF
)"
```

---

### Task 4: Chapter UI — description field in the chapter editor

**Files:**
- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx`
- Modify: `locales/en.ts`
- Modify: `locales/th.ts`

**Interfaces:**
- Consumes: `updateChapter(novelId, volumeId, chapterId, payload: ChapterPayload)` and `Chapter.description: string` from Task 3; `textareaClassName` from `app/novels/ui.tsx` (already imported nowhere in this file yet — add to the existing import block).

- [ ] **Step 1: Add locale keys**

In `locales/en.ts`, add `"chapter.saveDescription": "Save description",` immediately after the existing `"chapter.saveSummary": "Save summary",` line, and add `"chapter.descriptionSaved": "Description saved successfully.",` immediately after the existing `"chapter.summarySaved": "Summary saved successfully.",` line. Also add `"chapter.descriptionPlaceholder": "Short chapter description",` immediately after `"chapter.saveDescription"`.

In `locales/th.ts`, add `"chapter.saveDescription": "บันทึกคำอธิบาย",` immediately after the existing `"chapter.saveSummary": "บันทึกสรุป",` line, `"chapter.descriptionPlaceholder": "คำอธิบายสั้น ๆ ของตอนนี้",` right after that, and `"chapter.descriptionSaved": "บันทึกคำอธิบายสำเร็จ",` immediately after the existing `"chapter.summarySaved": "บันทึกสรุปสำเร็จ",` line.

(As in Task 2 Step 1, verify the exact existing anchor lines in each file before editing, then insert only the new lines next to them.)

- [ ] **Step 2: Add the `description` state triple and save handler**

In `ChapterEditor.tsx`, add `textareaClassName` to the existing import from `@/app/novels/ui` (line 7-17):

```tsx
import {
  cardClassName,
  inputClassName,
  normalizeDateTimeLocalToISOString,
  primaryButtonClassName,
  Snackbar,
  secondaryButtonClassName,
  smallLabelClassName,
  tagClassName,
  textareaClassName,
  toDateTimeLocalInputValue,
} from "@/app/novels/ui";
```

Add the state triple right after the existing `summary` triple (line 50-52):

```tsx
  const [summary, setSummary] = useState(chapter.summary ?? "");
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [summarySaving, setSummarySaving] = useState(false);

  const [description, setDescription] = useState(chapter.description ?? "");
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [descriptionSaving, setDescriptionSaving] = useState(false);
```

Add the save handler right after `saveSummary` (line 245-266):

```tsx
  async function saveDescription() {
    setDescriptionError(null);
    setDescriptionSaving(true);
    try {
      await updateChapter(novelId, volumeId, chapter.id, { description });
      setSnackbar({
        tone: "success",
        message: t("chapter.descriptionSaved"),
      });
      router.refresh();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("common.networkError");
      setDescriptionError(message);
      setSnackbar({
        tone: "error",
        message,
      });
    } finally {
      setDescriptionSaving(false);
    }
  }
```

- [ ] **Step 3: Render the description field**

In the JSX (line 325-345), add a new card right after the title card and before the `{showSummary && ...}` summary block:

```tsx
      <div className={cardClassName}>
        <label className={smallLabelClassName}>{t("common.description")}</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          maxLength={500}
          rows={3}
          className={textareaClassName}
          placeholder={t("chapter.descriptionPlaceholder")}
        />
        <div className="mt-1 flex justify-end">
          <p className="text-xs text-stone-400">{description.length}/500</p>
        </div>
        {descriptionError && (
          <p className="mt-2 text-sm text-rose-600">{descriptionError}</p>
        )}
        <div className="mt-2 flex justify-end">
          <button
            onClick={saveDescription}
            disabled={descriptionSaving}
            className={primaryButtonClassName}>
            {descriptionSaving ? t("common.saving") : t("chapter.saveDescription")}
          </button>
        </div>
      </div>

      {showSummary && <div className={cardClassName}>
```

- [ ] **Step 4: Type-check, lint, and manually verify**

Run: `corepack pnpm build && corepack pnpm lint`
Expected: no errors.

Then, with `make firebase-emulators` and `corepack pnpm dev` running, manually:
1. Open a chapter detail page.
2. Confirm a "Description" textarea appears between the title field and the summary/notes field.
3. Type a description, click "Save description" — confirm a success Snackbar appears.
4. Reload the page — confirm the description persisted.
5. Confirm the description does **not** appear on the chapter list page for that volume, and does not show up as a match in the Ctrl/Cmd+Shift+K quick search.

- [ ] **Step 5: Commit**

```bash
git add "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx" locales/en.ts locales/th.ts
git commit -m "$(cat <<'EOF'
feat(chapters): edit chapter description on the chapter detail page

EOF
)"
```

---

### Task 5: Docs — log the shipped feature

**Files:**
- Modify: `docs/_complete_logs.md`
- Modify: `docs/ai/CONTEXT.md`

Per the process guideline added to `docs/ai/AGENTS.md` and `docs/ai/CLAUDE.md` this session ("finishing a change that ships new work — log it, don't leave it undocumented"), record this feature once Tasks 1-4 are merged.

- [ ] **Step 1: Add a completed-work entry**

In `docs/_complete_logs.md`, add a new section near the other Phase 4.6 entries (after the `## Phase 3: Chapter Notes (ships ahead of full-text search)` section, before `## Phase 6: Polish`):

```md
## Phase 4.6: Volume + Chapter Description

- [x] Optional `description` field (max 500 characters) on both `Volume` and `Chapter`, editable only on their detail pages — not shown on list/card views, not part of the Ctrl/Cmd+Shift+K quick search
```

- [ ] **Step 2: Mention the new field in CONTEXT.md**

In `docs/ai/CONTEXT.md`, extend the sentence added earlier this session about `notes[]` (in the "Firestore structure" section) to also mention `description`:

```md
Chapters carry an embedded `notes[]` list (timestamped entries, `[[Name]]` mention tracking, character auto-linking, pagination) — see ADR-008 in `docs/engineering/DECISIONS.md`. The legacy `summary` field is still populated as a join of note content for older callers; do not remove it without a migration. Both volumes and chapters also carry an optional `description` string (max 500 characters), shown only on their detail pages.
```

- [ ] **Step 3: Commit**

```bash
git add docs/_complete_logs.md docs/ai/CONTEXT.md
git commit -m "$(cat <<'EOF'
docs: log volume/chapter description feature

EOF
)"
```
