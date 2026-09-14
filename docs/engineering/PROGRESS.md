# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 5: Adaptations

- [ ] Add `adaptations` subcollection under each volume

  Path:
  `novels/{novelId}/volumes/{volumeId}/adaptations/{adaptationId}`

- [ ] Add adaptation data model

  Fields:
  - medium: anime | manga | movie | ova | special | game | other
  - group_label: Season 1 / Manga Volume 1
  - entry_type: episode | chapter | volume | movie | special
  - entry_number: number
  - title: string
  - source_url?: string
  - description?: string
  - sort_order: number
  - created_at
  - updated_at

- [ ] Show Adaptations section on Volume Detail

  Group by:
  - medium
  - group_label
  - sort_order / entry_number

- [ ] Add admin CRUD
  - Add adaptation
  - Edit adaptation
  - Delete adaptation
  - Reorder adaptation entries if needed

- [ ] Add guest read-only view

  Guests can view adaptations but cannot mutate them.

- [ ] Add Adaptations to Search

  Include:
  - title
  - medium
  - group_label
  - description
  - related volume/chapter context

  Add search document types:
  - adaptation
  - adaptation_note later

- [ ] Later: Add notes to adaptations

  Start with embedded notes if simple:

  `adaptations/{adaptationId}.notes[]`

  Each note supports:
  - content
  - tags
  - generic entity references
  - created_at / updated_at

- [ ] Later: Link adaptation entry to novel chapters

  Optional mapping:
  - adapted_chapter_ids: string[]
  - adapted_volume_id: string

## Phase 6: Polish

### Medium

- [ ] Mobile-responsive layout

### Large

- [ ] Firestore read-cost + performance audit
- [ ] Cross-browser / device verification
- [ ] Production readiness checklist

## Fix & Issue

- [ ] `AddNovelForm` is disabled (commented out) in `app/novels/page.tsx` — no way to add a novel from the UI right now; pre-existing, unrelated to the Firebase migration
- [ ] `components/commands/CommandPalette.tsx` keydown `useEffect` has no dependency array — flagged in the 2026-09-05 UI polish plan, not yet cleaned up
