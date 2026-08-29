# NovelDex contributor guide

## Commands

```powershell
make dev
make web
make firebase-emulators
cd web; corepack pnpm lint
cd web; corepack pnpm test
cd web; corepack pnpm build
```

`make dev` starts local PostgreSQL only for legacy backup/recovery work and then starts the Next.js app. The production application reads and writes Firestore directly; do not add a Go API, Redis, or `NEXT_PUBLIC_API_URL` dependency.

## Architecture

`web` is the sole runtime application. Domain access lives in `web/libs/firebase`; `web/libs/api/index.ts` is a compatibility export surface, not an HTTP client.

Firestore data is nested under `novels/{novelId}` for volumes, chapters, characters, tags, events, and chapter-number markers. Global character roles live in `character_roles`.

The Firestore rules are temporarily public until Phase 5 authentication. Full-text search is deferred.

## Guardrails

- Use App Router and Server Components by default.
- Use `ConfirmDialog` for destructive UI actions and `Snackbar` for mutation results.
- Keep list pagination in URL search parameters.
- Never commit `.env.local` or Firebase service-account credentials.
- PostgreSQL backups remain recovery material; do not treat them as a live application database.

See `docs/ai/AGENTS.md` for agent-specific instructions and `docs/engineering/PROGRESS.md` for current work.
