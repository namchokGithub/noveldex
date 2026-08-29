# NovelDex

Novel and chapter tracker built with Next.js and Cloud Firestore.

## Stack

- Next.js 16, React 19, TypeScript, Tailwind CSS
- Firebase Web SDK and Cloud Firestore
- PostgreSQL 16 is retained only to restore or inspect legacy backups; it is not an application runtime dependency.

## Local development

```powershell
Copy-Item web/.env.local.example web/.env.local
cd web
corepack pnpm dev
```

Set the Firebase values in `web/.env.local`. Use `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1` for the Firestore emulator, or `0` for the configured Firebase project.

## Commands

```powershell
make dev                  # PostgreSQL backup container + web app
make web                  # web app only
make firebase-emulators   # Firestore emulator
make db                   # PostgreSQL shell for backup recovery
make db-backup            # create a PostgreSQL backup
make db-restore           # restore a backup into the local PostgreSQL container
```

Full-text search is intentionally deferred: Firestore has no native full-text search.

See [progress](docs/engineering/PROGRESS.md) and [architecture decisions](docs/engineering/DECISIONS.md).
