# Novelndex — Progress

Completed phases/items moved to [`docs/_complete_logs.md`](../_complete_logs.md) — this file tracks outstanding work only.

## Phase 5.1: Adaptations

Add `adaptations` subcollection under each volume

Path: `novels/{novelId}/volumes/{volumeId}/adaptations/{adaptationId}`

Add adaptation data model

Fields:

- novel_id: string (duplicated parent context for collection-group search)
- volume_id: string (duplicated parent context for search routes)
- medium: anime | manga | movie | ova | special | game | other
- group_label: Season 1 / Manga Volume 1
- group_sort_order: number
- entry_type: episode | chapter | volume | movie | special
- entry_number: number
- title: string
- source_url?: string
- source_img_url?: string
- description?: string
- sort_order: number
- created_at: Timestamp
- updated_at: Timestamp

Ordering semantics:

- `group_sort_order` orders groups within one medium.
- `entry_number` is the source-facing number (for example, Episode 12).
- `sort_order` orders entries within the same medium and group; it defaults to the next position.

Show Adaptations section on Volume Detail

Show only entries owned by that volume, with a link to the novel-wide Adaptations page.

Group by:

- medium
- group_label
- group_sort_order
- sort_order / entry_number

Add novel-wide Adaptations page

- Route: `/novels/{novelId}/adaptations`
- Entry point: Adaptations card in the Novel Detail Explore section
- Load every adaptation for the novel through one collection-group query on `novel_id`
- Show the owning volume context for every entry
- Group the page by medium, group label, and the ordering fields above
- Support inline admin CRUD/reorder and guest read-only access, following the Timeline interaction model

Add admin CRUD

- Add adaptation
- Edit adaptation
- Delete adaptation
- Reorder adaptation entries if needed

Add guest read-only view

Guests can view adaptations but cannot mutate them.

Add Adaptations to Search

Include:

- title
- medium
- group_label
- description
- related volume/chapter context

Add search document types:

- adaptation
- adaptation_note later

Adaptation search results route to `/novels/{novelId}/adaptations#adaptation-{id}`.

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

## Fix & Issue

- [ ] `AddNovelForm` is disabled (commented out) in `app/novels/page.tsx` — no way to add a novel from the UI right now; pre-existing, unrelated to the Firebase migration
- [ ] `components/commands/CommandPalette.tsx` keydown `useEffect` has no dependency array — flagged in the 2026-09-05 UI polish plan, not yet cleaned up
