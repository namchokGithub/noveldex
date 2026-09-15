# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Adaptations — Later

Later: Add notes to adaptations

Do not include notes in the initial adaptation document. Decide between a bounded embedded list and an `adaptations/{adaptationId}/notes` subcollection when the note workflow is specified.

Later: Link adaptation entry to novel chapters

Optional mapping:

- adapted_chapter_ids: string[]

The parent path already identifies the adapted volume; do not add a duplicate `adapted_volume_id` field.

## Phase 6: Polish

- [ ] Firestore read-cost + performance audit
- [ ] [ ] Cross-browser / device verification
- [ ] Production readiness checklist

## Phase 7: Cross-reference Views

- [ ] Character detail: show related notes, timeline events, adaptations
- [ ] Entity detail: show related notes, timeline events, adaptations
- [ ] Volume detail: show chapters, notes count, events, adaptations
- [ ] Chapter detail: show linked entities, timeline events, adaptation links
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
