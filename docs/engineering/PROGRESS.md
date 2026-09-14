# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 6: Polish

### Small

- [x] Empty states in remaining pages
- [x] Accessibility + keyboard UX
- [ ] Localization / typography polish

### Medium

- [ ] Loading / saving / deleting states
- [ ] Error handling + user-facing messages
- [ ] Mobile-responsive layout
- [ ] Guest/Admin UX polish
- [ ] Data consistency polish

### Large

- [ ] Firestore read-cost + performance audit
- [ ] Cross-browser / device verification
- [ ] Production readiness checklist

## Fix & Issue

- [ ] Unit test
- [ ] `AddNovelForm` is disabled (commented out) in `app/novels/page.tsx` — no way to add a novel from the UI right now; pre-existing, unrelated to the Firebase migration
- [ ] `components/commands/CommandPalette.tsx` keydown `useEffect` has no dependency array — flagged in the 2026-09-05 UI polish plan, not yet cleaned up
