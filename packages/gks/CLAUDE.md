# `@freshair129/gks` — package-scoped notes

> **Read root `CLAUDE.md` and `AGENT.md` first** for project-wide rules. This file lists only what's specific to the GKS sub-system.

## What this package is

GKS — the storage-engine sub-system. Four cooperating layers (Atomic, Vector, Episodic, Obsidian) behind three verbs (`retain` / `recall` / `reflect`), with multi-tenancy, bi-temporal versioning, pluggable backends. Post-pivot (`ADR--AGENTIC-MONOREPO-PIVOT`) it is **workspace-internal**, no longer published standalone.

## Quick commands (run from `packages/gks/`)

```sh
npm test                   # vitest run
npm run build              # tsc -p tsconfig.build.json
```

For atom + index work, use the root scripts:

```sh
npm run msp:index --workspace-root  # or:  tsx scripts/msp/re-indexer.ts --root=.
npm run msp:validate --workspace-root
```

## Boundary rules

- GKS MUST NOT import from `packages/msp/` (per `ADR--MONOREPO-STRUCTURE`).
- The validator is MSP's domain; GKS owns storage primitives only.
- Atom vault lives at root `gks/` (post Phase B of `ULTRAPLAN--AGENTIC-MONOREPO-PIVOT`); this package keeps only code (`src/`, `test/`, `dist/`).

## Documents elsewhere

- Architecture, ADRs, workflow, technical overview → `docs/gks/`
- Atom taxonomy quick-ref → `docs/gks/KNOWLEDGE-TYPES.md`
- Scope (what GKS is / is not) → `packages/gks/SCOPE.md`

---
*For T2 (Gemini) guidance, see root `GEMINI.md`. For T1 (Qwen) guidance, see root `qwen.md`.*
