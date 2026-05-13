# `msp` — package-scoped notes

> **Read root `CLAUDE.md` and `AGENT.md` first** for project-wide rules. This file lists only what's specific to the MSP sub-system.

## What this package is

MSP (Memory & Soul Passport) — the orchestrator sub-system that travels with an AI agent, carrying memory + soul + retrieval + identity. Built on top of `@freshair129/gks` (workspace-internal post-pivot per `ADR--AGENTIC-MONOREPO-PIVOT`).

## Quick commands (run from `packages/msp/`)

```sh
npm test                                  # vitest run
npm run build                             # tsc -p tsconfig.build.json
npm run dev                               # web UI + MCP server
```

For atom + index work, use the root scripts:

```sh
npm run msp:index --workspace-root
npm run msp:validate --workspace-root
npm run msp:check-links --workspace-root
```

## Doc-to-code gates (MSP-enforced)

- Pre-commit: `tsx scripts/msp/validator-cli.ts --all` (must pass)
- Pre-push: `gks verify-flow` on touched FEAT atoms
- See root `AGENT.md` §Validation gates for the full check list

## Atom contradiction policy

Layer 0 (human rule) of `BLUEPRINT--CONTRADICTION-DETECTION-IMPL`: when adding an atom that conflicts with an existing `status: stable` atom of the same type, MUST supersede via reciprocal `crosslinks.supersedes` / `superseded_by` and flip the old to `superseded` — in the SAME PR. PR template enforces.

## Branching + PR conventions

- Branch: `claude/msp-<milestone>-<slug>` (or `gemini/...`, `qwen/...`)
- PRs open as **draft**; mark ready when CI green
- Squash-merge with a 1-paragraph summary
- Never merge to `main` without CI green on Node 20 + 22

## Boundary rules

- MSP depends on `@freshair129/gks` via the workspace protocol
- MSP MUST NOT bypass the GKS storage layer (per `ADR--GRAPH-IS-GKS-DOMAIN`)
- Atom vault lives at root `gks/` (post Phase B of `ULTRAPLAN--AGENTIC-MONOREPO-PIVOT`); this package keeps only code

## Documents elsewhere

- Architecture (FRAMEWORK--MSP-ARCHITECTURE-V2) → root `gks/framework/`
- Agent integration guide → `docs/msp/AGENT-INTEGRATION.md`
- Full spec → `packages/msp/msp_spec.md`
- Roadmap → root `ROADMAP.md`

---
*For T2 (Gemini) guidance, see root `GEMINI.md`. For T1 (Qwen) guidance, see root `qwen.md`.*
