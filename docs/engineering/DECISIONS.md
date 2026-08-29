# NovelDex — Architecture Decisions

## ADR-001: Single repository

**Decision:** Keep a single repository with `apps/web` as the runtime app.

**Why:** The project is small and all active code now ships together.

---

## ADR-002: Superseded — Go API and PostgreSQL runtime

The former Go API, Redis cache, and PostgreSQL application database were retired after the Firestore migration. PostgreSQL backups are retained only for recovery and auditing.

---

## ADR-006: Direct Firestore application architecture

**Decision:** The Next.js app accesses Firestore directly with the Firebase Web SDK. Domain modules in `apps/web/libs/firebase` own reads and writes.

**Why:** The active data model is already document-shaped, removes the unused Go/Redis layer, and supports the current UI with Firestore collection-group indexes.

**Trade-offs:** Firestore indexes must be deployed with `apps/web/firestore.indexes.json`; full-text search is deferred because Firestore has no native full-text capability.

---

## ADR-007: Public rules until authentication

**Decision:** Firestore rules remain public temporarily.

**Why:** Existing data is currently single-user/demo data. Phase 5 will introduce authentication and ownership-aware rules.

**Trade-off:** Do not expose sensitive production data before Phase 5 rules replace the temporary policy.

---

## ADR-004: Fictional story dates remain text

**Decision:** `story_date` remains text.

**Why:** Fictional dates can be non-standard or approximate. Sorting is explicit through event `sort_order`.
