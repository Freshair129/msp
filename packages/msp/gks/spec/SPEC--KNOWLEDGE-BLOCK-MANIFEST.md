---
id: SPEC--KNOWLEDGE-BLOCK-MANIFEST
phase: 2
type: spec
status: stable
tier: genesis
source_type: axiomatic
vault_id: default
title: Knowledge Block manifest — frontmatter contract for FRAME-- atoms (v2.3+)
tags:
  - msp
  - spec
  - knowledge-block
  - manifest
  - taxonomy
  - foundation
crosslinks: {"references":["CONCEPT--TAXONOMY-V2-3","ADR--TAXONOMY-V2-3-MIGRATION","FRAMEWORK--AUTHORITY-MATRIX","CONCEPT--GENESIS-BLOCK-ENGINE"]}
created_at: 2026-05-13T13:14:43+07:00
---

# SPEC — Knowledge Block manifest

## 1. Disambiguation — "Knowledge Block" vs "Genesis Block Engine"

This repo contains two distinct concepts that have been informally referred to as "Genesis Block". This SPEC names them and pins one of them down.

| Name | What it is | Where it lives |
|---|---|---|
| **Knowledge Block** | A *composite knowledge unit* — a `FRAME--<NAME>` manifest atom + the member atoms it aggregates (Cognitive lens + executable Logic + structural Guard, plus optional Operational SOPs and external interfaces). Specified by **this atom**. | `packages/{gks,msp}/gks/framework/FRAME--<NAME>.md` (post-v2.3) |
| **Genesis Block Engine** | An embedded graph **database backend** with Cypher v0, JSONL append log, bi-temporal time-travel. Pure storage; persists `manifest.json` + `genesis-block.jsonl`. Specified by `CONCEPT--GENESIS-BLOCK-ENGINE`. | `packages/gks/src/memory/graph/genesis-block.ts` |

These are orthogonal — a Knowledge Block can be *stored in* a Genesis Block Engine (or in `GraphStore`, or in `PgGraphBackend`), but the composite identity is independent of the storage layer. Where existing prose says "Genesis Block" in the v2.3 taxonomy sense (composite knowledge), read it as "Knowledge Block".

## 2. The manifest atom

A **Block Manifest** is a `FRAME--<NAME>.md` atom under `packages/<pkg>/gks/framework/` that declares the membership and authority of one Knowledge Block. The taxonomy v2.3 prefix table (`CONCEPT--TAXONOMY-V2-3`) reserves `FRAME--` for exactly this purpose.

### 2.1 Frontmatter (validator-required, inherited from the atomic contract)

These are required by `packages/msp/.brain/msp/LLM_Contract/atomic_contract.yaml` `required_fields.default` for every atom and apply unchanged here:

```yaml
id: FRAME--<SLUG>            # e.g. FRAME--IDENTITY-ENGINE
phase: 0                     # Block Manifests sit at P0 — they are foundational
type: frame                  # use 'frame' (Block Manifest), not 'framework' (governance)
status: stable               # see §4 for status cascade rules
title: <Knowledge Block name — Engine — short purpose>
created_at: <YYYY-MM-DDTHH:MM:SS+07:00>   # ICT, per repo timezone rule
```

Recommended but optional (warning-only):

```yaml
tier: genesis                # see tier-enum.ts; "genesis" is correct for foundational blocks
source_type: axiomatic       # or "learned" if the block emerged from analysis
vault_id: default
tags: [..., manifest, knowledge-block]
```

### 2.2 Block-specific fields (declared by this SPEC, descriptive — see §5)

