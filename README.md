# Novelndex

Novelndex is a Next.js application for organizing novels, volumes, chapters, characters, events, and tags. It uses Cloud Firestore directly through the Firebase Web SDK.

## Requirements

- Node.js 22 or later
- Corepack (included with supported Node.js releases)

## Getting started

The application lives at the repository root; do not `cd web`.

```powershell
corepack pnpm install
Copy-Item .env.local.example .env.local
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Set the Firebase browser configuration in `.env.local`. To use the local Firestore emulator, set `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1`.

## Commands

```powershell
corepack pnpm dev
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm emulators
corepack pnpm build:cloudflare
corepack pnpm preview:cloudflare
```

If `make` is available, `make web` starts the application and `make firebase-emulators` starts the Firestore emulator. The PostgreSQL-related Make targets are retained solely for legacy backup and recovery work; the application does not use PostgreSQL at runtime.

## Data model

Firestore stores novel data under `novels/{novelId}`. Volumes contain chapters, chapter-number markers, characters, events, and tags; character roles are stored globally in `character_roles`.

Firestore rules and indexes are defined at the repository root in `firestore.rules` and `firestore.indexes.json`.

### Chapter entries and reading order

Every chapter entry has a `sort_order` that controls its reading order within a volume. A regular `chapter` has a positive, novel-wide unique `number` and a matching `chapterNumbers/{number}` marker. Special entries (`prologue`, `epilogue`, `afterword`, `side_story`, and `other`) use `number: null` and do not create a marker; `other` requires `custom_label`.

The `backfill:chapter-entry-order` command adds these fields to chapters created before this model. Run a dry run first, then apply it with Application Default Credentials configured for the target Firebase project:

```powershell
corepack pnpm backfill:chapter-entry-order -- --project <project-id> --dry-run
corepack pnpm backfill:chapter-entry-order -- --project <project-id> --apply
```

## Documentation

- [Current project context](docs/ai/CONTEXT.md)
- [Architecture decisions](docs/engineering/DECISIONS.md)
- [Progress and backlog](docs/engineering/PROGRESS.md)
- [Contributor guidance](docs/ai/CLAUDE.md)
- [Cloudflare Workers deployment](docs/engineering/cloudflare-workers.md)
