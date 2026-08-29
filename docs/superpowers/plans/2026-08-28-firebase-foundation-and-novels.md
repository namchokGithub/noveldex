# Firebase Foundation + Novels Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Firestore client SDK foundation (config, security rules, shared write/read helpers, emulator-backed test harness) and migrate the `novels` domain (list, get, create) off the Go API onto direct Firestore calls — the first working, shippable slice of the full Firebase migration.

**Architecture:** `apps/web` keeps its existing Next.js Server Component (reads) + Client Component (writes) structure unchanged. `apps/web/libs/api/index.ts` keeps its exported function names and signatures; only the *implementation* of the novels functions moves from `fetch()` against the Go API to the Firestore client SDK (`firebase/firestore`), called directly — no Cloud Functions, no Server Actions, no Admin SDK. All other domains (volumes, chapters, characters, events, tags) keep calling the Go API until their own follow-up plans land — the Go API stays running throughout this plan.

**Tech Stack:** Firebase JS SDK v11 (`firebase/app`, `firebase/firestore`), Firebase Local Emulator Suite (`firebase-tools`), Vitest for tests.

**Spec:** `docs/superpowers/specs/2026-08-28-firebase-migration-design.md`

## Global Constraints

- Firestore document fields use **snake_case**, matching the existing TS interfaces in `apps/web/app/types.ts` exactly (`created_at`, `cover_url`, etc.) — this finalizes the spec's data-model section, which used camelCase only as illustration.
- No Cloud Functions, no Next.js Server Actions, no Firebase Admin SDK anywhere in `apps/web` — only the `firebase` client package, invoked the same way whether the call happens in a Server Component or a Client Component.
- Firestore security rules stay fully open (`allow read, write: if true`) for this whole migration, per ADR-003 (no auth until Phase 5). **This must be revisited when Phase 5 lands** — do not treat the open rule as permanent.
- `libs/api/index.ts` re-exports each domain's Firestore-backed functions under their original names; page/component call sites outside `libs/api` are not touched unless a task explicitly says so.
- `apps/web` production deploys to Vercel's Node serverless runtime, which is known to break the Firestore SDK's default streaming transport — Firestore must be initialized with `experimentalAutoDetectLongPolling: true`.
- No feature parity beyond what the web UI actually calls today. The Go API exposes `PATCH`/`DELETE /api/v1/novels/:id`, but no UI calls them (confirmed by repo-wide search) — this plan does not port them. Add them in a later plan only if a UI need appears.

---

## Task 1: Firebase project config, security rules, emulator wiring

**Files:**
- Create: `apps/web/firebase.json`
- Create: `apps/web/firestore.rules`
- Create: `apps/web/firestore.indexes.json`
- Modify: `apps/web/.env.local.example`
- Modify: `apps/web/package.json` (add `firebase` dependency, `firebase-tools` devDependency, `emulators` script)
- Modify: `Makefile` (add `firebase-emulators` target)

**Interfaces:**
- Produces: a running Firestore emulator on `127.0.0.1:8081` for project id `demo-noveldex`, reachable by every later task's tests. (Port 8081, not the Firestore emulator default 8080 — the Go API defaults to `PORT=8080` and stays running throughout this plan; colliding with it would block `make dev` + `make firebase-emulators` running together.)

- [ ] **Step 1: Add Firebase config files**