```yaml
manifest_version: <semver>   # e.g. "1.0.0" — block version, independent of SPEC version

members:
  core:
    cognitive: [COGNITIVE--<...>, ...]   # ≥1 entry — the mental model / interpretive lens
    algo:      [ALGO--<...>, ...]        # ≥1 entry — the executable logic
    guard:     [GUARD--<...>, ...]       # ≥1 entry — the structural invariants
  optional:
    runbook:   [RUNBOOK--<...>, ...]     # required for "operational" blocks (see §3.2)
    protocol:  [PROTOCOL--<...>, ...]    # required if the block exposes A2A/MCP
    stack:     [STACK--<...>, ...]       # technology inventory for execution
    safety:    [SAFETY--<...>, ...]      # ethical / alignment rules

daci:
  driver:       MOD--<...> | PERSONA--<...> | ENTITY--<...>   # single owner of decisions
  approver:     [<id>, ...]              # who can `status: stable` promote
  contributor:  [<id>, ...]              # who can propose edits
  informed:     [<id>, ...]              # who must be told of changes
```

The `crosslinks.references` field already exists in every atom; the SPEC does **not** add new top-level frontmatter keys without `members:`/`manifest_version:`/`daci:`. (These three keys are not yet enforced by the validator — see §5.)

## 3. Membership rules

### 3.1 Core trio (mandatory)

Per `CONCEPT--TAXONOMY-V2-3` §1–§3 and the user's v2.3 specification, every Knowledge Block must aggregate at least one atom from each of three core roles:

- **COGNITIVE** — the lens / mental model the block reasons with (e.g. an Erikson-stage model, an ego-death frame, a Qualia model)
- **ALGO** — the step-by-step procedure the block executes (e.g. simulated-annealing schedule, retrieval planner)
- **GUARD** — the structural invariants that hold during execution (e.g. id-match, no-nulls, schema constraints)

`FRAME--` is the *manifest itself*; it is not "a fourth member" of the trio. The trio is closed at three roles.

### 3.2 Operational SOPs (conditional)

- `RUNBOOK--<...>` is **required** when the block is operational — i.e. anything that runs on a recurring schedule, owns incidents, or is on an on-call rotation. The author declares operational scope in the manifest body.
- `PROTOCOL--<...>` is **required** when the block exposes an external surface (A2A/MCP, HTTP/JSON-RPC, FFI). Internal-only blocks may omit it.
- `STACK--<...>` is recommended for any block that executes code; omit only for purely-declarative blocks.
- `SAFETY--<...>` is recommended for any block that takes outbound action (file writes, API calls, messages); omit for read-only blocks.

### 3.3 Aggregation grammar

Each id listed under `members.*` must:

1. Match the canonical id regex (`^[A-Z][A-Z0-9_]*--[A-Z0-9][A-Z0-9_-]*$`)
2. Resolve to an existing atom (the `dangling-wikilink` rule already enforces this on `crosslinks.references`; the SPEC asks authors to mirror every `members.*` id into `crosslinks.references` until a dedicated PROTO is written — see §5)
3. Have a `type:` consistent with its role under `members.*` (e.g. an id in `members.core.algo` must have `type: algo`)

## 4. Authority and lifecycle

### 4.1 DACI

`daci:` follows the standard four roles (Driver, Approver, Contributor, Informed). Values are atom ids (`MOD--`, `PERSONA--`, `ENTITY--`) — not free text. This aligns the Block Manifest with `FRAMEWORK--AUTHORITY-MATRIX`: write authority for any in-block atom flows through the manifest's `daci.approver` set.

### 4.2 Status cascade

A Knowledge Block's `status` is **derived**: `status(block) = min(status(member))` under the order `stub < raw < draft < active < stable`. `deprecated` / `superseded` propagate immediately (one deprecated member moves the block to `deprecated`).

Authors should set `status: draft` on a new manifest and only flip to `stable` after every member is `stable` and the validator's `--all` run passes.

### 4.3 Supersession

When a Knowledge Block evolves materially (a member is swapped for a different atom, a new role is added), publish a new `FRAME--<NAME>-V<N+1>` and supersede the old one via standard `crosslinks.supersedes` / `crosslinks.superseded_by` reciprocal links. `manifest_version` increments independently of supersession — patch/minor bumps stay on the same atom id; majors trigger a new manifest.

