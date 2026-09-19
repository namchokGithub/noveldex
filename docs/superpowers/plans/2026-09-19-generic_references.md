# Link Generic References to Existing Entity Pages

## Summary

Complete ADR-011 navigation without creating new pages. Generic entity pages already exist; update Rich Note preview so resolved `location`, `skill`, `organization`, `item`, and `concept` references behave like resolved character references.

## Key Changes

- Pass the already-loaded combined entity list into the read-only Rich Note renderer for both Chapter and Adaptation notes.
- Resolve `[[type:Name]]` against entities by both `type` and `name`/alias.
- When resolved, render a normal in-app link to `/novels/:novelId/entities/:entityId`, using the same blue linked-reference visual treatment as characters.
- Keep unresolved, malformed, or ambiguous generic references as non-clickable muted text, with brackets hidden—matching the current fallback shown in the screenshot.
- Preserve current behavior for character references and manually added external links; do not change stored `content`, `content_json`, Firestore schemas, or ADR-011 syntax.

## Test Plan

- Unit-test resolution of a generic reference by exact name and alias.
- Verify a resolved typed reference receives the entity detail URL.
- Verify an unresolved reference has no URL and remains non-clickable.
- Confirm character and external-link rendering remain unchanged.
- Run TypeScript, and lint.

## Assumptions

- “เหมือน character” means the same in-app clickable blue link style, not the teal italic external-link style.
- Generic references without a matching entity intentionally remain display-only; the editor never creates an entity implicitly.
