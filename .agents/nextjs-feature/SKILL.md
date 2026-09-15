# nextjs-feature

Use when:

- adding a page
  - adding a feature
- modifying application UI
  - adding client interaction

Workflow:

1. Inspect similar existing feature first.
2. Reuse existing components/patterns.
3. Determine Server vs Client Component boundary.
4. Keep Firestore access outside presentation components.
5. Handle loading / empty / error states.
6. Preserve responsive behavior.
7. Avoid unnecessary "use client".
8. Run lint + relevant tests.
