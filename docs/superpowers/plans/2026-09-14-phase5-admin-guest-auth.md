# Phase 5: Admin + Guest Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the open Firestore rules with an authenticated-writer model: a signed-in Firebase Auth user has full read/write access, while an unauthenticated guest can view every page but cannot mutate anything.

**Architecture:** Firebase Auth (email/password) client SDK, with no self-registration UI. `isAdmin = user !== null` is intentional: any signed-in Firebase Auth user may write; an unauthenticated guest may not. A React `AuthProvider` exposes `useAuth()`; every existing mutation trigger checks `isAdmin` inline (matching the codebase's existing inline-conditional style, no wrapper component). Firestore rules keep `read: if true` and change `write: if true` to `write: if request.auth != null` — the real enforcement boundary, independent of the UI.

**Tech Stack:** `firebase/auth` (already in the `firebase` dependency, no new runtime dependency), `@firebase/rules-unit-testing` (new devDependency, for rules tests), Vitest against the Firebase emulator suite (Firestore + Auth).

**Spec:** `docs/superpowers/specs/2026-09-14-phase5-admin-guest-auth-design.md`

## Global Constraints

- The intended production writer account is created manually. No sign-up UI ships in the app.
- `isAdmin = user !== null`. Any signed-in Firebase Auth user is intentionally allowed to write; do not add an email allowlist or Firebase custom claims.
- Firestore `read` rule stays `if true` (guest views everything without logging in). Only `write` changes, to `if request.auth != null`.
- No React component test harness exists (no RTL/jsdom). Pure logic gets Vitest tests against the Firebase emulator; every UI change is verified manually in the browser (steps are written into each task).
- UI gating is a UX convenience only — the Firestore rule is what actually blocks a guest write. Never treat hiding a button as sufficient on its own.
- Rollout order matters: build auth infra and every UI gate against the emulator with rules still open, verify gating, then flip `firestore.rules` after all mutation UI work is complete.

---

### Task 1: Firebase Auth client wrapper + emulator wiring

**Files:**

- Modify: `libs/firebase/app.ts` (export the initialized `FirebaseApp` so `auth.ts` can reuse it)
- Create: `libs/firebase/auth.ts`
- Modify: `libs/firebase/testUtils.ts` (add Auth-emulator helpers, mirroring the existing Firestore-emulator ones)
- Test: `libs/firebase/auth.test.ts`
- Modify: `firebase.json` (add the Auth emulator port)
- Modify: `package.json` (`emulators` script starts both emulators)

**Interfaces:**

- Produces: `auth: Auth` (`libs/firebase/auth.ts`), `signInAdmin(email: string, password: string): Promise<void>`, `signOutAdmin(): Promise<void>`.
- Produces (test-only): `useAuthEmulator(): void`, `clearAuthEmulator(): Promise<void>`, `createTestAdminUser(email: string, password: string): Promise<void>` in `libs/firebase/testUtils.ts`.
- Consumed by: Task 2 (`AuthProvider`), Task 3 (`SignInControl`).

- [ ] **Step 1: Export the Firebase app instance from `app.ts`**

`libs/firebase/app.ts:16-19` currently reads:

```ts
function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
}
```

Add one export right after it:

```ts
function getFirebaseApp(): FirebaseApp {
  const existing = getApps();
  return existing.length > 0 ? existing[0] : initializeApp(firebaseConfig);
}

export const firebaseApp: FirebaseApp = getFirebaseApp();
```

`initDb()` below still calls `getFirebaseApp()` itself; since `firebaseApp` evaluates first at module load, `getApps().length > 0` is already true by the time `initDb()` runs, so `initializeApp` still only fires once.

- [ ] **Step 2: Write `libs/firebase/auth.ts`**

```ts
import {
  connectAuthEmulator,
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
} from "firebase/auth";
import { firebaseApp } from "./app";

function initAuth(): Auth {
  const authInstance = getAuth(firebaseApp);

  if (process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === "1") {
    try {
      connectAuthEmulator(authInstance, "http://127.0.0.1:9099", {
        disableWarnings: true,
      });
    } catch {
      // Already connected (e.g. Next.js dev server hot reload) — reuse it.
    }
  }

  return authInstance;
}

export const auth: Auth = initAuth();

export async function signInAdmin(
  email: string,
  password: string,
): Promise<void> {
  await signInWithEmailAndPassword(auth, email, password);
}

export async function signOutAdmin(): Promise<void> {
  await signOut(auth);
}
```

- [ ] **Step 3: Add Auth-emulator test helpers to `testUtils.ts`**

`libs/firebase/testUtils.ts` currently only has Firestore-emulator helpers. Add Auth ones in the same file, same style:

```ts
import { connectFirestoreEmulator } from "firebase/firestore/lite";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { db } from "./app";
import { auth } from "./auth";

const EMULATOR_HOST = "127.0.0.1";
const EMULATOR_PORT = 8081;
const EMULATOR_PROJECT_ID = "demo-noveldex";
const AUTH_EMULATOR_URL = "http://127.0.0.1:9099";

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

let authConnected = false;

export function useAuthEmulator(): void {
  if (!authConnected) {
    connectAuthEmulator(auth, AUTH_EMULATOR_URL, { disableWarnings: true });
    authConnected = true;
  }
}

export async function clearAuthEmulator(): Promise<void> {
  await fetch(
    `${AUTH_EMULATOR_URL}/emulator/v1/projects/${EMULATOR_PROJECT_ID}/accounts`,
    { method: "DELETE" },
  );
}

export async function createTestAdminUser(
  email: string,
  password: string,
): Promise<void> {
  await createUserWithEmailAndPassword(auth, email, password);
}
```

- [ ] **Step 4: Write the failing test**

Create `libs/firebase/auth.test.ts`:

```ts
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { auth, signInAdmin, signOutAdmin } from "./auth";
import {
  clearAuthEmulator,
  createTestAdminUser,
  useAuthEmulator,
} from "./testUtils";

beforeAll(() => {
  useAuthEmulator();
});

beforeEach(async () => {
  await clearAuthEmulator();
});

describe("auth", () => {
  it("signs in an existing admin account", async () => {
    await createTestAdminUser("admin@example.com", "correct-horse-battery");

    await signInAdmin("admin@example.com", "correct-horse-battery");

    expect(auth.currentUser?.email).toBe("admin@example.com");
  });

  it("rejects an unknown account", async () => {
    await expect(
      signInAdmin("nobody@example.com", "whatever"),
    ).rejects.toThrow();
  });

  it("signs out the current user", async () => {
    await createTestAdminUser("admin@example.com", "correct-horse-battery");
    await signInAdmin("admin@example.com", "correct-horse-battery");

    await signOutAdmin();

    expect(auth.currentUser).toBeNull();
  });
});
```

- [ ] **Step 5: Add the Auth emulator to `firebase.json` and the `emulators` script**

`firebase.json` currently:

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

Change the `emulators` block to:

```json
  "emulators": {
    "firestore": {
      "port": 8081
    },
    "auth": {
      "port": 9099
    },
    "ui": {
      "enabled": true,
      "port": 4000
    }
  }
```

In `package.json`, change:

```json
"emulators": "firebase emulators:start --only firestore --project demo-noveldex",
```

to:

```json
"emulators": "firebase emulators:start --only firestore,auth --project demo-noveldex",
```

- [ ] **Step 6: Start the emulators and run the test**

Run: `corepack pnpm emulators` (leave running in a separate terminal), then in this repo: `corepack pnpm test -- libs/firebase/auth.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add libs/firebase/app.ts libs/firebase/auth.ts libs/firebase/testUtils.ts libs/firebase/auth.test.ts firebase.json package.json
git commit -m "$(cat <<'EOF'
feat(auth): add Firebase Auth client wrapper and emulator wiring

EOF
)"
```

---

### Task 2: AuthProvider + useAuth

**Files:**

- Create: `components/auth/AuthProvider.tsx`
- Modify: `app/layout.tsx`

**Interfaces:**

- Consumes: `auth` from Task 1 (`libs/firebase/auth.ts`).
- Produces: `AuthProvider` (React component), `useAuth(): { user: User | null; isAdmin: boolean; loading: boolean }`.
- Consumed by: Task 3 (`SignInControl`) and every task from Task 5 onward, which each read `isAdmin` off `useAuth()` inline at the call site.

- [ ] **Step 1: Write `components/auth/AuthProvider.tsx`**

```tsx
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { auth } from "@/libs/firebase/auth";

interface AuthState {
  user: User | null;
  isAdmin: boolean;
  loading: boolean;
}

const INITIAL_STATE: AuthState = { user: null, isAdmin: false, loading: true };

const AuthContext = createContext<AuthState>(INITIAL_STATE);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(INITIAL_STATE);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setState({ user, isAdmin: user !== null, loading: false });
    });
  }, []);

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
```

- [ ] **Step 2: Mount `AuthProvider` in the root layout**

`app/layout.tsx` currently:

```tsx
import { I18nProvider } from "@/components/i18n/I18nProvider";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import CommandPalette from "@/components/commands/CommandPalette";
import { SearchIndexProvider } from "@/libs/search/SearchIndexProvider";
```

```tsx
<body suppressHydrationWarning className="min-h-full flex flex-col">
  <I18nProvider>
    <SearchIndexProvider>
      <LanguageToggle />
      <CommandPalette />
      {children}
    </SearchIndexProvider>
  </I18nProvider>
</body>
```

Change to:

```tsx
import { AuthProvider } from "@/components/auth/AuthProvider";
import { I18nProvider } from "@/components/i18n/I18nProvider";
import LanguageToggle from "@/components/i18n/LanguageToggle";
import CommandPalette from "@/components/commands/CommandPalette";
import { SearchIndexProvider } from "@/libs/search/SearchIndexProvider";
```

```tsx
<body suppressHydrationWarning className="min-h-full flex flex-col">
  <AuthProvider>
    <I18nProvider>
      <SearchIndexProvider>
        <LanguageToggle />
        <CommandPalette />
        {children}
      </SearchIndexProvider>
    </I18nProvider>
  </AuthProvider>
</body>
```

`AuthProvider` sits outermost so any page — including the sign-in control itself — can read auth state.

- [ ] **Step 3: Manually verify**

Run `corepack pnpm dev` with the Firestore + Auth emulators running. Open the app: no visual change yet (no consumer of `useAuth()` renders anything different). Open the browser console, confirm no errors from the new provider mounting.

- [ ] **Step 4: Commit**

```bash
git add components/auth/AuthProvider.tsx app/layout.tsx
git commit -m "$(cat <<'EOF'
feat(auth): add AuthProvider and useAuth

EOF
)"
```

---

### Task 3: Sign-in UI

**Files:**

- Create: `components/auth/SignInControl.tsx`
- Modify: `components/i18n/LanguageToggle.tsx` (renders `SignInControl` in the existing header bar)
- Modify: `locales/en.ts`, `locales/th.ts` (new `auth.*` keys)

**Interfaces:**

- Consumes: `useAuth`, `signInAdmin`, `signOutAdmin` from Tasks 1-2.
- Produces: nothing consumed by later tasks (leaf UI).

- [ ] **Step 1: Add `auth.*` keys to `locales/en.ts`**

Add after the `"language.*"` block (`locales/en.ts:1-6`):

```ts
  "language.toggleLabel": "Language",

  "auth.signIn": "Sign in",
  "auth.signOut": "Sign out",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.signInError": "Sign-in failed. Check your email and password.",
```

- [ ] **Step 2: Add the matching keys to `locales/th.ts`**

Add after the `"language.*"` block (`locales/th.ts:1-11`), same position:

```ts
  "language.toggleLabel": "ภาษา",

  "auth.signIn": "เข้าสู่ระบบ",
  "auth.signOut": "ออกจากระบบ",
  "auth.email": "อีเมล",
  "auth.password": "รหัสผ่าน",
  "auth.signInError": "เข้าสู่ระบบไม่สำเร็จ ตรวจสอบอีเมลและรหัสผ่าน",
```

`th.ts`'s `Messages` type requires every `en.ts` key to exist here too — skipping this step breaks the TypeScript build.

- [ ] **Step 3: Write `components/auth/SignInControl.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { signInAdmin, signOutAdmin } from "@/libs/firebase/auth";
import {
  ghostButtonClassName,
  inputClassName,
  secondaryButtonClassName,
} from "@/app/novels/ui";

export default function SignInControl() {
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden text-xs text-stone-500 sm:inline">
          {user.email}
        </span>
        <button
          type="button"
          onClick={() => void signOutAdmin()}
          className={ghostButtonClassName}>
          {t("auth.signOut")}
        </button>
      </div>
    );
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await signInAdmin(email, password);
      setOpen(false);
      setEmail("");
      setPassword("");
    } catch {
      setError(t("auth.signInError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={ghostButtonClassName}>
        {t("auth.signIn")}
      </button>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex items-center gap-1.5">
      <input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder={t("auth.email")}
        className={`${inputClassName} w-32 py-1.5 text-sm`}
      />
      <input
        type="password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder={t("auth.password")}
        className={`${inputClassName} w-28 py-1.5 text-sm`}
      />
      <button
        type="submit"
        disabled={submitting}
        className={secondaryButtonClassName}>
        {submitting ? t("common.saving") : t("auth.signIn")}
      </button>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          setError(null);
        }}
        className={ghostButtonClassName}>
        {t("common.cancel")}
      </button>
      {error ? (
        <span role="alert" className="text-xs text-rose-600">
          {error}
        </span>
      ) : null}
    </form>
  );
}
```

- [ ] **Step 4: Render it in the header bar**

`components/i18n/LanguageToggle.tsx` currently:

```tsx
import { secondaryButtonClassName } from '@/app/novels/ui'
import { CommandPaletteTrigger } from '@/components/commands/CommandPalette'

import { useI18n } from './I18nProvider'

export default function LanguageToggle() {
  const { language, setLanguage, t } = useI18n()

  return (
    <div className="flex items-center justify-end gap-1 border-b border-stone-200 bg-white/85 px-4 py-2 backdrop-blur sm:fixed sm:right-4 sm:top-4 sm:z-40 sm:justify-start sm:rounded-full sm:border sm:border-stone-200 sm:border-b-0 sm:p-1 sm:shadow-lg">
      <CommandPaletteTrigger iconOnly />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-stone-200" />
```

Change to:

```tsx
import { secondaryButtonClassName } from '@/app/novels/ui'
import { CommandPaletteTrigger } from '@/components/commands/CommandPalette'
import SignInControl from '@/components/auth/SignInControl'

import { useI18n } from './I18nProvider'

export default function LanguageToggle() {
  const { language, setLanguage, t } = useI18n()

  return (
    <div className="flex items-center justify-end gap-1 border-b border-stone-200 bg-white/85 px-4 py-2 backdrop-blur sm:fixed sm:right-4 sm:top-4 sm:z-40 sm:justify-start sm:rounded-full sm:border sm:border-stone-200 sm:border-b-0 sm:p-1 sm:shadow-lg">
      <SignInControl />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-stone-200" />
      <CommandPaletteTrigger iconOnly />
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-stone-200" />
```

- [ ] **Step 5: Manually verify**

Create a test admin account in the running Auth emulator UI (`http://127.0.0.1:4000/auth`, "Add user"). In the browser: click "Sign in", enter that email/password, submit — the control switches to showing the email + "Sign out". Click "Sign out" — it switches back to the "Sign in" button. Try a wrong password — the inline error message shows and the form stays open.

- [ ] **Step 6: Commit**

```bash
git add components/auth/SignInControl.tsx components/i18n/LanguageToggle.tsx locales/en.ts locales/th.ts
git commit -m "$(cat <<'EOF'
feat(auth): add sign-in/sign-out control to the header bar

EOF
)"
```

---

### Task 4: Gate novel creation UI

**Files:**

- Modify: `app/novels/AddNovelForm.tsx`

**Interfaces:**

- Consumes: `useAuth` from Task 2.

- [ ] **Step 1: Gate the add-novel form before its existing open/closed branch**

`app/novels/AddNovelForm.tsx`: add `useAuth` and read `const { isAdmin } = useAuth();` with the other hooks. Before the component's existing `return`, add:

```tsx
if (!isAdmin) return null;
```

Keep the existing `!open ? button : form` branch unchanged. This matters: changing it to `!open && isAdmin ? button : form` makes a guest fall into—and see—the form branch.

- [ ] **Step 2: Manually verify**

Signed out (guest): the novels page has no add-novel button or modal. Signed in: creating a novel still works.

- [ ] **Step 3: Commit**

```bash
git add app/novels/AddNovelForm.tsx
git commit -m "feat(auth): gate novel creation UI behind authentication"
```

---

### Task 5: Gate volume mutation UI

**Files:**

- Modify: `app/novels/[id]/AddVolumeForm.tsx`
- Modify: `app/novels/[id]/VolumeManager.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx`

**Interfaces:**

- Consumes: `useAuth` from Task 2.

- [ ] **Step 1: Gate the "add volume" trigger**

`app/novels/[id]/AddVolumeForm.tsx:1-18` — add the import and hook:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ghostButtonClassName,
  inputClassName,
  modalBackdropClassName,
  modalPanelClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
  smallLabelClassName,
} from "../ui";
import { createVolume, getLastOrderNos } from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
import { normalizeVolume } from "@/libs/search/normalize";
import { useSearchMutations } from "@/libs/search/SearchIndexProvider";
```

In the component body, add `const { isAdmin } = useAuth();` right after `const { upsert } = useSearchMutations();` (`AddVolumeForm.tsx:32`). Before the existing `return`, add `if (!isAdmin) return null;`.

At the end of the component (`AddVolumeForm.tsx:121-123`), currently:

```tsx
  return (
    <>
      {!open ? (
        <button
          onClick={handleOpenForm}
          disabled={fetchingNumber}
          className={primaryButtonClassName}>
          {fetchingNumber ? t("common.loading") : t("addVolume.button")}
        </button>
      ) : (
```

Keep this `!open ? button : form` branch unchanged. The early return gates both the closed trigger and any already-open form.

- [ ] **Step 2: Gate the per-volume edit/delete triggers**

`app/novels/[id]/VolumeManager.tsx:20-27` — add the imports:

```tsx
import ConfirmDialog from "../ConfirmDialog";
import { deleteVolume, updateVolume } from "@/libs/api";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
```

In the component body, add `const { isAdmin } = useAuth();` right after `const { documents, discardMany, upsert } = useSearchIndex();` (`VolumeManager.tsx:55`).

`VolumeManager.tsx:319-335` currently:

```tsx
<div className="flex shrink-0 items-center gap-2">
  <button
    type="button"
    onClick={() => startEdit(volume)}
    className={ghostButtonClassName}
    aria-label={t("volumeManager.editAria")}>
    {t("volumeManager.edit")}
  </button>
  <button
    type="button"
    onClick={() => requestDelete(volume)}
    disabled={deletingId === volume.id}
    className={dangerIconButtonClassName}
    aria-label={t("volumeManager.deleteAria")}>
    Del
  </button>
</div>
```

Change to:

```tsx
{
  isAdmin ? (
    <div className="flex shrink-0 items-center gap-2">
      <button
        type="button"
        onClick={() => startEdit(volume)}
        className={ghostButtonClassName}
        aria-label={t("volumeManager.editAria")}>
        {t("volumeManager.edit")}
      </button>
      <button
        type="button"
        onClick={() => requestDelete(volume)}
        disabled={deletingId === volume.id}
        className={dangerIconButtonClassName}
        aria-label={t("volumeManager.deleteAria")}>
        Del
      </button>
    </div>
  ) : null}
```

- [ ] **Step 3: Gate the volume description "Edit" trigger**

`app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx:14-16` — add the import:

```tsx
import { updateVolume } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
```

In the component body, add `const { isAdmin } = useAuth();` right after `const router = useRouter();` (`VolumeDescriptionEditor.tsx:33`).

`VolumeDescriptionEditor.tsx:72-76` currently:

```tsx
{
  !editing && (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Change to:

```tsx
{
  !editing && isAdmin && (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

- [ ] **Step 4: Manually verify**

Signed out (guest): open a novel's volume list — no "add volume" button, no per-row Edit/Del buttons, volume detail pages show the description with no Edit button. Signed in (authenticated user): all three controls appear and behave exactly as before.

- [ ] **Step 5: Commit**

```bash
git add app/novels/[id]/AddVolumeForm.tsx app/novels/[id]/VolumeManager.tsx "app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx"
git commit -m "$(cat <<'EOF'
feat(auth): gate volume mutation UI behind admin

EOF
)"
```

---

### Task 6: Gate chapter mutation UI

**Files:**

- Modify: `app/novels/[id]/AddChapterForm.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx`
- Modify: `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterTitleEditor.tsx`
- Modify: `app/novels/[id]/ChapterListWithFilters.tsx`

**Interfaces:**

- Consumes: `useAuth` from Task 2.

- [ ] **Step 1: Gate the "add chapter" trigger**

`app/novels/[id]/AddChapterForm.tsx:16` — add the import:

```tsx
import { createChapter, getLastOrderNos } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
```

In the component body, add `const { isAdmin } = useAuth()` right after `const { entityMap, upsert } = useSearchIndex()` (`AddChapterForm.tsx:33`). Before the existing `return`, add `if (!isAdmin) return null;`.

`AddChapterForm.tsx:103-112` currently:

```tsx
  return (
    <>
      {!open ? (
        <button
          onClick={handleOpenForm}
          disabled={fetchingNumber}
          className={primaryButtonClassName}
        >
          {fetchingNumber ? t('common.loading') : t('addChapter.button')}
        </button>
      ) : (
```

Keep this `!open ? button : form` branch unchanged; the early return gates both states.

- [ ] **Step 2: Gate `ChapterEditor.tsx`'s four "Edit" triggers, the always-open summary editor, and the tag editor**

`ChapterEditor.tsx:40` — add the import:

```tsx
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
```

In the component body, add `const { isAdmin } = useAuth();` right after `const { entityMap, upsert, upsertMany } = useSearchIndex();` (`ChapterEditor.tsx:59`).

Description "Edit" button, `ChapterEditor.tsx:456`, currently:

```tsx
{
  !descriptionEditing && (
    <button
      type="button"
      onClick={() => setDescriptionEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Change to:

```tsx
{
  !descriptionEditing && isAdmin && (
    <button
      type="button"
      onClick={() => setDescriptionEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Summary block, `ChapterEditor.tsx:478-519`, is always in "edit mode" (no view/edit toggle) — replace the unconditional textarea+save with an `isAdmin` branch. Currently:

```tsx
{
  showSummary && (
    <div className={cardClassName}>
      <label className={smallLabelClassName}>{t("addChapter.summary")}</label>
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          onKeyUp={handleKeyUp}
          rows={6}
          className={`${inputClassName} min-h-45 resize-none overflow-hidden`}
          placeholder={t("addChapter.summaryPlaceholder")}
        />
        {suggestion && suggestion.names.length > 0 && (
          <ul className="absolute left-0 top-full z-10 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
            {suggestion.names.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    insertSuggestion(name);
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
                  {name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {summaryError && <FormError>{summaryError}</FormError>}
      <div className="mt-2 flex justify-end">
        <button
          onClick={saveSummary}
          disabled={summarySaving}
          className={primaryButtonClassName}>
          {summarySaving ? t("common.saving") : t("chapter.saveSummary")}
        </button>
      </div>
    </div>
  )}
```

Change to:

```tsx
{
  showSummary && (
    <div className={cardClassName}>
      <label className={smallLabelClassName}>{t("addChapter.summary")}</label>
      {isAdmin ? (
        <>
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              onKeyUp={handleKeyUp}
              rows={6}
              className={`${inputClassName} min-h-45 resize-none overflow-hidden`}
              placeholder={t("addChapter.summaryPlaceholder")}
            />
            {suggestion && suggestion.names.length > 0 && (
              <ul className="absolute left-0 top-full z-10 mt-2 w-full overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-lg">
                {suggestion.names.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertSuggestion(name);
                      }}
                      className="w-full px-3 py-2 text-left text-sm text-stone-700 hover:bg-stone-50">
                      {name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {summaryError && <FormError>{summaryError}</FormError>}
          <div className="mt-2 flex justify-end">
            <button
              onClick={saveSummary}
              disabled={summarySaving}
              className={primaryButtonClassName}>
              {summarySaving ? t("common.saving") : t("chapter.saveSummary")}
            </button>
          </div>
        </>
      ) : (
        <p className="whitespace-pre-wrap wrap-break-word text-sm leading-7 text-stone-700">
          {summary}
        </p>
      )}
    </div>
  )}
```

Read-at "Edit" button, `ChapterEditor.tsx:525`, currently:

```tsx
{
  !readAtEditing && (
    <button
      type="button"
      onClick={() => setReadAtEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Change to:

```tsx
{
  !readAtEditing && isAdmin && (
    <button
      type="button"
      onClick={() => setReadAtEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Entry (kind/number/label) "Edit" button, `ChapterEditor.tsx:540`, currently:

```tsx
{
  !entryEditing && (
    <button
      type="button"
      onClick={() => setEntryEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Change to:

```tsx
{
  !entryEditing && isAdmin && (
    <button
      type="button"
      onClick={() => setEntryEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Tag remove buttons, `ChapterEditor.tsx:563-575`, currently:

```tsx
{
  tags.slice(0, visibleTagCount).map((tag) => (
    <span key={tag.id} data-tag-chip className={tagClassName}>
      {tag.name}
      <button
        type="button"
        onClick={() => handleRemoveTag(tag.id)}
        disabled={tagSaving}
        className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
        aria-label={t("chapter.removeTag", { name: tag.name })}>
        ×
      </button>
    </span>
  ))}
```

Change to:

```tsx
{
  tags.slice(0, visibleTagCount).map((tag) => (
    <span key={tag.id} data-tag-chip className={tagClassName}>
      {tag.name}
      {isAdmin && (
        <button
          type="button"
          onClick={() => handleRemoveTag(tag.id)}
          disabled={tagSaving}
          className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
          aria-label={t("chapter.removeTag", { name: tag.name })}>
          ×
        </button>
      )}
    </span>
  ))}
```

"Add tag" trigger, `ChapterEditor.tsx:588-598`, currently:

```tsx
          {!tagPickerOpen ? (
            <button
              type="button"
              data-add-tag
              onClick={async () => {
                setTagPickerOpen(true);
                await ensureTagListLoaded();
              }}
              className="rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900">
              {t("chapter.addTag")}
            </button>
          ) : (
```

Change to:

```tsx
          {!tagPickerOpen && isAdmin ? (
            <button
              type="button"
              data-add-tag
              onClick={async () => {
                setTagPickerOpen(true);
                await ensureTagListLoaded();
              }}
              className="rounded-full border border-dashed border-stone-300 px-3 py-1.5 text-xs font-medium text-stone-600 hover:border-stone-400 hover:text-stone-900">
              {t("chapter.addTag")}
            </button>
          ) : tagPickerOpen ? (
```

Note the `) : (` on the "open" branch becomes `) : tagPickerOpen ? (` — for a guest, `!tagPickerOpen && isAdmin` is false and `tagPickerOpen` is also false, so neither branch renders (matches `AddNovelForm`'s and other forms' pattern of guest never being able to reach the open state in the first place). Close this new ternary's tail: the existing `)}` that closes the original two-branch ternary now needs a third `: null` — at `ChapterEditor.tsx:683`, currently:

```tsx
            </div>
          )}
          </div>
```

Change to:

```tsx
            </div>
          ) : null}
          </div>
```

Overflow-dialog tag remove buttons, `ChapterEditor.tsx:716-728`, currently:

```tsx
{
  tags.map((tag) => (
    <span key={tag.id} className={tagClassName}>
      {tag.name}
      <button
        type="button"
        onClick={() => handleRemoveTag(tag.id)}
        disabled={tagSaving}
        className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
        aria-label={t("chapter.removeTag", { name: tag.name })}>
        Ã—
      </button>
    </span>
  ))}
```

(`Ã—` is an existing mis-encoded `×` already in this file, unrelated to this change — preserve it verbatim rather than fixing it here.)

Change to:

```tsx
{
  tags.map((tag) => (
    <span key={tag.id} className={tagClassName}>
      {tag.name}
      {isAdmin && (
        <button
          type="button"
          onClick={() => handleRemoveTag(tag.id)}
          disabled={tagSaving}
          className="text-amber-700 hover:text-amber-900 disabled:opacity-50"
          aria-label={t("chapter.removeTag", { name: tag.name })}>
          Ã—
        </button>
      )}
    </span>
  ))}
```

- [ ] **Step 3: Gate `ChapterNotesEditor.tsx`'s add/edit/delete triggers**

`ChapterNotesEditor.tsx:11` — add the import:

```tsx
import { updateChapter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
```

In the component body (`ChapterNotesEditor.tsx:21-22`), add `const { isAdmin } = useAuth()` alongside the other hook calls:

```tsx
const { t } = useI18n();
const router = useRouter();
const labels = useChapterKindLabels();
const { entityMap, upsertMany, discardMany } = useSearchIndex();
const { isAdmin } = useAuth();
```

`ChapterNotesEditor.tsx:53` (the dense one-liner render) currently has three trigger points — the header "Add note" button, the per-note "Edit" button, and the per-note "Delete" button:

```tsx
<div className="mb-4 flex items-center justify-between gap-3">
  <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
    {t("chapter.notes")}
  </h2>
  {editingId === null && (
    <button
      type="button"
      onClick={() => begin()}
      className={secondaryButtonClassName}>
      {t("chapter.addNote")}
    </button>
  )}
</div>
```

Change to:

```tsx
<div className="mb-4 flex items-center justify-between gap-3">
  <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-stone-500">
    {t("chapter.notes")}
  </h2>
  {editingId === null && isAdmin && (
    <button
      type="button"
      onClick={() => begin()}
      className={secondaryButtonClassName}>
      {t("chapter.addNote")}
    </button>
  )}
</div>
```

And, further along the same line:

```tsx
<div className="mt-3 flex justify-end gap-2">
  <button
    type="button"
    onClick={() => begin(note)}
    className={secondaryButtonClassName}>
    {t("common.edit")}
  </button>
  <button
    type="button"
    onClick={() => void remove(note)}
    disabled={saving}
    className={secondaryButtonClassName}>
    {t("common.delete")}
  </button>
</div>
```

Change to:

```tsx
{
  isAdmin && (
    <div className="mt-3 flex justify-end gap-2">
      <button
        type="button"
        onClick={() => begin(note)}
        className={secondaryButtonClassName}>
        {t("common.edit")}
      </button>
      <button
        type="button"
        onClick={() => void remove(note)}
        disabled={saving}
        className={secondaryButtonClassName}>
        {t("common.delete")}
      </button>
    </div>
  )}
```

- [ ] **Step 4: Gate `ChapterTitleEditor.tsx`'s "Edit" trigger**

`ChapterTitleEditor.tsx:9` — add the import:

```tsx
import { updateChapter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { normalizeChapter } from "@/libs/search/normalize";
```

In the component body, add `const { isAdmin } = useAuth();` right after `const { entityMap, upsert } = useSearchIndex();` (`ChapterTitleEditor.tsx:26`).

`ChapterTitleEditor.tsx:56-69` currently:

```tsx
if (!editing) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{title}</span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`${ghostButtonClassName} px-2 py-1 text-sm`}
        aria-label={t("chapter.editTitle")}>
        {t("common.edit")}
      </button>
    </span>
  )}
```

Change to:

```tsx
if (!editing) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span>{title}</span>
      {isAdmin && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`${ghostButtonClassName} px-2 py-1 text-sm`}
          aria-label={t("chapter.editTitle")}>
          {t("common.edit")}
        </button>
      )}
    </span>
  )}
```

- [ ] **Step 5: Gate `ChapterListWithFilters.tsx`'s reorder and delete triggers**

`ChapterListWithFilters.tsx:29` — add the import:

```tsx
import { deleteChapter, reorderChapters, updateChapter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { userErrorMessage } from "@/libs/userErrorMessage";
```

In the component body, add `const { isAdmin } = useAuth();` right after `const { documents, discardMany } = useSearchIndex();` (`ChapterListWithFilters.tsx:114`).

Reorder trigger, `ChapterListWithFilters.tsx:383-455` — the whole non-reorder-mode filter bar currently always renders the "Reorder" button. Currently:

```tsx
<button
  type="button"
  onClick={enterReorderMode}
  className={ghostButtonClassName}>
  {t("chapter.reorder")}
</button>
```

Change to:

```tsx
{
  isAdmin && (
    <button
      type="button"
      onClick={enterReorderMode}
      className={ghostButtonClassName}>
      {t("chapter.reorder")}
    </button>
  )}
```

Delete trigger, `ChapterListWithFilters.tsx:589-598`, currently:

```tsx
<button
  type="button"
  onClick={() => setConfirmChapter(chapter)}
  disabled={deletingId === chapter.id}
  className={dangerIconButtonClassName}
  aria-label={t("chapter.deleteAria", {
    number: chapter.number ?? chapter.kind,
  })}>
  Del
</button>
```

Change to:

```tsx
{
  isAdmin && (
    <button
      type="button"
      onClick={() => setConfirmChapter(chapter)}
      disabled={deletingId === chapter.id}
      className={dangerIconButtonClassName}
      aria-label={t("chapter.deleteAria", {
        number: chapter.number ?? chapter.kind,
      })}>
      Del
    </button>
  )}
```

- [ ] **Step 6: Manually verify**

Signed out (guest): a chapter list shows no "add chapter" button, no reorder button, no per-row delete button; a chapter detail page shows description/summary/date/entry as plain text with no Edit buttons, tags with no × or "add tag", notes with no "Add note"/"Edit"/"Delete", and the title with no Edit button. Signed in (authenticated user): every one of these behaves exactly as before the change.

- [ ] **Step 7: Commit**

```bash
git add app/novels/[id]/AddChapterForm.tsx "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx" "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterNotesEditor.tsx" "app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterTitleEditor.tsx" app/novels/[id]/ChapterListWithFilters.tsx
git commit -m "$(cat <<'EOF'
feat(auth): gate chapter mutation UI behind admin

EOF
)"
```

---

### Task 7: Gate character and entity mutation UI

**Files:**

- Modify: `app/novels/[id]/characters/AddCharacterForm.tsx`
- Modify: `app/novels/[id]/characters/[characterId]/CharacterDetail.tsx`
- Modify: `app/novels/[id]/entities/EntityList.tsx`
- Modify: `app/novels/[id]/entities/[entityId]/EntityDetail.tsx`

**Interfaces:**

- Consumes: `useAuth` from Task 2.

- [ ] **Step 1: Gate the "add character" trigger**

`AddCharacterForm.tsx:16` — add the import:

```tsx
import { createCharacter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
```

In the component body, add `const { isAdmin } = useAuth()` right after `const router = useRouter()` (`AddCharacterForm.tsx:26`). Before the existing `return`, add `if (!isAdmin) return null;`.

`AddCharacterForm.tsx:72-77` currently:

```tsx
  return (
    <>
      {!open ? (
        <button onClick={() => setOpen(true)} className={primaryButtonClassName}>
          {t('addCharacter.button')}
        </button>
      ) : (
```

Keep this `!open ? button : form` branch unchanged; the early return gates both states.

- [ ] **Step 2: Gate `CharacterDetail.tsx`'s "Edit" trigger**

`CharacterDetail.tsx:22` — add the import:

```tsx
import { updateCharacter } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useSearchIndex } from "@/libs/search/SearchIndexProvider";
```

In the component body, add `const { isAdmin } = useAuth()` right after `const { documents, dependents, entityMap, upsertMany } = useSearchIndex()` (`CharacterDetail.tsx:38`).

`CharacterDetail.tsx:123-136` currently:

```tsx
{
  editing ? (
    <div className="flex gap-2">
      <button onClick={cancel} className={ghostButtonClassName}>
        {t("common.cancel")}
      </button>
      <button
        onClick={save}
        disabled={saving}
        className={primaryButtonClassName}>
        {saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  ) : (
    <button
      onClick={() => setEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  )}
```

Change to:

```tsx
{
  editing ? (
    <div className="flex gap-2">
      <button onClick={cancel} className={ghostButtonClassName}>
        {t("common.cancel")}
      </button>
      <button
        onClick={save}
        disabled={saving}
        className={primaryButtonClassName}>
        {saving ? t("common.saving") : t("common.save")}
      </button>
    </div>
  ) : isAdmin ? (
    <button
      onClick={() => setEditing(true)}
      className={secondaryButtonClassName}>
      {t("common.edit")}
    </button>
  ) : null}
```

- [ ] **Step 3: Gate `EntityList.tsx`'s create bar**

`EntityList.tsx:9` — add the import:

```tsx
import { createEntity } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
```

Add `const { isAdmin } = useAuth();` inside the component (`EntityList.tsx:15`, alongside the other hooks on that line):

```tsx
const { t } = useI18n();
const { upsert } = useSearchMutations();
const { isAdmin } = useAuth();
const [entities, setEntities] = useState(initial);
const [type, setType] = useState<GenericEntityType>("location");
const [name, setName] = useState("");
const [saving, setSaving] = useState(false);
```

`EntityList.tsx:18` currently:

```tsx
<div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-4">
  <select
    value={type}
    onChange={(event) => setType(event.target.value as GenericEntityType)}
    className={inputClassName}>
    {TYPES.map((value) => (
      <option key={value} value={value}>
        {value}
      </option>
    ))}
  </select>
  <input
    className={inputClassName}
    value={name}
    onChange={(event) => setName(event.target.value)}
    placeholder={t("entities.name")}
  />
  <button
    className={primaryButtonClassName}
    onClick={() => void add()}
    disabled={saving || !name.trim()}>
    {t("entities.add")}
  </button>
</div>
```

Change to:

```tsx
{
  isAdmin && (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-stone-200 bg-white p-4">
      <select
        value={type}
        onChange={(event) => setType(event.target.value as GenericEntityType)}
        className={inputClassName}>
        {TYPES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </select>
      <input
        className={inputClassName}
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t("entities.name")}
      />
      <button
        className={primaryButtonClassName}
        onClick={() => void add()}
        disabled={saving || !name.trim()}>
        {t("entities.add")}
      </button>
    </div>
  )}
```

- [ ] **Step 4: Gate `EntityDetail.tsx`'s inputs and save/delete buttons**

Unlike `CharacterDetail`, `EntityDetail` has no view/edit toggle — its inputs are always editable. Disable them and hide the action buttons for a guest rather than adding a new edit-mode (out of scope for an auth-gating change).

`EntityDetail.tsx:7` — add the import:

```tsx
import { deleteEntity, updateEntity } from "@/libs/api";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
```

`EntityDetail.tsx:15` currently:

```tsx
const { t } = useI18n();
const { documents, dependents, entityMap, upsertMany, discardMany } =
  useSearchIndex();
const router = useRouter();
const [name, setName] = useState(entity.name);
const [aliases, setAliases] = useState(entity.aliases.join(", "));
const [description, setDescription] = useState(entity.description);
const [busy, setBusy] = useState(false);
const [confirming, setConfirming] = useState(false);
```

Change to:

```tsx
const { t } = useI18n();
const { isAdmin } = useAuth();
const { documents, dependents, entityMap, upsertMany, discardMany } =
  useSearchIndex();
const router = useRouter();
const [name, setName] = useState(entity.name);
const [aliases, setAliases] = useState(entity.aliases.join(", "));
const [description, setDescription] = useState(entity.description);
const [busy, setBusy] = useState(false);
const [confirming, setConfirming] = useState(false);
```

`EntityDetail.tsx:18` currently:

```tsx
return (
  <>
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {entity.type}
      </p>
      <label className="block text-sm">
        {t("entities.name")}
        <input
          className={inputClassName}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        {t("entities.aliases")}
        <input
          className={inputClassName}
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
        />
      </label>
      <label className="block text-sm">
        {t("entities.descriptionField")}
        <textarea
          className={inputClassName}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
        />
      </label>
      <div className="flex gap-2">
        <button
          className={primaryButtonClassName}
          onClick={() => void save()}
          disabled={busy || !name.trim()}>
          Save
        </button>
        <button
          className={secondaryButtonClassName}
          onClick={() => setConfirming(true)}
          disabled={busy}>
          Delete
        </button>
      </div>
    </section>
    <ConfirmDialog
      open={confirming}
      eyebrow="Confirm"
      title={`Delete ${entity.name}?`}
      description="This entity will be deleted."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={() => void remove()}
      onCancel={() => setConfirming(false)}
      busy={busy}
      danger
    />
  </>
);
```

Change to:

```tsx
return (
  <>
    <section className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-stone-500">
        {entity.type}
      </p>
      <label className="block text-sm">
        {t("entities.name")}
        <input
          className={inputClassName}
          value={name}
          onChange={(event) => setName(event.target.value)}
          disabled={!isAdmin}
        />
      </label>
      <label className="block text-sm">
        {t("entities.aliases")}
        <input
          className={inputClassName}
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          disabled={!isAdmin}
        />
      </label>
      <label className="block text-sm">
        {t("entities.descriptionField")}
        <textarea
          className={inputClassName}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={5}
          disabled={!isAdmin}
        />
      </label>
      {isAdmin && (
        <div className="flex gap-2">
          <button
            className={primaryButtonClassName}
            onClick={() => void save()}
            disabled={busy || !name.trim()}>
            Save
          </button>
          <button
            className={secondaryButtonClassName}
            onClick={() => setConfirming(true)}
            disabled={busy}>
            Delete
          </button>
        </div>
      )}
    </section>
    <ConfirmDialog
      open={confirming}
      eyebrow="Confirm"
      title={`Delete ${entity.name}?`}
      description="This entity will be deleted."
      confirmLabel="Delete"
      cancelLabel="Cancel"
      onConfirm={() => void remove()}
      onCancel={() => setConfirming(false)}
      busy={busy}
      danger
    />
  </>
);
```

- [ ] **Step 5: Manually verify**

Signed out (guest): the character list page shows no "add character" button, a character detail page shows no Edit button, the entities page shows no create bar, and an entity detail page shows disabled (greyed-out) inputs with no Save/Delete buttons. Signed in (authenticated user): every one of these behaves exactly as before.

- [ ] **Step 6: Commit**

```bash
git add "app/novels/[id]/characters/AddCharacterForm.tsx" "app/novels/[id]/characters/[characterId]/CharacterDetail.tsx" "app/novels/[id]/entities/EntityList.tsx" "app/novels/[id]/entities/[entityId]/EntityDetail.tsx"
git commit -m "$(cat <<'EOF'
feat(auth): gate character and entity mutation UI behind admin

EOF
)"
```

---

### Task 8: Gate timeline event mutation UI

**Files:**

- Modify: `app/novels/[id]/timeline/page.tsx`

**Interfaces:**

- Consumes: `useAuth` from Task 2.

- [ ] **Step 1: Gate the "add event" toggle and pass `isAdmin` into `EventCard`**

`app/novels/[id]/timeline/page.tsx:29` — add the import:

```tsx
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
```

In `TimelinePage` (the default-exported component), add `const { isAdmin } = useAuth();` right after `const { t } = useI18n();` (`page.tsx:87`).

Add an effect right after that closes any already-open mutation UI on sign-out:

```tsx
useEffect(() => {
  if (isAdmin) return;
  setShowAddForm(false);
  setEditingId(null);
  setConfirmDeleteEvent(null);
}, [isAdmin]);
```

`useEffect` is already imported on `page.tsx:3`.

Gate the forms themselves, not only their triggers. `page.tsx:303` currently:

```tsx
        {showAddForm && (
          <form onSubmit={handleAdd} className={cardClassName}>
```

Change to:

```tsx
        {showAddForm && isAdmin && (
          <form onSubmit={handleAdd} className={cardClassName}>
```

`page.tsx:423` currently:

```tsx
                      {editingId === event.id ? (
                        <form onSubmit={handleEdit} className={cardClassName}>
```

Change to:

```tsx
                      {editingId === event.id && isAdmin ? (
                        <form onSubmit={handleEdit} className={cardClassName}>
```

With the sign-out effect above, `isAdmin` can only be false here if `editingId` was already reset to `null`, so this condition is belt-and-suspenders — it keeps the render guard correct even if the effect hasn't flushed yet. The nested `EventFormFields` (used by both forms) then cannot expose its quick-add-character mutation to a guest, since neither form can render for one.

`page.tsx:293-301` currently:

```tsx
<SectionHeading
  eyebrow={t("timeline.eyebrow")}
  title={t("timeline.title")}
  description={t("timeline.description")}
  action={
    <button
      onClick={() => setShowAddForm((x) => !x)}
      className={
        showAddForm ? secondaryButtonClassName : primaryButtonClassName
      }>
      {showAddForm ? t("common.cancel") : t("timeline.addEventToggle")}
    </button>
  }
/>
```

Change to:

```tsx
<SectionHeading
  eyebrow={t("timeline.eyebrow")}
  title={t("timeline.title")}
  description={t("timeline.description")}
  action={
    isAdmin ? (
      <button
        onClick={() => setShowAddForm((x) => !x)}
        className={
          showAddForm ? secondaryButtonClassName : primaryButtonClassName
        }>
        {showAddForm ? t("common.cancel") : t("timeline.addEventToggle")}
      </button>
    ) : undefined
  }
/>
```

`page.tsx:456-465` (where `EventCard` is rendered) currently:

```tsx
<EventCard
  event={event}
  novelId={novelId}
  characters={characters}
  onEdit={startEdit}
  onDelete={setConfirmDeleteEvent}
  deleting={deletingId === event.id}
  t={t}
/>
```

Change to:

```tsx
<EventCard
  event={event}
  novelId={novelId}
  characters={characters}
  onEdit={startEdit}
  onDelete={setConfirmDeleteEvent}
  deleting={deletingId === event.id}
  isAdmin={isAdmin}
  t={t}
/>
```

- [ ] **Step 2: Gate `EventCard`'s edit/delete buttons**

`EventCard`'s props type, `page.tsx:511-527`, currently:

```tsx
function EventCard({
  event,
  novelId,
  characters,
  onEdit,
  onDelete,
  deleting,
  t,
}: {
  event: NovelEvent;
  novelId: string;
  characters: CharacterOption[];
  onEdit: (event: NovelEvent) => void;
  onDelete: (event: NovelEvent) => void;
  deleting: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
```

Change to:

```tsx
function EventCard({
  event,
  novelId,
  characters,
  onEdit,
  onDelete,
  deleting,
  isAdmin,
  t,
}: {
  event: NovelEvent;
  novelId: string;
  characters: CharacterOption[];
  onEdit: (event: NovelEvent) => void;
  onDelete: (event: NovelEvent) => void;
  deleting: boolean;
  isAdmin: boolean;
  t: ReturnType<typeof useI18n>["t"];
}) {
```

This keeps `EventCard` presentational (it receives `isAdmin` as a prop, the same way it already receives `t`, rather than calling `useAuth()` itself — see the file's own comment: "The translation function is passed through to keep this presentational card independent of context").

`page.tsx:530-548` currently:

```tsx
<div className="mb-2 flex items-start justify-between gap-2">
  <p className="text-[15px] font-semibold leading-snug text-stone-900">
    {event.title}
  </p>
  <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
    <button
      onClick={() => onEdit(event)}
      className={iconButtonClassName}
      aria-label={t("common.edit")}>
      ✏
    </button>
    <button
      onClick={() => onDelete(event)}
      disabled={deleting}
      className={`${iconButtonClassName} text-lg leading-none hover:text-rose-600`}
      aria-label={t("common.delete")}>
      ×
    </button>
  </div>
</div>
```

Change to:

```tsx
<div className="mb-2 flex items-start justify-between gap-2">
  <p className="text-[15px] font-semibold leading-snug text-stone-900">
    {event.title}
  </p>
  {isAdmin && (
    <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <button
        onClick={() => onEdit(event)}
        className={iconButtonClassName}
        aria-label={t("common.edit")}>
        ✏
      </button>
      <button
        onClick={() => onDelete(event)}
        disabled={deleting}
        className={`${iconButtonClassName} text-lg leading-none hover:text-rose-600`}
        aria-label={t("common.delete")}>
        ×
      </button>
    </div>
  )}
</div>
```

- [ ] **Step 3: Manually verify**

Signed out (guest): the timeline page shows no add-event form or button, no quick-add-character form, and no edit/delete icons on hover. Sign out while an add, edit, or delete UI is open and confirm it closes. Signed in: all event and quick-add-character actions behave exactly as before.

- [ ] **Step 4: Commit**

```bash
git add "app/novels/[id]/timeline/page.tsx"
git commit -m "$(cat <<'EOF'
feat(auth): gate timeline event mutation UI behind admin

EOF
)"
```

---

### Task 9: Firestore rules write-gate + rules test

**Files:**

- Modify: `firestore.rules`
- Modify: `package.json` (add `@firebase/rules-unit-testing` devDependency)
- Test: `firestore.rules.test.ts`
- Modify: existing `libs/firebase/*.test.ts` setup where a test writes through the Firebase web client

**Interfaces:**

- Produces: the enforcement boundary: guests can read but only authenticated Firebase Auth users can write.

- [ ] **Step 1: Add the rules-test dependency and write a failing rules test**

```bash
corepack pnpm add -D @firebase/rules-unit-testing@^5.0.2
```

Create `firestore.rules.test.ts` at the repo root:

```ts
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc } from "firebase/firestore";

let testEnv: RulesTestEnvironment;

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "demo-noveldex",
    firestore: {
      host: "127.0.0.1",
      port: 8081,
      rules: readFileSync("firestore.rules", "utf8"),
    },
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("firestore.rules", () => {
  it("lets a guest (unauthenticated) read", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(guestDb, "novels/n1")));
  });

  it("blocks a guest (unauthenticated) write", async () => {
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(
      setDoc(doc(guestDb, "novels/n1"), { title: "Guest Novel" }),
    );
  });

  it("lets an authenticated user write", async () => {
    const authedDb = testEnv.authenticatedContext("test-uid").firestore();

    await assertSucceeds(
      setDoc(doc(authedDb, "novels/n1"), { title: "Authed Novel" }),
    );
  });
});
```

Run: `corepack pnpm test -- firestore.rules.test.ts`
Expected: FAIL — the "blocks a guest write" assertion fails because `firestore.rules` still says `allow read, write: if true`.

- [ ] **Step 2: Change the rule only after every UI gate above has been verified**

```rules
rules_version = '2';

// Phase 5 (ADR-012): guests may read; any authenticated Firebase Auth user
// may write. UI gates are convenience only; this is the enforcement boundary.
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

- [ ] **Step 3: Run the rules test to verify it passes**

Run: `corepack pnpm test -- firestore.rules.test.ts`
Expected: all 3 tests PASS.

- [ ] **Step 4: Make every existing Firestore-emulator test authenticate**

`libs/firebase/*.test.ts` (`chapters`, `characterRoles`, `characters`, `events`, `lastOrderNos`, `novels`, `tags`, `volumes`, `app`) all call the same `useEmulator()` from `testUtils.ts` in their `beforeAll`. A Firestore client connected only to the Firestore emulator is unauthenticated — once `firestore.rules` requires `request.auth != null`, every one of these tests' writes now fails permission checks unless `useEmulator()` itself also signs in.

Change `useEmulator()` in `libs/firebase/testUtils.ts` — currently:

```ts
let connected = false;

export function useEmulator(): void {
  if (!connected) {
    connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
    connected = true;
  }
}
```

to:

```ts
const TEST_ADMIN_EMAIL = "test-admin@example.com";
const TEST_ADMIN_PASSWORD = "test-admin-password";

let connected = false;

export async function useEmulator(): Promise<void> {
  if (connected) return;
  connectFirestoreEmulator(db, EMULATOR_HOST, EMULATOR_PORT);
  useAuthEmulator();
  try {
    await createTestAdminUser(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  } catch {
    // Already created by an earlier test file in this run.
  }
  await signInAdmin(TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
  connected = true;
}
```

Add `signInAdmin` to the existing `import { auth } from "./auth";` line in `testUtils.ts`, making it `import { auth, signInAdmin } from "./auth";`. `useAuthEmulator` and `createTestAdminUser` are already defined further down in this same file from Task 1 — no new import needed for those.

`useEmulator()` is now `async`. Update every one of its 9 call sites — each currently reads:

```ts
beforeAll(() => {
  useEmulator();
});
```

Change each to:

```ts
beforeAll(async () => {
  await useEmulator();
});
```

in: `libs/firebase/app.test.ts`, `libs/firebase/characterRoles.test.ts`, `libs/firebase/characters.test.ts`, `libs/firebase/lastOrderNos.test.ts`, `libs/firebase/chapters.test.ts`, `libs/firebase/events.test.ts`, `libs/firebase/volumes.test.ts`, `libs/firebase/novels.test.ts`, `libs/firebase/tags.test.ts`. (`helpers.test.ts` and `mentions.test.ts` don't call `useEmulator()` — they test pure logic, not Firestore — leave them unchanged.)

- [ ] **Step 5: Run the full test suite**

Run: `corepack pnpm test`
Expected: PASS. Every `libs/firebase/*.test.ts` write now runs as the shared signed-in test account instead of an unauthenticated client.

- [ ] **Step 6: Commit**

```bash
git add firestore.rules firestore.rules.test.ts package.json pnpm-lock.yaml libs/firebase
git commit -m "feat(auth): require authentication for Firestore writes"
```

You will deploy the rules separately after this implementation is accepted; do not add a deploy command to this plan.

---

### Task 10: Docs

**Files:**

- Modify: `docs/engineering/DECISIONS.md`
- Modify: `docs/ai/AGENTS.md`
- Modify: `docs/ai/CLAUDE.md`
- Modify: `docs/ai/CONTEXT.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Supersede ADR-003 and add ADR-012**

`docs/engineering/DECISIONS.md` currently has, as its last section:

```md
## ADR-003: Public rules until authentication

**Decision:** Firestore rules remain public temporarily.

**Why:** Existing data is currently single-user/demo data. Phase 5 will introduce authentication and ownership-aware rules.

**Trade-off:** Do not expose sensitive production data before Phase 5 rules replace the temporary policy.
```

Change the heading and add a closing note, then append the new ADR after ADR-011:

```md
## ADR-003: Superseded — Public rules until authentication

**Decision:** Firestore rules remain public temporarily.

**Why:** Existing data is currently single-user/demo data. Phase 5 will introduce authentication and ownership-aware rules.

**Trade-off:** Do not expose sensitive production data before Phase 5 rules replace the temporary policy.

**Superseded by:** ADR-012 — Phase 5 ships the authenticated-writer/guest split this ADR anticipated.
```

Append after ADR-011 (end of file):

```md
---

## ADR-012: Authenticated writer + guest authentication (Firebase Auth)

**Decision:** Firebase Auth uses email/password with no self-registration UI. `isAdmin = user !== null` intentionally means any signed-in Firebase Auth user can write. Firestore keeps `read: if true`; `write` becomes `if request.auth != null`.

**Why:** The app needs an authenticated writer and a guest who only views. Firebase Auth's built-in session handling covers this without reintroducing the JWT/refresh-token machinery the Firestore migration removed.

**Trade-offs:** UI hiding of mutation controls is a UX convenience only; the Firestore rule is the actual enforcement boundary. This deliberately does not distinguish among authenticated users; add roles, an allowlist, or custom claims only through a new ADR.
```

- [ ] **Step 2: Update the AGENTS.md guardrail**

`docs/ai/AGENTS.md:10` currently:

```md
- Phase 5 is authentication; do not add ownership/auth code before it is planned.
```

Change to:

```md
- Phase 5 (ADR-012) is Firebase Auth with no self-registration UI; guest (unauthenticated) reads everything and writes nothing, while any authenticated user writes. Do not add roles, an email allowlist, or custom claims without a new ADR.
```

- [ ] **Step 3: Update CLAUDE.md's rules-status line**

`docs/ai/CLAUDE.md`'s Architecture section currently has:

```md
The Firestore rules are temporarily public until Phase 5 authentication. Phase 3 extends the client-side scoped search into one derived MiniSearch index fed by Firestore; it must not add Firestore full-text queries or an HTTP search endpoint.
```

Change to:

```md
Firestore rules (ADR-012): reads stay public; writes require any authenticated Firebase Auth user. Phase 3 extends the client-side scoped search into one derived MiniSearch index fed by Firestore; it must not add Firestore full-text queries or an HTTP search endpoint.
```

- [ ] **Step 4: Update CONTEXT.md's product boundaries**

`docs/ai/CONTEXT.md:38` currently:

```md
- Rules are temporarily public until authentication work in Phase 5.
```

Change to:

```md
- Phase 5 (ADR-012): Firebase Auth with no self-registration UI. Guest (unauthenticated) reads everything; any authenticated request can write. `isAdmin = user !== null` client-side, read from `useAuth()` in `components/auth/AuthProvider.tsx`; every mutation UI trigger checks it inline.
```

- [ ] **Step 5: Commit**

```bash
git add docs/engineering/DECISIONS.md docs/ai/AGENTS.md docs/ai/CLAUDE.md docs/ai/CONTEXT.md
git commit -m "$(cat <<'EOF'
docs: record admin/guest auth as ADR-012

EOF
)"
```
