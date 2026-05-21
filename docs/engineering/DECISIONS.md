# NovelDex — Architecture Decisions

## ADR-001: Monorepo (apps/api + apps/web)
**Decision:** Single repo, separate app directories. No workspaces or Turborepo.
**Why:** Small team, tight coupling between API shape and UI. Shared git history makes cross-cutting changes easier. Overhead of workspace tooling not justified yet.
**Trade-off:** No enforced build isolation. Acceptable at this scale.

---

## ADR-002: Go + PostgreSQL over Firebase / BaaS
**Decision:** Custom Go backend, Postgres on Neon, not Firebase/Supabase/PlanetScale.
**Why:** Novel data is relational and query-heavy (chapters → characters → timeline). Firebase's document model would fight this shape. Go gives type safety and clean migration control via golang-migrate.
**Trade-off:** More setup, own auth to implement. Paid back in Phase 3–4 when complex queries appear.

---

## ADR-003: No auth until Phase 5
**Decision:** Ship Phases 1–4 without user accounts. All data is public/unowned.
**Why:** Auth adds friction to every feature. Validate the data model and UI first. Adding ownership in Phase 5 is a known, bounded change (add user_id FK + middleware).
**Trade-off:** Cannot deploy publicly before Phase 5. Local/demo use only.

---

## ADR-004: story_date stored as TEXT
**Decision:** `story_date TEXT` on chapters, not `DATE` or `TIMESTAMP`.
**Why:** In-universe dates are often fictional ("Year 3 of the Crimson Era"), approximate ("early spring"), or unknown. A real date type would force normalization that doesn't exist in the source material.
**Trade-off:** Ordering requires explicit logic. Timeline sort handled in application layer or with a separate `story_date_sort_key INTEGER` if needed.
