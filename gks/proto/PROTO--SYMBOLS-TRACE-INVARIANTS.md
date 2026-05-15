---
id: PROTO--SYMBOLS-TRACE-INVARIANTS
phase: 2
type: proto
status: active
tier: process
source_type: axiomatic
vault_id: default
title: Structural invariants for execution traces and atom graphs
tags:
  - msp
  - symbol-graph
  - proto
  - invariants
  - atom-graph
crosslinks:
  enforces: ["ADR--SYMBOLS-PROCESS-TRACING"]
  implements: ["ADR--SYMBOLS-PROCESS-TRACING"]
  supersedes: ["PROTO--TRACE-INVARIANTS"]
linked_symbols:
  - {"file":"packages/msp/src/validator/proto/trace-invariants.ts"}
created_at: 2026-05-14T20:00:00.000+07:00
---

# PROTO — Trace Invariants

This protocol defines structural invariants for both code execution traces (Symbol Graph) and atom relationship graphs to ensure finite analysis and referential integrity.

## Rule 1: Termination Guard (Execution Traces)
Every symbol trace result MUST have a finite length and terminate at either a leaf node, a cycle, or the maximum depth limit (default: 8).
- **Severity**: Error
- **Enforcement**: Validated by the `trace-invariants` predicate.

## Rule 2: Acyclic Constraint (Atom Graph)
Relationship chains for directed edges in the atom graph MUST NOT form cycles.
- **Edges**: `supersedes`, `implements`, `parent_blueprint`.
- **Violation**: Cycles will cause immediate rejection during `msp_candidate` validation.
- **Severity**: Error

## Rule 3: Entry Point Origin
Traces initiated via architectural tools (e.g. `symbol_trace` for a route) MUST originate from a node tagged with a framework `attrs` or a recognized framework `kind` (page, route, tool).
- **Severity**: Warning
- **Enforcement**: Check `src_id` of the first edge in the trace.

## Rule 4: Referential Integrity
- **Symbol Graph**: A trace path MUST NOT contain a `resolved: true` edge whose `dst_id` does not exist in the `symbols` table.
- **Atom Graph**: An atom MUST NOT reference a target atom ID (via wikilink or crosslinks) that does not exist in the atomic index, unless marked as `external`.
- **Severity**: Error

## Source
- `ADR--SYMBOLS-PROCESS-TRACING`
- `ALGO--SYMBOLS-CALL-GRAPH-TRAVERSAL`
- `PROTO--TRACE-INVARIANTS` (Merged)
