---
id: CONCEPT--IDENTITY-LAYER
phase: 1
type: concept
status: stable
vault_id: default
tier: genesis
source_type: axiomatic
title: Identity layer — what makes "this agent is this agent" across sessions
tags:
  - msp
  - identity
  - soul
  - profile
  - voice
  - preferences
  - m7e
crosslinks: {"references":["FRAMEWORK--MSP-ARCHITECTURE-V2"]}
created_at: 2026-05-05T00:25:00.000+07:00
---

# CONCEPT — identity layer

## Problem

The "soul" half of MSP — what makes "this agent is this agent" across sessions. Without an identity layer:

- Every session starts with a blank-slate persona; tone drifts unpredictably
- Agent has no stable name to refer to itself
- User preferences ("call me by first name", "use code blocks for snippets", "answer in Thai+English") have to be re-established every conversation
- No anchor point for future personalisation features (style consistency, voice fine-tuning)

Per `msp_spec.md` §7e, identity is one of the four things the passport carries (memory + soul + retrieval + identity). M7e provides this fourth pillar.

## Three sub-fields

| Sub-field | What | Examples |
|---|---|---|
| **Profile** | Stable identifying facts | `name`, `role`, `tier` (T1/T2/T3), `origin_story`, `created_at` |
| **Voice** | How the agent communicates | `tone` (analytical / warm / concise), `formality` (casual / neutral / formal), `language_preference` (en / th / mixed), `response_cadence` (terse / verbose) |
| **Preferences** | Per-key user/runtime overrides | `default_top_k`, `verbosity`, `code_block_style`, with optional TTL |

`Operational state` (last session id, ongoing context pointer) is mentioned in the spec but is more naturally derived from sessions/episodic at retrieval time — kept out of the identity layer for M7e to preserve the immutability story (see invariants below).

## Storage shape

Per spec §7e: `.brain/msp/projects/<ns>/identity.json` (single atomic-write JSON file). One namespace, one identity. Multi-agent setups use multiple namespaces.

```json
{
  "schemaVersion": 1,
  "profile": {
    "name": "EVA",
    "role": "research assistant",
    "tier": "T3",
    "originStory": "Created during M7e bootstrap (2026-05-04).",
    "createdAt": "2026-05-04T00:00:00.000Z"
  },
  "voice": {
    "tone": ["analytical", "warm", "concise"],
    "formality": "neutral",
    "languagePreference": "thai+english",
    "responseCadence": "terse"
  },
  "preferences": {
    "default_top_k": { "value": 5, "expiresAt": null },
    "code_block_language_hint": { "value": "auto-detect", "expiresAt": null }
  }
}
```

## Why JSON not YAML

- Atomic write is trivial (`JSON.stringify` + `writeFile` + `rename`).
- Multi-line string handling simpler (no YAML quoting gotchas).
- Library-free parsing in Node.
- Editor support universal.

YAML was considered but rejected: identity isn't manually-edited often (compared to atoms), so the "humans read YAML easier" argument is weak here.

## Invariants

- **Profile is append-mostly** — `name`, `tier`, `originStory`, `createdAt` are set once. Renaming requires explicit caller intent (no API-level guard, but documented).
- **Voice is mutable** — but changes should be infrequent (style drift = bug, not feature).
- **Preferences are mutable + TTL-able** — `expiresAt` lets short-lived overrides auto-expire (e.g. "for this session, prefer English").
- **Atomic write** — temp file + rename, never partial-write the JSON.
- **No `gks/` writes** — identity is per-project state, not durable knowledge. Don't put it in atoms (same reason tasks aren't atoms per ADR-015).
- **No crosslinks to atoms** — separate concern.

## Where it sits in the passport

```
Agent boot
  │
  ▼
┌─────────────────────────────┐
│ src/identity/getIdentity(ns)│  ← M7e (this work)
│ load .brain/.../identity.json│
│ default-construct if missing │
└────────────┬────────────────┘
             │ Identity object
             ▼
┌─────────────────────────────┐
│ Agent receives + reads     │
│  - profile.name → self-ref  │
│  - voice → prompt building  │
│  - preferences → tool args  │
└─────────────────────────────┘
```

Read at session start; written via `setProfile` / `setVoice` / `setPreference`. M7f wraps these in MCP tools (`msp_identity_get` / `msp_identity_set`).

## Out of scope (deferred)

- **MCP tool wrapping** (`msp_identity_get` / `msp_identity_set`) — M7f
- **Multi-agent identity sync** — orchestrator concern (out of MSP scope)
- **Identity validation rules** (forbidden voice combos, name conventions) — over-engineering for now
- **Per-tenant identity scoping** — namespace already provides isolation; cross-tenant auth is M9
- **Persistence to GKS atoms** — identity doesn't belong in `gks/` (per `ADR--GRAPH-IS-GKS-DOMAIN` spirit; identity is execution state, not durable knowledge)

## Source

`msp_spec.md` §7e (Identity / Soul), `FRAMEWORK--MSP-ARCHITECTURE-V2` (passport metaphor — identity is the fourth pillar).
