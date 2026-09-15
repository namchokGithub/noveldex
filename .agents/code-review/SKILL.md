# Code Review

## Review First

- Inspect the changed code and related existing implementation.
- Focus on real issues, not personal style preferences.
- Do not modify code unless explicitly asked.

## Check

- Correctness and possible regressions.
- Edge cases and error handling.
- Unnecessary complexity or duplicated logic.
- Next.js Server/Client Component boundaries.
- Unnecessary, duplicate, or N+1 Firestore reads.
- Firestore security implications when data access changes.
- Missing or outdated tests.
- Consistency with existing project patterns.

## Findings

For each issue:

- Explain what is wrong.
- Explain the impact.
- Point to the relevant file/code.
- Suggest the smallest reasonable fix.
- Prioritize critical issues over minor improvements.

If no meaningful issues are found, say so clearly.
