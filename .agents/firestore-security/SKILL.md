# firestore-security

Use when:

- changing firestore.rules
  - adding a collection
- modifying authentication
  - changing read/write permissions

Rules:

- deny by default
- never trust client-supplied ownership/admin fields
- verify authentication where required
- validate writable fields
- inspect affected collections
- update rules tests

Current-project exception:

- ADR-012 intentionally grants public reads and authenticated writes through the recursive Firestore rule. Do not redesign that policy, add ownership fields, or add roles/custom claims without a new ADR.
- When a rule change is explicitly requested, apply the checks above and add field validation only where it is compatible with the ADR-approved access model.

Verification:

- run against Firebase Emulator
- test allowed access
- test denied access
