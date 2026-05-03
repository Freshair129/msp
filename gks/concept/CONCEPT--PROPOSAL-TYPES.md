---
id: CONCEPT--PROPOSAL-TYPES
phase: 1
type: concept
status: stable
vault_id: default
title: Proposal types — new_atomic / update_atomic / supersede / deprecate
tags:
  - msp
  - inbound
  - proposal-types
crosslinks: {"references":["CONCEPT--INBOUND-QUEUE","CONCEPT--SUBMISSION-ENVELOPE"]}
created_at: 2026-05-03T07:01:51.322Z
---

# CONCEPT — proposal types

Every inbound proposal declares one of four `proposal_type` values. The promote workflow runs different side-effects per type, and the validator applies type-specific checks.

## Types

| Type | Action on promote | Key check |
|---|---|---|
| `new_atomic` | Creates `gks/<type>/<id>.md` | id must not already exist in atomic_index |
| `update_atomic` | Overwrites existing atom | `version` must increment per semver; `valid_from` shifted |
| `supersede` | Marks predecessor `superseded` + adds `superseded_by` link to new atom; new atom carries `supersedes:` | predecessor must exist and be `stable` |
| `deprecate` | Marks atom `deprecated`; no new atom required | proposal must specify `valid_until` |

## Decision rules

| Situation | Use |
|---|---|
| First time documenting a thing | `new_atomic` |
| Refining wording / adding detail without changing the decision | `update_atomic` (bump patch) |
| Refining decision but keeping ID stable | `update_atomic` (bump minor) |
| Replacing a decision wholesale with a new ID | `supersede` |
| Marking a feature/decision as no longer in effect (no replacement) | `deprecate` |

## What this concept does NOT cover

- Specific anti-hallucination rules for each type (e.g. ADR-monotonic only applies to `new_atomic` for ADRs) → see `ADR--ANTI-HALLUCINATION-RULES`
- Crosslink semantics for `supersede` → see `FRAME--CROSSLINKS-VOCABULARY`
- The promotion levels (L0/L1/L2) the inbound transitions through → see `ADR--PROMOTION-LEVELS`

## Source

`msp_spec.md` §3.2 (Proposal Types).
