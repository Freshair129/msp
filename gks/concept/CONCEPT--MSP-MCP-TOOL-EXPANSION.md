---
id: CONCEPT--MSP-MCP-TOOL-EXPANSION
phase: 1
type: concept
status: stable
vault_id: default
tier: genesis
source_type: axiomatic
title: MSP MCP tool surface expansion — wrap M7b/c/d/e for agent-facing access
tags:
  - msp
  - mcp
  - tools
  - msp-recall
  - msp-remember
  - msp-compress
  - msp-identity
  - m7f
crosslinks: {"references":["FEAT--MSP-MCP-SERVER","FEAT--CONSOLIDATOR","FEAT--RETRIEVAL-ORCHESTRATION","FEAT--COMPRESSOR","FEAT--IDENTITY-LAYER"]}
created_at: 2026-05-05T16:15:00.000+07:00
aliases:
  - CONCEPT
  - implementation_flow
  - Strategic intent / PRD
---

# CONCEPT — MSP MCP tool expansion

## Problem

M7b (consolidator), M7c (retrieval), M7d (compressor), M7e (identity) all ship TS APIs but aren't reachable from agents that talk to MSP via MCP. The existing `msp-mcp-server` (M6) ships 6 tools, all gatekeeper-side (`msp_validate`, `msp_propose`, `msp_run_task`, `msp_session_append`, `msp_episode_append`, `msp_backlinks_rebuild`). M7f adds the **passport-side** tools.

## Tools to add

| Tool | Wraps | Purpose |
|---|---|---|
| `msp_recall` | `recall()` from M7c | Agent: "what do we know about X?" — returns RRF-fused hits |
| `msp_remember` | `consolidate()` from M7b + `EpisodicWriter` | Agent: "consolidate this session into episodes and persist" |
| `msp_compress` | `compress()` from M7d | Agent: "shrink these episodes to fit my budget" |
| `msp_identity_get` | `getIdentity()` from M7e | Agent: "who am I again? what are my preferences?" |
| `msp_identity_set` | `setProfile / setVoice / setPreference` from M7e | Agent: "update my voice / save a preference / record a guardrail" |

Per `msp_spec.md` §7e, identity tools take read/write distinction explicit. `msp_identity_set` accepts a discriminated union (`{ kind: 'profile' | 'voice' | 'preference', ... }`) to keep one tool surface for all writes.

## Why these 5 (not "one big tool")

Agents reason better with focused tools:

- `msp_recall` returns search results — the model knows what to do with hits
- `msp_remember` is a write side-effect — distinct cognitive shape from recall
- `msp_compress` is a transformation — input + budget, output transformed
- Identity get/set are state inspection vs mutation

A single mega-tool `msp_passport({ op: ... })` would obscure these distinctions and force the model to remember 5 sub-shapes. Fine-grained tools cost a bit more registration overhead but agent-side they're cleaner.

## Where they sit

```
src/mcp/
  ├── server.ts                 (M6 — exists)
  ├── types.ts                  (M6 — exists)
  ├── bin.ts                    (M6 — exists)
  └── tools/
      ├── validate.ts           (M6 — exists)
      ├── propose.ts            (M6 — exists)
      ├── run-task.ts           (M6 — exists)
      ├── session-append.ts     (M6 — exists)
      ├── episode-append.ts     (M6 — exists)
      ├── backlinks-rebuild.ts  (M6 — exists)
      ├── recall.ts             ← M7f (this work)
      ├── remember.ts           ← M7f
      ├── compress.ts           ← M7f
      ├── identity-get.ts       ← M7f
      └── identity-set.ts       ← M7f
```

`server.ts` registers the new tools. Each tool exports a handler `({ root, ... }) => async (args) => result` matching the existing pattern from M6.

## Tool input/output shapes

```ts
// msp_recall
input:  { query: string, top_k?: number, namespace?: string,
          weights?: Record<string, number>, timeout_ms?: number }
output: { hits: RetrievalHit[], semantic_available, obsidian_available,
          fallback_reasons, timings }

// msp_remember
input:  { session_id: string, namespace?: string,
          provider?: 'auto' | 'ollama' | 'openai' | 'mock' }
output: { episodes_emitted: Episode[], episodes_persisted: number, llm_calls: number }

// msp_compress
input:  { episodes: Episode[], budget_tokens: number,
          provider?: 'auto' | 'ollama' | 'openai' | 'mock' }
output: { compressed: CompressedEpisode[], total_tokens: number, tier_counts: Record<string, number> }

// msp_identity_get
input:  { namespace?: string, prune?: boolean }
output: { identity: Identity }   // full passport

// msp_identity_set
input (discriminated union):
  { kind: 'profile', partial: Partial<Profile>, namespace?: string }
  | { kind: 'voice', voice: Voice, namespace?: string }
  | { kind: 'preference', key: string, value: unknown, expires_at?: string, expires_in_ms?: number, namespace?: string }
output: { ok: true, identity: Identity }   // returns full identity post-write
```

## Invariants

- **Same `root` resolution** as M6 tools — `--root=PATH` flag or `process.cwd()`.
- **Same error shape** — `{ ok: false, error: string }` for handler-side failures; throws for validation errors per existing M6 pattern.
- **Tools are pure read OR pure write** — `recall` / `compress` / `identity_get` are read-only; `remember` / `identity_set` are write-only. No mixed.
- **No tool spawns subprocesses** — all in-process.
- **`bin.ts` exposes `msp-mcp-server` binary** — already shipped; no rename.

## Out of scope

- Tool versioning / capability negotiation — current MCP doesn't need this
- Auth / rate-limiting — orchestrator concern
- Streaming responses — tools return complete results
- Tool discovery beyond MCP's standard list — caller uses MCP `tools/list`

## Source

`msp_spec.md` §6 (MCP server) + §7b–e (tool wrappers per layer); `[[FEAT--MSP-MCP-SERVER]]` (M6 — establishes pattern).

## Connections
- [[FEAT--CONSOLIDATOR]]
- [[FEAT--RETRIEVAL-ORCHESTRATION]]
- [[FEAT--COMPRESSOR]]
- [[FEAT--IDENTITY-LAYER]]