## 5. Validation tier — this SPEC is descriptive, not enforced

The validator currently checks frontmatter shape via `required-fields` + the atomic contract. **Nothing in this SPEC's §2.2 / §3 is machine-checked yet.** The `members:` / `manifest_version:` / `daci:` fields are descriptive contract that authors and reviewers obey by convention.

A follow-up `PROTO--KNOWLEDGE-BLOCK-MEMBERSHIP` will:

- Add `framework_manifest` (or extend `frame`) to the validator's per-type required-fields list
- Walk `members.*` and verify each id resolves and has the expected `type:`
- Apply the §4.2 status cascade and fail if `status:` disagrees with `min(member status)`

That PROTO is **not** part of this PR (scope: SPEC only, per `claude/msp-spec-knowledge-block-manifest` plan).

## 6. Worked example (mock — not authored)

A future `FRAME--IDENTITY-ENGINE` Knowledge Block might look like:

```yaml
---
id: FRAME--IDENTITY-ENGINE
phase: 0
type: frame
status: draft
title: Identity Engine — passport-bound agent identity resolution
created_at: 2026-05-13T13:14:43+07:00
tier: genesis
source_type: axiomatic
vault_id: default
tags: [msp, knowledge-block, identity, manifest]
manifest_version: 0.1.0
members:
  core:
    cognitive: [COGNITIVE--EGO-DEATH-PASSPORT]
    algo:      [ALGO--IDENTITY-RESOLUTION]
    guard:     [GUARD--IDENTITY-SCHEMA, GUARD--PASSPORT-NONNULL]
  optional:
    runbook:   [RUNBOOK--IDENTITY-MIGRATION]
    protocol:  [PROTOCOL--IDENTITY-API]
    stack:     [STACK--MSP-NODE-RUNTIME]
    safety:    [SAFETY--PII-REDACTION]
daci:
  driver:      MOD--IDENTITY
  approver:    [PERSONA--T3-ARCHITECT]
  contributor: [PERSONA--T2-IMPLEMENTER]
  informed:    [ENTITY--MSP-USERS]
crosslinks:
  references:
    - SPEC--KNOWLEDGE-BLOCK-MANIFEST
    - MOD--IDENTITY
    - ALGO--IDENTITY-RESOLUTION
    - COGNITIVE--EGO-DEATH-PASSPORT
    - GUARD--IDENTITY-SCHEMA
    - GUARD--PASSPORT-NONNULL
    - RUNBOOK--IDENTITY-MIGRATION
    - PROTOCOL--IDENTITY-API
    - STACK--MSP-NODE-RUNTIME
    - SAFETY--PII-REDACTION
---

# FRAME — Identity Engine

(Body explains what the engine does, links its members in narrative form,
and points readers at the SOPs and protocols.)
```

This atom is **not** created by this PR. Several of its members (`COGNITIVE--EGO-DEATH-PASSPORT`, `GUARD--IDENTITY-SCHEMA`, `STACK--MSP-NODE-RUNTIME`, etc.) do not exist yet and would need authoring first.

## 7. What this SPEC does not cover

- The runtime that *loads* a Knowledge Block manifest and invokes its members in order — that's a future `BLUEPRINT--KNOWLEDGE-BLOCK-RUNTIME`.
- The contract for `COGNITIVE--`, `STACK--`, `SAFETY--` themselves (each is a separate frontmatter contract; one SPEC each, written when the first atom of that type is authored).
- Resonance Index calculation (mentioned in the v1.2 draft of the user's specification) — deferred to a `SPEC--RESONANCE-INDEX` atom.
- Storage-engine choice — whether a block's edges go into `GraphStore`, `PgGraphBackend`, or `GenesisBlockBackend` is orthogonal to the manifest shape. The manifest does not declare a backend.
