---
id: BLUEPRINT--AGENT-DISPATCHER
phase: 3
type: blueprint
status: draft
vault_id: default
tier: genesis
source_type: axiomatic
title: BLUEPRINT — Agent Dispatcher — implementation plan for T1/T2/T3 routing
scale_level: feature
tags:
  - msp
  - agents
  - dispatch
  - blueprint
crosslinks:
  references:
    - CONCEPT--AGENT-TIER-ROUTING
    - ADR--AGENT-TIER-COST-POLICY
    - CONCEPT--AGENT-AGNOSTIC
linked_symbols:
  - {"file":"packages/msp/src/agents/dispatch.ts"}
created_at: 2026-05-14T01:35:00.000+07:00
aliases:
  - BLUEPRINT
  - implementation_flow
  - Implementation plan
---

# BLUEPRINT — Agent Dispatcher

Concrete implementation plan for the routing function described in `[[CONCEPT--AGENT-TIER-ROUTING]]` and the cost rules from `[[ADR--AGENT-TIER-COST-POLICY]]`.

## File layout

```
packages/msp/src/agents/
├── dispatch.ts            # public entry — dispatch({tier?, task, context}) → Result
├── routing.ts             # deterministic tier picker (the function from the CONCEPT)
├── cost-policy.ts         # escalation rules + budget checks from the ADR
├── tiers/
│   ├── types.ts          # TierAdapter interface (run, healthcheck, name)
│   ├── qwen.ts           # T1 adapter (spawn `qwen` CLI)
│   ├── gemini.ts         # T2 adapter (spawn `gemini --approval-mode yolo -p`)
│   └── claude.ts         # T3 adapter (spawn `claude` CLI or use Anthropic SDK)
└── result-recorder.ts    # writes the outcome as an episodic memory atom
```

## Public API

```typescript
export interface DispatchTask {
  type: 'summarize' | 'classify' | 'format' | 'codegen' | 'review' | 'other'
  severity: 'critical' | 'regular' | 'low'
  prompt: string
  context_size_tokens?: number   // optional; routing.ts will estimate if missing
  budget_hint?: 'T1' | 'T2' | 'T3'
  deadline_ms?: number
}

export interface DispatchResult {
  tier_used: 'T1' | 'T2' | 'T3'
  output: string
  cost_usd?: number
  duration_ms: number
  escalated_from?: 'T1' | 'T2'   // present iff routing escalated
}

export async function dispatch(task: DispatchTask): Promise<DispatchResult>
```

## Adapter contract (`tiers/types.ts`)

```typescript
export interface TierAdapter {
  readonly name: 'T1' | 'T2' | 'T3'
  healthcheck(): Promise<boolean>           // is the CLI installed + reachable?
  run(prompt: string, opts: RunOpts): Promise<RunResult>
}

export interface RunOpts {
  timeout_ms: number
  capture_stderr: boolean
}

export interface RunResult {
  ok: boolean
  output: string
  stderr?: string
  exit_code: number
}
```

Each adapter is a thin `spawn()` wrapper — no business logic. The dispatcher composes them.

## Routing flow

1. `dispatch(task)` calls `routing.pick(task)` → returns initial tier.
2. Dispatcher resolves the adapter for that tier; if `healthcheck()` returns false, falls back to the next-stronger tier (one step only).
3. Adapter runs the prompt.
4. If `ok === false` AND `severity ≥ regular`, escalate per the ADR (T1→T2, T2→T3).
5. Record the run via `result-recorder.ts` as an `[[EPISODE--AGENT-RUN]]-<timestamp>` atom.
6. Return the `DispatchResult`.

## Test strategy (`packages/msp/test/agents/`)

- **`routing.test.ts`** — pure unit tests on `pick()` covering each branch of the routing function.
- **`cost-policy.test.ts`** — escalation rules: T1 fail → T2 path / T3 gating on severity / token budget caps.
- **`tiers/qwen.test.ts`**, **`gemini.test.ts`**, **`claude.test.ts`** — each adapter mocked via a fake spawn that returns scripted exit codes + stdout. No real CLI invocation in CI.
- **`dispatch.test.ts`** — end-to-end with all three adapters mocked; verify result-recorder writes the expected episode atom.

CI gate: `npm test --workspace=packages/msp` green; new tests run in <2 seconds total (all spawn calls mocked).

## Phasing

| Step | Deliverable |
|---|---|
| **P0** (this PR) | All Phase-0 atoms: CONCEPT + ADR + BLUEPRINT (= this file). No code. |
| **P1** | `types.ts` + `routing.ts` + `routing.test.ts` only. Pure function, no spawns. |
| **P2** | `tiers/types.ts` + three adapter scaffolds returning `{ok: false, output: 'not implemented'}`. |
| **P3** | Real spawn logic in each adapter + per-adapter tests. |
| **P4** | `dispatch.ts` + `cost-policy.ts` + `result-recorder.ts` + end-to-end test. |
| **P5** | `npx msp dispatch --tier=T2 "..."` CLI subcommand. |

Each phase = its own PR. Stream D (Two-Brain) blocks until **P4**.

## Open questions (NOT to resolve in this PR)

- How to attribute spend back to the dispatcher when adapters are paid per-token? Likely needs an opt-in `cost-tracker.ts` hook per tier.
- Should we cache outputs by (task hash, tier)? Out of scope for v1; revisit if rerun rate is non-trivial.
- Multi-agent ensemble (run T1 + T2 in parallel, pick best)? Defer — ADR-level decision needed first.

## Connections
- [[CONCEPT--AGENT-AGNOSTIC]]

