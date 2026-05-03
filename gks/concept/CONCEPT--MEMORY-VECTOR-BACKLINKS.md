---
id: CONCEPT--MEMORY-VECTOR-BACKLINKS
phase: 1
type: concept
status: stable
vault_id: default
title: Memory vector / backlinks — edge graph for hybrid retrieval
tags:
  - msp
  - memory
  - vector
  - backlinks
  - hybrid-retrieval
crosslinks: {"references":["CONCEPT--MEMORY-SUBSYSTEM","FRAME--CROSSLINKS-VOCABULARY"]}
created_at: 2026-05-03T07:01:54.322Z
---

# CONCEPT — vector / backlinks

The third memory layer is a flat edge list under `vector/backlinks.jsonl`. Each line is one directed edge `{ from, to, type }`. Used for two things: (1) reverse traversal during `gks verify-flow`, (2) hybrid retrieval fusion (RRF) when an agent asks "what depends on this?".

## Path

```
.brain/msp/projects/<ns>/vector/backlinks.jsonl
```

## Schema

```json
{ "from": "FEAT--MSP-VALIDATOR", "to": "ADR--MSP-VALIDATOR", "type": "implements" }
{ "from": "FEAT--MSP-VALIDATOR", "to": "CONCEPT--MSP-VALIDATOR", "type": "references" }
{ "from": "BLUEPRINT--MSP-VALIDATOR", "to": "FEAT--MSP-VALIDATOR", "type": "implements" }
```

`type` is one of the predicates from `FRAME--CROSSLINKS-VOCABULARY`.

## How it's built

```
gks/<type>/<ID>.md frontmatter `crosslinks.*`
   │
   ▼
re-indexer (npm run msp:index) walks every atom, emits one edge per crosslinks entry
   │
   ▼
vector/backlinks.jsonl   (sorted by `from` for deterministic diffs)
```

The reverse index is computed in-memory at lookup time — no separate file.

## Hybrid retrieval (RRF)

`FRAMEWORK_MASTER_SPEC.md` §13 defines a 4-layer Reciprocal Rank Fusion across:

1. **Atomic** (exact ID lookup)
2. **Vector** (semantic neighbours)
3. **Obsidian** (graph + fulltext)
4. **Episodic** (per-session context)

The backlinks file feeds layer 3 (graph). MSP doesn't implement RRF itself — the orchestrator above does — but it owns the on-disk shape this file takes.

## Why JSONL not graph DB

- JSONL is git-diffable (humans can review additions in PRs).
- JSONL is grep-able (easy debugging).
- The graph is small enough (typical project: thousands of edges) that loading the full file into memory is < 50ms.
- A real graph DB (Kuzu, Neo4j) is an upstream optimisation — not blocked here.

## Source

`msp_spec.md` §7.3 (Vector / Backlinks).
