# AGENT.md — Project-wide rules for AI Agents

This file documents mandatory rules that all AI agents operating in this repository MUST follow. For tool-specific guidance, see `CLAUDE.md` (Claude Code), `GEMINI.md` (Gemini CLI / subagent).

## Environment Rules
- **Timezone**: Use **UTC+07:00** (Indochina Time / ICT — Thailand) for all human-readable timestamps. Format: ISO 8601 with offset (e.g. `2026-05-13T11:55:00+07:00`). Do NOT use `Z` suffix unless you've computed UTC absolute yourself.
- **Working directory**: monorepo root is `C:\Users\freshair\cognitive_system`. Two workspaces: `packages/gks/` (engine library) + `packages/msp/` (orchestrator).

## Atom taxonomy (v2.3)
The atomic-knowledge prefix set is canonicalised in `packages/gks/docs/KNOWLEDGE-TYPES.md` and `packages/msp/gks/concept/CONCEPT--TAXONOMY-V2-3.md`. Key rules:

- `FRAME--` = **Block Manifest** (v2.3+) — runtime entry-point of a Knowledge Block. Frontmatter contract: `SPEC--KNOWLEDGE-BLOCK-MANIFEST`.
- `FRAMEWORK--` (v2.3+) = governance / architectural framework (the prior `FRAME--` meaning).
- `GUARD--` = structural data-integrity invariants (renamed from `GUARDRAIL--` in v2.3).
- New prefixes available: `STACK--`, `SPEC--`, `MOD--`, `COGNITIVE--`, `SAFETY--`.
- Legacy prefixes preserved: `IDEA--`, `MASTER--`, `POLICY--`, `PERSONA--`, `REQ--`, `CONSTRAINT--`, `API--`, `ENDPOINT--`, `ENTRYPOINT--`, `PARAMS--`, `INSIGHT--`, `FACT--`, `RULE--`.

## Validation gates
Before any atom commit:
- `npm run msp:index` (regen `packages/msp/gks/00_index/atomic_index.jsonl`)
- `npx tsx packages/msp/src/validator/cli.ts --root=packages/msp --all` (target: 246 passed, 0 failed)
- Crosslink references must resolve (the `dangling-wikilink` rule enforces this).
- Atom IDs must match the canonical regex `^[A-Z][A-Z0-9_]*--[A-Z0-9][A-Z0-9_-]*$` (no dots, no lowercase).

## Naming disambiguation
"Genesis Block" appears with two distinct meanings in this repo. Always pick the right one:
- **Genesis Block Engine** = the embedded graph DB (Cypher v0, JSONL log) — `packages/gks/src/memory/graph/genesis-block.ts`.
- **Knowledge Block** = the composite knowledge unit (FRAME-- manifest + Cognitive/Algo/Guard members) — `SPEC--KNOWLEDGE-BLOCK-MANIFEST`.
