---
id: BLUEPRINT--PHASE-5-STEP-UP-AUTH
phase: 3
type: blueprint
status: draft
tier: process
source_type: axiomatic
vault_id: default
scale_level: L2
title: "BLUEPRINT — Phase 5 step-up auth: the StepUpProvider interface + PIN provider, policy-triggered"
tags:
  - msp
  - ucf
  - blueprint
  - phase-5
  - auth
  - step-up
crosslinks: {"implements":["FEAT--STEP-UP-AUTH-PIN"],"references":["CONCEPT--STEP-UP-AUTH","CONCEPT--ABAC-POLICY-ENGINE","FEAT--POLICY-DECISION-POINT","BLUEPRINT--PHASE-4-USER-ABAC"]}
linked_symbols:
  - {"file":"packages/msp/src/policy/step-up/provider.ts"}
  - {"file":"packages/msp/src/policy/step-up/pin-provider.ts"}
  - {"file":"packages/msp/src/policy/step-up/challenge-store.ts"}
created_at: 2026-05-14T23:46:17.000+07:00
---

# BLUEPRINT — Phase 5: step-up auth

> Implementation plan for spec §11 Phase 5. Ships the `StepUpProvider` interface plus its first concrete implementation — the PIN provider, the homelab / single-user tier. Step-up is **triggered by policy, not hardcoded**: the PEP intercepts a `Decision` carrying `advice: ['request-step-up-auth']`, defers the action, drives a challenge/verify round-trip, and retries on success. Establishes the provider interface that Passkey and signed-token providers implement later.

## Geography

New:

- `packages/msp/src/policy/step-up/provider.ts` — the `StepUpProvider` interface + `Challenge` / `VerifyResponse` / `VerifyResult` / `StepUpMethod` types.
- `packages/msp/src/policy/step-up/challenge-store.ts` — server-side challenge + nonce store: issue, look up, mark-consumed, TTL expiry. Replay defense lives here.
- `packages/msp/src/policy/step-up/pin-provider.ts` — `PinProvider implements StepUpProvider`: Argon2id PIN hash, `challenge()` issues `{ challenge_id, nonce, expires_at }`, `verify()` checks PIN hash + unseen nonce + not expired + matching `action_hash`.
- `policies/50-step-up.yaml` — the policy that emits `advice: ['request-step-up-auth']` on sensitive actions and re-permits once `S.last_step_up_at` is within the action's TTL.
- `msp-auth` CLI — `set-pin` subcommand: set or rotate the local PIN (prompts, never echoes; Argon2id-hashed, stored per `MSP_HOME`).

Touched:

- The PEP (composer / `runTask` entry, the same enforcement point graduated in Phases 2–4) — intercepts `Decision.advice: ['request-step-up-auth']`, defers the action, calls `challenge()`, awaits `verify()`, retries the original action on success; the HTTP PEP prompts via the web UI, the MCP PEP dispatches out-of-band for `risk: high` tools (channel assumed to exist — spec §14 OQ-2).
- `packages/msp/src/policy/subject.ts` — `Subject` gains `last_step_up_at` / `last_step_up_method`; updated on a successful `verify()`.
- Audit log — records the deny→challenge→verify→permit sequence with `challenge_id` and method.

## Acceptance

- A policy emitting `request-step-up-auth` causes the PEP to defer the action and issue a `challenge()` — verified end-to-end.
- `verify()` with the correct PIN + matching `action_hash` + unexpired + unseen nonce succeeds; the deferred action then proceeds.
- `verify()` rejects each of: wrong PIN, expired challenge, reused nonce, mismatched `action_hash` — one test case each.
- After a successful step-up, `S.last_step_up_at` updates and an identical action within TTL is permitted with no re-challenge.
- The PIN is stored Argon2id-hashed; the plaintext never touches disk or logs — asserted by scanning the store file and log output in a test.
- The audit log shows the full deny→challenge→verify→permit sequence with `challenge_id` and method.

## Dependencies

- `BLUEPRINT--PHASE-4-USER-ABAC` — the `Subject` must already be hydrated from an authenticated user; step-up updates that `Subject`.
- `FEAT--STEP-UP-AUTH-PIN` — the API contract this phase implements.
- `FEAT--POLICY-DECISION-POINT` — the PDP that emits the `request-step-up-auth` advice.
- `CONCEPT--STEP-UP-AUTH` — the step-up mechanism, TTL guidance, provider model.
- `CONCEPT--ABAC-POLICY-ENGINE` — the advice channel on the `Decision`.

## Tasks

1. **T5.1** — `step-up/provider.ts`: the `StepUpProvider` interface + `Challenge` / `VerifyResponse` / `VerifyResult` / `StepUpMethod` types.
2. **T5.2** — `step-up/challenge-store.ts`: server-side challenge + nonce store — issue, look up, mark-consumed, TTL expiry; replay defense.
3. **T5.3** — `step-up/pin-provider.ts`: `PinProvider` — Argon2id PIN hash, `challenge()` / `verify()` with `action_hash` binding.
4. **T5.4** — PEP integration: intercept `Decision.advice: ['request-step-up-auth']`, defer the action, drive challenge/verify, retry on success, update `S.last_step_up_at` / `last_step_up_method`.
5. **T5.5** — `policies/50-step-up.yaml`: emit the advice on sensitive actions; re-permit when `S.last_step_up_at` is within the action TTL.
6. **T5.6** — `msp-auth` CLI: `set-pin` (prompts, never echoes; Argon2id; stored per `MSP_HOME`).
7. **T5.7** — Acceptance harness: deny→challenge→verify→permit happy path + replay / expiry / wrong-PIN / mismatched-`action_hash` rejection cases; assert audit trail + PIN never in plaintext.

## Out of scope

- `PasskeyProvider` (WebAuthn) and `SignedTokenProvider` — they implement the same `StepUpProvider` interface in later FEATs; this phase establishes the interface + PIN only.
- The MCP out-of-band confirmation channel implementation — spec §14 OQ-2; this phase assumes it exists for `risk: high` tools.
- Primary authentication (login) — spec §14 OQ-3; this phase is step-up only.
- Risk scoring (device fingerprint, anomaly detection) — future.

## Source

- `docs/msp/UNIVERSAL-CONTEXT-FRAMEWORK_spec.md` §11 Phase 5, §8.
- `FEAT--STEP-UP-AUTH-PIN` — the contract implemented.
- `CONCEPT--STEP-UP-AUTH` — the concept this phase implements (PIN tier).
- `FEAT--POLICY-DECISION-POINT` — the PDP whose advice drives this provider.
- `BLUEPRINT--PHASE-4-USER-ABAC` — predecessor phase.
