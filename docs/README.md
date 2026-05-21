# NovelDex — Docs

Navigation index. All project documentation lives here.

---

## `docs/ai/`

Documentation for AI-assisted workflows and session context.

| File | Purpose |
|------|---------|
| [AGENTS.md](ai/AGENTS.md) | Agent instructions — rules, constraints, commands. Read before touching code. |
| [CONTEXT.md](ai/CONTEXT.md) | Session restore context — stack, routes, migrations, current status. Update each session. |
| [plans/](ai/plans/) | Implementation plans (date-prefixed, one per feature). Executed by agents. |
| [specs/](ai/specs/) | Design specs (date-prefixed, one per feature). Written before plans. |

**New AI docs go here:**
- Agent instructions or constraints → `ai/AGENTS.md` (edit in place)
- Session context updates → `ai/CONTEXT.md` (edit in place)
- New feature spec → `ai/specs/YYYY-MM-DD-{feature}-design.md`
- New implementation plan → `ai/plans/YYYY-MM-DD-{feature}.md`

---

## `docs/engineering/`

Technical decisions and project roadmap.

| File | Purpose |
|------|---------|
| [DECISIONS.md](engineering/DECISIONS.md) | Architecture Decision Records (ADRs). Why things are the way they are. |
| [PROGRESS.md](engineering/PROGRESS.md) | Phase tracker and feature checklist. |

**New engineering docs go here:**
- Architecture decision → append to `engineering/DECISIONS.md`
- Phase or feature progress → update `engineering/PROGRESS.md`