`apps/web/firebase.json`:

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "emulators": {
    "firestore": {
      "port": 8081
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
}
```

`apps/web/firestore.rules`:

```
rules_version = '2';

// Open rules for as long as ADR-003 (no auth until Phase 5) holds.
// When Phase 5 auth lands, replace `if true` with authenticated checks —
// do not ship these open rules to a public production project past that point.
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

`apps/web/firestore.indexes.json`:

```json
{
  "indexes": [],
  "fieldOverrides": []
}
```

- [ ] **Step 2: Add Firebase env vars**

Append to `apps/web/.env.local.example` (keep the existing `NEXT_PUBLIC_API_URL` line — other domains still need it until later plans):

```
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
```

- [ ] **Step 3: Install Firebase packages**

Run: `cd apps/web && pnpm add firebase && pnpm add -D firebase-tools vitest`
Expected: `apps/web/package.json` gains `firebase` under `dependencies` and `firebase-tools`, `vitest` under `devDependencies`.

- [ ] **Step 4: Add package.json scripts**

Modify `apps/web/package.json` scripts block to:

```json
{
  "scripts": {
    "dev": "concurrently \"next dev\" \"wait-on http://localhost:3000 && bash ./scripts/open-dev-url.sh http://localhost:3000\"",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "test": "vitest run",
    "test:watch": "vitest",
    "emulators": "firebase emulators:start --only firestore --project demo-noveldex"
  }
}
```

- [ ] **Step 5: Add a Makefile convenience target**

Modify `Makefile` — add to the `.PHONY` line and append a target:

```makefile
.PHONY: dev api web migrate-up migrate-down migrate-create db db-backup db-restore db-backups logs firebase-emulators

firebase-emulators:
	cd apps/web && pnpm run emulators
```

- [ ] **Step 6: Verify the emulator starts**

Run: `make firebase-emulators` (leave running), then in another terminal: `curl -s http://127.0.0.1:4000 -o /dev/null -w "%{http_code}\n"`
Expected: `200`. Stop the emulator (Ctrl+C) before continuing.

- [ ] **Step 7: Commit**

```bash
git add apps/web/firebase.json apps/web/firestore.rules apps/web/firestore.indexes.json apps/web/.env.local.example apps/web/package.json apps/web/pnpm-lock.yaml Makefile
git commit -m "feat(web): add Firebase project config and emulator wiring"
```

---

## Task 2: Firestore client bootstrap, shared helpers, test harness

**Files:**
- Create: `apps/web/libs/firebase/app.ts`
- Create: `apps/web/libs/firebase/helpers.ts`
- Create: `apps/web/libs/firebase/testUtils.ts`
- Create: `apps/web/libs/firebase/app.test.ts`
- Create: `apps/web/vitest.config.ts`

**Interfaces:**
- Consumes: none (this is the base layer).
- Produces: `db: Firestore` (from `./app`), `withCreateTimestamps<T>(data: T)`, `withUpdateTimestamp<T>(data: T)`, `tsToIso(value): string` (from `./helpers`), `useEmulator(): void`, `clearFirestoreEmulator(): Promise<void>` (from `./testUtils`, test-only — never imported by production code).

- [ ] **Step 1: Write the Firestore bootstrap**

`apps/web/libs/firebase/app.ts`:

```ts
import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getFirestore, initializeFirestore, type Firestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "demo-noveldex",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
};

function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
}

function initDb(): Firestore {
  const app = getFirebaseApp();
  try {
    // Vercel's Node serverless runtime breaks Firestore's default gRPC-style
    // streaming transport; long polling is the documented workaround.
    return initializeFirestore(app, {
      experimentalAutoDetectLongPolling: true,
      useFetchStreams: false,
    });
  } catch {
    // Already initialized (e.g. Next.js dev server hot reload) — reuse it.
    return getFirestore(app);
  }
}

export const db: Firestore = initDb();
```

- [ ] **Step 2: Write shared write/read helpers**

`apps/web/libs/firebase/helpers.ts`:

```ts
import { serverTimestamp, Timestamp, type FieldValue } from "firebase/firestore";

export function tsToIso(value: Timestamp | FieldValue | null | undefined): string {
  return value instanceof Timestamp ? value.toDate().toISOString() : "";
}

export function withCreateTimestamps<T extends Record<string, unknown>>(
  data: T,
): T & { created_at: FieldValue; updated_at: FieldValue } {
  return { ...data, created_at: serverTimestamp(), updated_at: serverTimestamp() };
}

export function withUpdateTimestamp<T extends Record<string, unknown>>(
  data: T,
): T & { updated_at: FieldValue } {
  return { ...data, updated_at: serverTimestamp() };
}
```

- [ ] **Step 3: Write the test-only emulator helper**

`apps/web/libs/firebase/testUtils.ts`:

```ts
import { connectFirestoreEmulator } from "firebase/firestore";
import { db } from "./app";

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8081;
const EMULATOR_PROJECT_ID = "demo-noveldex";

let connected = false;

export function useEmulator(): void {
  if (!connected) {
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
    connected = true;
  }
}

export async function clearFirestoreEmulator(): Promise<void> {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/databases/(default)/documents`,
    { method: "DELETE" },
  );
}
```

- [ ] **Step 4: Write the vitest config**

`apps/web/vitest.config.ts`:

```ts
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 5: Write the failing smoke test**

