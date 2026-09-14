# Novelndex — Phase 5: Admin + Guest Auth Design

## Goal

Replace the open Firestore rules (ADR-003) with a two-role model:

- **Admin** — one account, full read/write, identical to today's unauthenticated behavior.
- **Guest** — no login, read-only. Sees every page, cannot create/edit/delete/reorder anything.

No multi-user accounts, no self-registration, no roles beyond admin/guest.

## Context

- Runtime: Next.js app, direct Firestore access via `firebase` (Firestore Lite SDK) — see `libs/firebase/app.ts`.
- Current `firestore.rules`: `allow read, write: if true` everywhere (ADR-003, explicitly temporary until Phase 5).
- No auth code exists anywhere in the repo today (`firebase/auth` is unused; no `middleware.ts`; no login UI).
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` is already present in `.env.local.example` and wired into `libs/firebase/app.ts`'s config object, unused until now.
- No React component test harness exists (no RTL/jsdom) — same constraint as the Phase 3 plans. Pure logic gets Vitest tests; UI changes are verified manually in-browser.

## Architecture Decision

Use **Firebase Auth (email/password)**, not a custom JWT/users-collection scheme. One account, created manually in the Firebase Console (or emulator UI for local dev) — there is no sign-up flow in the app.

Because no sign-up flow exists, **any authenticated user is the admin by construction**. There is no second account to distinguish from the admin, so the app does not need an email allowlist or a custom claim. `isAdmin = user !== null`.

**Rejected alternative:** custom JWT + Firestore `users` collection (the scheme implied by the old PROGRESS.md Phase 5 bullets). Rejected because it re-introduces exactly the server-side session/refresh-token machinery the Firestore migration removed, for no benefit over Firebase Auth's built-in session handling.

## Data Flow

```
Browser
  ├─ onAuthStateChanged(auth) → AuthProvider → { user, isAdmin, loading }
  ├─ Guest (isAdmin=false): all pages render, all mutation UI hidden
  └─ Admin (isAdmin=true): mutation UI shown, writes go through Firestore SDK as today

Firestore rules (server-side, the real enforcement boundary):
  read:  allow if true                     (unchanged — guest views everything)
  write: allow if request.auth != null     (was: if true)
