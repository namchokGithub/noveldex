# Web Quality

## Before Editing

- Inspect the existing page and similar components first.
- Reuse existing components and patterns when possible.
- Avoid unnecessary architecture or visual redesign.

## Performance

- Prefer Server Components by default.
- Use `"use client"` only when interactivity requires it.
- Keep client boundaries small.
- Avoid unnecessary dependencies and rerenders.
- Avoid unnecessary or duplicate Firestore reads.
- Watch for N+1 Firestore reads.

## Images

- Prefer `next/image` where appropriate.
- Always reserve image dimensions/aspect ratio to prevent layout shift.
- Use responsive image sizes.
- Lazy-load below-the-fold images.
- Do not lazy-load important above-the-fold/LCP images.
- Avoid serving images significantly larger than displayed size.

## Accessibility

- Prefer semantic HTML over ARIA.
- Use `<button>` for actions and links for navigation.
- All interactive elements must support keyboard navigation.
- Icon-only buttons require accessible names.
- Keep visible focus states.
- Provide meaningful alt text for informative images.

## Responsive & UX

- Support mobile, tablet, and desktop.
- Prevent horizontal overflow.
- Handle long titles and unusual content.
- Consider loading, empty, error, and content states.
- Avoid layout shifts while content loads.
- Preserve existing Novelndex visual conventions.

## Verification

After meaningful UI changes:

```bash
corepack pnpm lint
```

Run `corepack pnpm build` when changes affect rendering, routing,

dynamic imports, or production behavior.

## Final Check

Before completing:

- No unnecessary `"use client"`.
- No obvious unnecessary/N+1 Firestore reads.
- Images have stable dimensions.
- No obvious layout shift.
- Keyboard accessibility works.
- Mobile layout remains usable.
- Loading/empty/error states are handled where relevant.
- Existing UI patterns are preserved.