`apps/web/libs/firebase/app.test.ts`:

```ts
import { doc, getDoc, setDoc } from "firebase/firestore";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "./app";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("firestore bootstrap", () => {
  it("writes and reads a document against the emulator", async () => {
    const ref = doc(db, "_smoke_test", "ping");
    await setDoc(ref, { value: "pong" });

    const snapshot = await getDoc(ref);

    expect(snapshot.exists()).toBe(true);
    expect(snapshot.data()).toEqual({ value: "pong" });
  });
});
```

- [ ] **Step 6: Run it to verify it fails without the emulator running**

Run: `cd apps/web && pnpm test app.test.ts`
Expected: FAIL — connection refused / unavailable error, since no emulator is running yet.

- [ ] **Step 7: Start the emulator and run the test again**

Run (separate terminal, leave running): `make firebase-emulators`
Then: `cd apps/web && pnpm test app.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/libs/firebase/app.ts apps/web/libs/firebase/helpers.ts apps/web/libs/firebase/testUtils.ts apps/web/libs/firebase/app.test.ts apps/web/vitest.config.ts apps/web/package.json
git commit -m "feat(web): add Firestore bootstrap, shared helpers, and emulator test harness"
```

---

## Task 3: Novels domain via Firestore

**Files:**
- Create: `apps/web/libs/firebase/novels.ts`
- Create: `apps/web/libs/firebase/novels.test.ts`
- Modify: `apps/web/libs/api/index.ts:46-58` (replace the `getNovels`/`getNovel` implementations with a re-export, add `createNovel`)

**Interfaces:**
- Consumes: `db` (from `./app`), `tsToIso`, `withCreateTimestamps` (from `./helpers`), `useEmulator`/`clearFirestoreEmulator` (from `./testUtils`, tests only), `Novel` type (from `@/app/types`).
- Produces: `getNovels(): Promise<Novel[]>`, `getNovel(novelId: string): Promise<Novel>` (throws `Error` if not found — same contract as today's `apiClient`-backed version), `createNovel(payload: NovelCreatePayload): Promise<Novel>`, `type NovelCreatePayload = { title: string; author: string; status: Novel["status"]; description: string; cover_url: string }`.

- [ ] **Step 1: Write the failing tests**

`apps/web/libs/firebase/novels.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createNovel, getNovel, getNovels } from "./novels";
import { clearFirestoreEmulator, useEmulator } from "./testUtils";

beforeAll(() => {
  useEmulator();
});

beforeEach(async () => {
  await clearFirestoreEmulator();
});

describe("novels", () => {
  it("creates a novel with generated id and ISO timestamps", async () => {
    const novel = await createNovel({
      title: "Test Novel",
      author: "Test Author",
      status: "reading",
      description: "A test novel.",
      cover_url: "",
    });

    expect(novel.id).toBeTruthy();
    expect(novel.title).toBe("Test Novel");
    expect(novel.author).toBe("Test Author");
    expect(novel.status).toBe("reading");
    expect(() => new Date(novel.created_at).toISOString()).not.toThrow();
    expect(novel.created_at).toBe(novel.updated_at);
  });

  it("lists all created novels", async () => {
    await createNovel({ title: "A", author: "", status: "reading", description: "", cover_url: "" });
    await createNovel({ title: "B", author: "", status: "completed", description: "", cover_url: "" });

    const novels = await getNovels();

    expect(novels).toHaveLength(2);
    expect(novels.map((n) => n.title).sort()).toEqual(["A", "B"]);
  });

  it("gets a single novel by id", async () => {
    const created = await createNovel({
      title: "Solo",
      author: "",
      status: "completed",
      description: "",
      cover_url: "",
    });

    const fetched = await getNovel(created.id);

    expect(fetched).toEqual(created);
  });

  it("throws when the novel does not exist", async () => {
    await expect(getNovel("does-not-exist")).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run (with the emulator running from Task 2): `cd apps/web && pnpm test novels.test.ts`
Expected: FAIL with a module-not-found error for `./novels`.

- [ ] **Step 3: Write the implementation**

`apps/web/libs/firebase/novels.ts`:

```ts
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  Timestamp,
} from "firebase/firestore";
import type { Novel } from "@/app/types";
import { db } from "./app";
import { tsToIso, withCreateTimestamps } from "./helpers";