```

UI hiding is a UX convenience only. The Firestore rule is what actually stops a guest from writing (e.g. via devtools).

## Components

### `libs/firebase/auth.ts` (new)

- `auth: Auth` — `getAuth(getFirebaseApp())`, connects to the Auth emulator when `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1`, mirroring the existing Firestore emulator wiring in `libs/firebase/app.ts`.
- `signInAdmin(email: string, password: string): Promise<void>` — wraps `signInWithEmailAndPassword`.
- `signOutAdmin(): Promise<void>` — wraps `signOut`.

### `components/auth/AuthProvider.tsx` (new)

- React context subscribing to `onAuthStateChanged(auth, ...)`.
- Exposes `useAuth(): { user: User | null; isAdmin: boolean; loading: boolean }`.
- Mounted in `app/layout.tsx` as the outermost provider (before `I18nProvider`), so every page — including the sign-in control itself — can read auth state.

### `components/auth/SignInControl.tsx` (new)

- Rendered in `app/layout.tsx` alongside `LanguageToggle`.
- Signed out: small email/password form (inline popover, not a separate `/login` route — nothing else in the app uses dedicated auth routes, and a popover keeps the guest path a true zero-navigation read-only experience).
- Signed in: shows the admin's email + a sign-out button.
- While `loading` is true, renders nothing (avoids a flash of the wrong state).

### Edit-gating (guest = read-only)

Every existing mutation affordance must check `useAuth().isAdmin` and render nothing (not just disable) when false. Confirmed writable UI surface, grep'd against `libs/firebase/*.ts` mutation calls:

| File | Mutation affordance |
|---|---|
| `app/novels/AddNovelForm.tsx` | create novel (already disabled — re-enable is out of scope; keep gated when it returns) |
| `app/novels/[id]/AddChapterForm.tsx` | create chapter |
| `app/novels/[id]/AddVolumeForm.tsx` | create volume |
| `app/novels/[id]/VolumeManager.tsx` | reorder/delete volume |
| `app/novels/[id]/volumes/[volumeId]/VolumeDescriptionEditor.tsx` | edit volume description |
| `app/novels/[id]/volumes/[volumeId]/chapters/[chapterId]/ChapterEditor.tsx` | edit chapter fields |
| `.../chapters/[chapterId]/ChapterNotesEditor.tsx` | add/edit/delete notes |
| `.../chapters/[chapterId]/ChapterTitleEditor.tsx` | edit chapter title/kind/label |
| `app/novels/[id]/ChapterListWithFilters.tsx` | reorder/delete chapter entries |
| `app/novels/[id]/timeline/page.tsx` | create/edit/delete timeline event |
| `app/novels/[id]/characters/AddCharacterForm.tsx` | create character |
| `app/novels/[id]/characters/[characterId]/CharacterDetail.tsx` | edit character (no delete-character UI exists anywhere today — `deleteCharacter` in `libs/firebase/characters.ts` is unwired dead code, out of scope here) |
| `app/novels/[id]/entities/EntityList.tsx` | create entity |
| `app/novels/[id]/entities/[entityId]/EntityDetail.tsx` | edit/delete entity |
| `app/novels/ConfirmDialog.tsx` call sites | delete confirmations (gated via their trigger buttons above, not the dialog itself) |

The plan groups these into tasks by page/feature area rather than one task per file (matches the Task Right-Sizing convention used in the Phase 3 plans).

### `firestore.rules`

```
match /{document=**} {
  allow read: if true;
  allow write: if request.auth != null;
}
```

### `firebase.json`

Add `emulators.auth.port` (e.g. `9099`, the Firebase CLI default) so `make firebase-emulators` / `pnpm emulators` starts an Auth emulator alongside Firestore.

### Docs

- `docs/engineering/DECISIONS.md`: ADR-003 superseded by a new ADR describing the admin/guest split (keep ADR-003's text, mark superseded, as done for ADR-002/ADR-007 previously).
- `docs/ai/AGENTS.md` guardrail: Phase 5 is now defined (admin/guest, Firebase Auth) — update the existing "Phase 5 is authentication; do not add ownership/auth code before it is planned" line so it stops blocking this plan.
- `docs/ai/CONTEXT.md`: note the auth model.
- `docs/engineering/PROGRESS.md`: replace the current Phase 5 bullets (users table, JWT, middleware, refresh tokens — all obsolete, written for the old Postgres/API architecture) with the admin/guest task list.

## Testing Strategy

- `libs/firebase/auth.ts`: thin wrapper, no meaningful unit test beyond a smoke test against the Auth emulator (mirrors how `libs/firebase/*.test.ts` already test against the Firestore emulator).
- `AuthProvider`/`SignInControl`: no RTL harness — manual browser verification (documented steps: sign in as admin, confirm edit UI appears; sign out, confirm it disappears; guest never sees a login prompt forced on them).
- `firestore.rules`: add `@firebase/rules-unit-testing` (new devDependency) and a `firestore.rules.test.ts` — asserts guest can read but not write, admin (authenticated) can write. This is the one place real automated coverage of the security boundary is feasible and worth adding.
- Edit-gating per component: manual browser verification, one pass as admin (all controls present, unchanged behavior) and one pass as guest (no controls, no console errors).

## Migration / Rollout

1. Firestore rules are not feature-flagged, so code and rules ship in one deploy. Build order within the plan: auth infra + UI gating first, against the emulator with rules still open, so gating logic can be verified without also debugging rule rejections. Flip `firestore.rules` to `request.auth != null` as the last step, once UI gating is verified — the shortest possible window where the app matches the design but the rule hasn't caught up yet, and it never reaches production in that state.
2. Manually create the admin account (Console for prod project, emulator UI or a seed script for local/dev).
3. Deploy updated `firestore.rules` via `firebase deploy --only firestore:rules` (existing tooling, no new deploy step).

## Acceptance Criteria

- Guest (no login) can view every existing page/route with unchanged content; no mutation control is visible or reachable.
- Admin (logged in) has byte-for-byte the same editing capability as today.
- Firestore rejects an unauthenticated write (verified by rules test).
- Sign-in/out works against both the Auth emulator (dev) and a real Firebase project (documented, not necessarily re-verified in CI).
- `docs/engineering/PROGRESS.md` Phase 5 section reflects only this scope; `docs/engineering/DECISIONS.md` has the new ADR.

## Out of Scope

- Multi-user accounts, roles beyond admin/guest, self-registration, password reset UI.
- Rate limiting on sign-in attempts (Firebase Auth's own abuse protection applies; no additional app-level throttling).
- Any change to the read side of `firestore.rules`.
