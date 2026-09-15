# Novelndex

[![Next.js](https://img.shields.io/badge/Next.js-16.2.6-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.3.0-149ECA?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-11.10.0-DD2C00?logo=firebase&logoColor=white)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Version](https://img.shields.io/badge/version-0.1.1-6B7280)](package.json)

Novelndex is a calm workspace for mapping a novel as you read or write it: volumes, chapters, notes, characters, story events, and adaptations live together in one searchable place.

## What it supports

- Volume-first chapter management with reading progress and special chapter entries
- Notes, character/entity references, tags, and scoped command-palette search
- Story timeline ordered by volume, chapter, page, and event position
- Adaptation tracking for anime, manga, movies, and more — source links/images, notes, and mapped novel chapters
- Public read-only guest mode with authenticated admin editing

## Stack

| Area | Technology |
| --- | --- |
| App | Next.js 16, React 19, TypeScript |
| UI | Tailwind CSS 4 |
| Data | Cloud Firestore via Firebase Web SDK Lite |
| Authentication | Firebase Auth (email/password) |
| Search | Client-side MiniSearch derived from Firestore data |
| Testing | Vitest and Firebase emulator rules tests |
| Optional edge target | Cloudflare Workers through Vinext |

## Quick start

### Requirements

- Node.js 22 or newer
- Corepack (included with supported Node.js releases)

### Run locally

The application runs from the repository root.

```powershell
corepack pnpm install
Copy-Item .env.local.example .env.local
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

Add Firebase browser configuration to `.env.local`. To use the local Firebase services, set:

```text
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=1
```

Start Firestore and Auth emulators in a second terminal:

```powershell
corepack pnpm emulators
```

Create a local user in the Auth emulator UI at [http://127.0.0.1:4000/auth](http://127.0.0.1:4000/auth), then sign in from the header. Any authenticated user can edit; guests can read only.

## Architecture

Novelndex talks directly to Firestore from the Next.js application. There is no application API server, SQL database, or server-side search service in the runtime path.

```text
novels/{novelId}
├── volumes/{volumeId}
│   ├── chapters/{chapterId}
│   └── adaptations/{adaptationId}  # embedded notes[] and adapted_chapter_ids[]
├── characters/{characterId}
├── entities/{entityId}
├── events/{eventId}
├── tags/{tagId}
└── chapterNumbers/{number}

character_roles/{roleId}
```

Adaptations duplicate `novel_id` and `volume_id` for collection-group reads and search routing; their parent volume path remains authoritative. Their embedded `notes[]` records story-reference occurrences, and `adapted_chapter_ids[]` can point only to chapters in that parent volume. Firestore rules and index configuration live in [`firestore.rules`](firestore.rules) and [`firestore.indexes.json`](firestore.indexes.json).

### Reading and story order

`Chapter.sort_order` is the reading position inside one volume. A regular `chapter` also has a positive novel-wide `number` with a matching `chapterNumbers/{number}` marker. Special entries (`prologue`, `epilogue`, `afterword`, `side_story`, and `other`) do not use a number; `other` requires `custom_label`.

Timeline events sort by volume → chapter → page → event position. Adaptations sort inside a volume by medium, group, and `sort_order`.

## Common commands

| Command | Purpose |
| --- | --- |
| `corepack pnpm dev` | Run the Next.js app locally |
| `corepack pnpm lint` | Run ESLint |
| `corepack pnpm test` | Run the Vitest suite |
| `corepack pnpm build` | Create a production build |
| `corepack pnpm emulators` | Start Firestore and Auth emulators |
| `corepack pnpm build:cloudflare` | Build the Cloudflare/Vinext target |
| `corepack pnpm preview:cloudflare` | Preview the Cloudflare build locally |

To deploy Firestore rule or index changes, use the Firebase CLI. For example:

```powershell
firebase deploy --only firestore:indexes
```

Legacy PostgreSQL-related `make` commands exist only for backup and recovery material; the application does not use PostgreSQL at runtime.

## Documentation

- [Current project context](docs/ai/CONTEXT.md)
- [Contributor guidance](docs/ai/CLAUDE.md)
- [Architecture decisions](docs/engineering/DECISIONS.md)
- [Progress and backlog](docs/engineering/PROGRESS.md)
- [Cloudflare Workers deployment](docs/engineering/cloudflare-workers.md)