interface NovelDoc {
  title: string;
  author: string;
  status: Novel["status"];
  description: string;
  cover_url: string;
  created_at: Timestamp;
  updated_at: Timestamp;
}

function novelsCol() {
  return collection(db, "novels");
}

function toNovel(id: string, data: NovelDoc): Novel {
  return {
    id,
    title: data.title,
    author: data.author,
    status: data.status,
    description: data.description,
    cover_url: data.cover_url,
    created_at: tsToIso(data.created_at),
    updated_at: tsToIso(data.updated_at),
  };
}

export async function getNovels(): Promise<Novel[]> {
  const snapshot = await getDocs(query(novelsCol(), orderBy("created_at", "desc")));
  return snapshot.docs.map((d) => toNovel(d.id, d.data() as NovelDoc));
}

export async function getNovel(novelId: string): Promise<Novel> {
  const snapshot = await getDoc(doc(db, "novels", novelId));
  if (!snapshot.exists()) {
    throw new Error("Request failed.");
  }
  return toNovel(snapshot.id, snapshot.data() as NovelDoc);
}

export interface NovelCreatePayload {
  title: string;
  author: string;
  status: Novel["status"];
  description: string;
  cover_url: string;
}

export async function createNovel(payload: NovelCreatePayload): Promise<Novel> {
  const ref = await addDoc(novelsCol(), withCreateTimestamps(payload));
  const snapshot = await getDoc(ref);
  return toNovel(snapshot.id, snapshot.data() as NovelDoc);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/web && pnpm test novels.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Wire it into `libs/api/index.ts`**

In `apps/web/libs/api/index.ts`, delete the existing `getNovels`/`getNovel` function bodies (lines 46-58) and replace with:

```ts
export { getNovels, getNovel, createNovel } from "@/libs/firebase/novels";
export type { NovelCreatePayload } from "@/libs/firebase/novels";
```

Place this re-export block at the top of the file, right after the existing imports (before the `LastOrderNos` interface). Leave every other function in the file untouched — they still call `apiClient` against the Go API.

- [ ] **Step 6: Run the full test suite**

Run: `cd apps/web && pnpm test`
Expected: PASS (all tests, including Task 2's smoke test).

- [ ] **Step 7: Run the linter**

Run: `cd apps/web && pnpm lint`
Expected: no errors (unused-import or type errors would show here if the re-export shape is wrong).

- [ ] **Step 8: Commit**

```bash
git add apps/web/libs/firebase/novels.ts apps/web/libs/firebase/novels.test.ts apps/web/libs/api/index.ts
git commit -m "feat(web): migrate novels domain from Go API to Firestore"
```

---

## Task 4: Rewire `AddNovelForm` to call Firestore through `libs/api`

**Files:**
- Modify: `apps/web/app/novels/AddNovelForm.tsx`

**Interfaces:**
- Consumes: `createNovel(payload: NovelCreatePayload): Promise<Novel>` (from `@/libs/api`, produced by Task 3).

- [ ] **Step 1: Replace the inline fetch with `createNovel`**

In `apps/web/app/novels/AddNovelForm.tsx`:

Remove:
```tsx
const BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
```

Add near the top imports:
```tsx
import { createNovel } from '@/libs/api'
import type { Novel } from '@/app/types'
```

Replace the body of `handleSubmit` from:
```tsx
    const data = {
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      author: (form.elements.namedItem('author') as HTMLInputElement).value,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value,
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      cover_url: (form.elements.namedItem('cover_url') as HTMLInputElement).value,
    }

    try {
      const res = await fetch(`${BASE}/api/v1/novels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const message = body.error ?? `Request failed: ${res.status}`
        setError(message)
        setSnackbar({ tone: 'error', message })
        return
      }

      form.reset()
      setOpen(false)
      setSnackbar({ tone: 'success', message: t('addNovel.success') })
      router.refresh()
    } catch {
      const message = t('common.networkError')
      setError(message)
      setSnackbar({ tone: 'error', message })
    } finally {
      setSubmitting(false)
    }
