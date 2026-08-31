# NovelDex

NovelDex is a Next.js application for organizing novels, volumes, chapters, characters, events, and tags. It uses Cloud Firestore directly through the Firebase Web SDK.

## Requirements

- Node.js 20 or later
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
```

If `make` is available, `make web` starts the application and `make firebase-emulators` starts the Firestore emulator. The PostgreSQL-related Make targets are retained solely for legacy backup and recovery work; the application does not use PostgreSQL at runtime.

## Data model

Firestore stores novel data under `novels/{novelId}`. Volumes contain chapters, chapter-number markers, characters, events, and tags; character roles are stored globally in `character_roles`.

Firestore rules and indexes are defined at the repository root in `firestore.rules` and `firestore.indexes.json`.

## Documentation

- [Current project context](docs/ai/CONTEXT.md)
- [Architecture decisions](docs/engineering/DECISIONS.md)
- [Progress and backlog](docs/engineering/PROGRESS.md)
- [Contributor guidance](CLAUDE.md)
