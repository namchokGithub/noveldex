# Novelndex — Agent Instructions

Read `docs/ai/CLAUDE.md`, `docs/ai/CONTEXT.md`, and `docs/engineering/PROGRESS.md` before changing the project.

## Local workflow guides

Use the relevant guide in `.agents/` before working in that area:

- `.agents/nextjs-feature/SKILL.md` for pages, UI, and client interactions.
- `.agents/web-quality/SKILL.md` for UI quality, images, accessibility, and responsive behavior.
- `.agents/firestore-data-modeling/SKILL.md` for Firestore collections, fields, queries, indexes, or batch changes.
- `.agents/firestore-security/SKILL.md` for Firestore rules or authentication and authorization changes.
- `.agents/code-review/SKILL.md` when reviewing changes without modifying them.

- The runtime is `web` (Next.js + direct Firestore). Do not reintroduce a Go API, Redis, SQL migrations, or `NEXT_PUBLIC_API_URL`.
- PostgreSQL and `backups/postgres/` are legacy recovery/migration material only.
- Use `corepack pnpm` in `web`; run lint and focused tests after changes.
- Do not commit or modify `.env.local`, service-account credentials, or production data without explicit approval.
- Preserve existing Firestore schema and collection-group indexes unless a reviewed change requires an additive migration. Phase 3 search uses one derived client-side MiniSearch index; do not add Firestore full-text queries, an HTTP search endpoint, or a second authoritative datastore.
- Phase 5 (ADR-012) is Firebase Auth with no self-registration UI; guest (unauthenticated) reads everything and writes nothing, while any authenticated user writes. Do not add roles, an email allowlist, or custom claims without a new ADR.
- When a change finishes work tracked in `docs/engineering/PROGRESS.md`, move that item to `docs/_complete_logs.md` in the same change — check `_complete_logs.md` first so the item isn't already logged under different wording. Do not leave `PROGRESS.md` checklist items open once the code ships; stale open items are what caused this drift before.

## Git Commit Message

- For clear, small, low-risk changes within the current workspace, implement immediately.
- Do not ask for confirmation for cosmetic UI, copy, or styling changes when the requested scope is explicit.
- Ask first only when scope is ambiguous, an action is destructive or irreversible, adds dependencies, changes external services, or affects data outside the workspace.
- After completing code changes:
  - Summarize what changed.
  - List important files changed.
  - Mention any remaining concerns or follow-up work.
  - Suggest a concise Git commit message based on the actual changes.
  - Use Conventional Commits format when appropriate.
  - Never run `git commit` unless explicitly requested.

  ```
  You are a senior software engineer reviewing git changes.

  Your task:
  Generate a high-quality commit message based ONLY on the relevant git changes.

  Rules:

  1. If staged changes exist (git diff --cached), use ONLY staged changes.
  2. If no staged changes exist, use the regular git diff.
  3. Never mix staged and unstaged changes.
  4. Use Conventional Commit format.
  5. Include scope if identifiable (e.g., invoice, payment, stock, auth, api).
  6. If Jira keys appear in the diff, include them after the scope.
  7. Keep subject line concise (<= 100 chars).
  8. Focus on business impact, not syntax noise.
  9. Ignore whitespace-only or formatting-only changes.

  Output format:<type></type>feat(feature_name<scope></scope>): <short summary></short>

  Example:
  fix(payments): store payment payload as payments array only and keep backward-compatible parsing
  ```
