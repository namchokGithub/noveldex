# Novelndex — Agent Instructions

Read `docs/ai/CLAUDE.md`, `docs/ai/CONTEXT.md`, and `docs/engineering/PROGRESS.md` before changing the project.

- The runtime is `web` (Next.js + direct Firestore). Do not reintroduce a Go API, Redis, SQL migrations, or `NEXT_PUBLIC_API_URL`.
- PostgreSQL and `backups/postgres/` are legacy recovery/migration material only.
- Use `corepack pnpm` in `web`; run lint and focused tests after changes.
- Do not commit or modify `.env.local`, service-account credentials, or production data without explicit approval.
- Preserve the current Firestore schema and collection-group indexes. Full-text search is deferred.
- Phase 5 is authentication; do not add ownership/auth code before it is planned.
- When a change finishes work tracked in `docs/engineering/PROGRESS.md`, move that item to `docs/_complete_logs.md` in the same change — check `_complete_logs.md` first so the item isn't already logged under different wording. Do not leave `PROGRESS.md` checklist items open once the code ships; stale open items are what caused this drift before.
