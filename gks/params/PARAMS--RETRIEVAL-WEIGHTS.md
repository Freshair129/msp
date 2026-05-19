---
id: PARAMS--RETRIEVAL-WEIGHTS
phase: 1
type: params
status: stable
vault_id: default
tier: genesis
source_type: axiomatic
title: PARAMS — Retrieval RRF Weights — default importance for hybrid search
tags: [msp, retrieval, rrf, weights, tuning]
aliases: [PARAMS, implementation_flow, Parameter defaults]
cluster: implementation_flow
role: Parameter defaults
crosslinks:
  enforces:
    - ADR--RETRIEVAL-RRF-FUSION
created_at: 2026-05-18T14:30:00+07:00
---

# PARAMS — Retrieval Weights

## 1. Goal

Define the default weights used by the Reciprocal Rank Fusion (RRF) algorithm in the `msp_recall` orchestrator. This allows for centralized, traceable tuning of hybrid search quality.

## 2. Parameters

| Parameter Name | Key (in code) | Default Value | Rationale |
| :--- | :--- | :--- | :--- |
| **Vector Weight** | `gks-vector` | `1.0` | Semantic recall is the primary signal for conceptual matching. |
| **Obsidian Weight** | `obsidian-text` | `0.8` | Exact keyword match is highly accurate but limited in scope. |
| **Grep Weight** | `grep` | `0.6` | Fallback substring search; lowest confidence among text sources. |
| **Episodic Weight** | `episodic` | `1.2` | Recent interaction context is the strongest indicator of immediate intent. |
| **Backlinks Weight** | `backlinks` | `0.5` | Graph-based expansion is exploratory and may introduce noise. |
| **RRF K** | `k` | `60.0` | Standard dampening constant from IR literature (Cormack et al.). |

## 3. Usage

These weights are loaded by the `packages/msp/src/orchestrator/retrieval/` module at runtime. They can be overridden on a per-call basis via the `RecallOptions.weights` parameter.

## 4. Tuning Policy

Any changes to these default values must be justified by empirical benchmarking results (e.g., improved nDCG on the `bench:recall` suite) and recorded in an AUDIT atom.
