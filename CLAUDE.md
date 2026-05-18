# Project Instructions for Claude

Project-specific overrides that apply to this repository. Combines with `~/.claude/CLAUDE.md` (global) — project instructions take precedence when they conflict.

## Model selection

**Use Opus (maximum-reasoning tier) for all agent dispatches and subagent work on this project.** Do not downshift to Sonnet or Haiku for "mechanical" tasks — the user has explicitly opted into maximum effort across the board.

When dispatching an `Agent` tool call, always pass `model: "opus"`. This applies to:

- Implementer subagents (the ones writing code under TDD)
- Spec-compliance reviewers
- Code-quality reviewers
- Final code reviewers
- General-purpose research/exploration agents
- Planners and architects

Rationale: the user prefers the highest-quality output even at higher token cost. The model preference is not negotiable based on task complexity — apply uniformly.

## Branching strategy

Every implementation branch must be created **off `main`** via:

```bash
git fetch origin main && git checkout -b claude/<feature-name> origin/main
```

Never branch from another feature branch. No long-lived branches. Sprint N+1 cannot start until Sprint N's PR merges to `main`.

This is enforced for the UI overhaul (sprints 1–4) and applies to all future multi-PR work.

## Database access

Supabase changes go through the MCP integration or the Supabase CLI only — never via the web dashboard. CLI migrations are the source of truth. See `~/.claude/projects/-Users-jakubsledz-DEV-ksef-invoice-translator/memory/MEMORY.md` for the user's tooling preferences.

## Testing rigor

Inherits the global `~/.claude/rules/common/testing.md` 80%-coverage policy. TDD is mandatory: failing test → minimal implementation → green test → refactor → commit. No exceptions.

## Reference docs

- Design spec (Stripe-minimal + Polish heart): `docs/superpowers/specs/2026-05-18-ui-overhaul-design.md`
- Sprint 1 plan (foundation): `docs/superpowers/plans/2026-05-18-ui-overhaul-sprint-1-foundation.md`
- Spec-level open items (NIP/REGON/founder content): spec §8