```

to:
```tsx
    const data = {
      title: (form.elements.namedItem('title') as HTMLInputElement).value,
      author: (form.elements.namedItem('author') as HTMLInputElement).value,
      status: (form.elements.namedItem('status') as HTMLSelectElement).value as Novel['status'],
      description: (form.elements.namedItem('description') as HTMLTextAreaElement).value,
      cover_url: (form.elements.namedItem('cover_url') as HTMLInputElement).value,
    }

    try {
      await createNovel(data)

      form.reset()
      setOpen(false)
      setSnackbar({ tone: 'success', message: t('addNovel.success') })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : t('common.networkError')
      setError(message)
      setSnackbar({ tone: 'error', message })
    } finally {
      setSubmitting(false)
    }
```

- [ ] **Step 2: Run the linter and type check**

Run: `cd apps/web && pnpm lint`
Expected: no errors.

- [ ] **Step 3: Manual verification in the browser**

There is no component-testing setup in this repo (no React Testing Library) — verify this by hand:

1. Start the emulator: `make firebase-emulators` (separate terminal)
2. Start the web app: `make web`
3. Open `http://localhost:3000/novels`, click the add-novel button, fill the form, submit
4. Confirm: the success snackbar appears, the modal closes, and the new novel appears in the list without a page reload
5. Open the emulator UI (`http://localhost:4000/firestore`) and confirm a new document exists under the `novels` collection with the submitted fields plus `created_at`/`updated_at`

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/novels/AddNovelForm.tsx
git commit -m "feat(web): create novels through Firestore instead of the Go API"
```

---

## What's Next

This plan covers the foundation and the novels domain only. Follow-up plans (not yet written) will cover, in order:

1. **Volumes + Chapters** — subcollections, the `chapterNumbers` marker-doc uniqueness pattern, batched reorder, `[[Name]]` mention auto-link.
2. **Characters, Character Roles, Tags, Events** — including the denormalized `character_names`/`chapter_title` fields events currently get via JOIN, and rewiring the eight files that call the Go API inline (`AddCharacterForm.tsx`, `CharacterDetail.tsx`, `characters/[characterId]/page.tsx`, `characters/page.tsx`, `novels/[id]/page.tsx`, `timeline/page.tsx`) rather than through `libs/api`.
3. **Data migration script + repo cutover** — one-off Postgres → Firestore migration, retiring `apps/api` from `make dev`, dropping the Redis service, updating `CLAUDE.md` / `docs/ai/CONTEXT.md` / `docs/engineering/DECISIONS.md` / `docs/engineering/PROGRESS.md`.

Search (`SearchPalette.tsx`, `/api/v1/novels/:id/search`) stays on hold per the approved spec — no plan ports it yet.
