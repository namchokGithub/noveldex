# Novelndex contributor guide

## Commands

```powershell
make dev
make web
make firebase-emulators
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

`make dev` starts local PostgreSQL only for legacy backup/recovery work and then starts the Next.js app. The production application reads and writes Firestore directly; do not add a Go API, Redis, or `NEXT_PUBLIC_API_URL` dependency.

> **Platform note:** `make stop` calls PowerShell (`Get-NetTCPConnection`, `Stop-Process`) and only works on Windows. On macOS/Linux, stop the dev server manually (e.g. find the port with `lsof -i :3000` and `kill` it). The `pnpm dev` browser auto-open step is cross-platform — `scripts/open-dev-url.mjs` dispatches to `scripts/open-dev-url.ps1` on Windows and `scripts/open-dev-url.sh` (Chrome/Safari via `osascript`, falling back to `open-cli`) elsewhere.

## Architecture

The repository root is the sole runtime application. Domain access lives in `libs/firebase`; `libs/api/index.ts` is a compatibility export surface, not an HTTP client.

Firestore data is nested under `novels/{novelId}` for volumes, chapters, characters, tags, events, and chapter-number markers. Global character roles live in `character_roles`. Chapters carry an embedded `notes[]` list (timestamped entries with `[[Name]]` mention tracking and character auto-linking); the legacy `summary` field is still populated as a join of note content for older callers.

`sort_order` is the reading position within a volume. Keep regular chapter numbers novel-wide unique through `chapterNumbers/{number}` markers; special chapter entries use `number: null`, a `kind`, and `custom_label` only for `other`. Use `formatChapterLabel` for all user-visible chapter labels. Before releasing this model against existing data, run `backfill:chapter-entry-order` with `--dry-run`, then `--apply`.

Firestore rules (ADR-012): reads stay public; writes require any authenticated Firebase Auth user. Phase 3 extends the client-side scoped search into one derived MiniSearch index fed by Firestore; it must not add Firestore full-text queries or an HTTP search endpoint.

## Guardrails

- Use App Router and Server Components by default.
- Use `ConfirmDialog` for destructive UI actions and `Snackbar` for mutation results.
- Use `FormError` for inline validation and `userErrorMessage` when showing caught Firestore errors to users.
- Keep list pagination in URL search parameters.
- Never commit `.env.local` or Firebase service-account credentials.
- PostgreSQL backups remain recovery material; do not treat them as a live application database.
- Finishing a `docs/engineering/PROGRESS.md` item? Move it to `docs/_complete_logs.md` in the same change (check for a duplicate entry first) — see `docs/ai/AGENTS.md`.
- `@firebase/rules-unit-testing` must stay on the 4.x line — 5.x requires `firebase ^12`, this project is pinned to `firebase ^11.10.0`.

See `docs/ai/AGENTS.md` for agent-specific instructions and `docs/engineering/PROGRESS.md` for current work.
