# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 7: Cross-reference Views (remaining)

- [ ] Entity detail: show related notes, timeline events, adaptations
- [ ] Adaptation detail: show related volume/chapter/entities

## Future: Adaptation Comparison

- [ ] Compare LN volume ↔ Anime episodes
- [ ] Compare LN volume ↔ Manga chapters
- [ ] Mark skipped / changed / anime-original content
- [ ] Add notes for differences
- [ ] Search adaptation differences

## Fix & Issue

- [ ] `AddNovelForm` is disabled (commented out) in `app/novels/page.tsx` — no way to add a novel from the UI right now; pre-existing, unrelated to the Firebase migration
- [ ] `components/commands/CommandPalette.tsx` keydown `useEffect` has no dependency array — flagged in the 2026-09-05 UI polish plan, not yet cleaned up
