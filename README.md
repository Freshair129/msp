# MSP — Memory & Soul Passport

> Gatekeeper layer that sits on top of [`@freshair129/gks`](https://github.com/Freshair129/GksV3) and enforces the schema, ID, and wikilink discipline described in [`msp_spec.md`](./msp_spec.md). Now bundled with a visual **Knowledge Browser** for exploring the atom graph.

## What this repo is

GKS is a *storage engine*. MSP is the *Memory OS gatekeeper* above it — schema validation, ID-uniqueness, wikilink resolution, forbidden-field guard, and the promote workflow that turns a candidate atom in `.brain/msp/projects/evaAI/inbound/` into a stable artifact under `gks/<type>/`.

On top of those gatekeeper surfaces, the repo also ships an optional **Knowledge Browser** web UI: an interactive graph view, semantic recall, and a multi-vault Brain Switcher for navigating any GKS-compatible folder.

See `msp_spec.md` for the full passport surface (envelope, atomic write contract, codegen contract, phase governance, memory subsystem, promotion levels).

## Layout

```
msp/
├── msp_spec.md                       authoritative human-readable spec
├── gks/                              canonical atom tree (committed)
│   ├── 00_index/atomic_index.jsonl
│   ├── concept/  adr/  feat/  blueprint/  frame/
│   └── audit/  task/  issues/
├── .brain/msp/projects/evaAI/        runtime state (mostly gitignored)
│   ├── inbound/                      candidate atoms awaiting review
│   ├── audit/  session/  memory/  vector/
├── src/                              MSP gatekeeper (validator, codegen, MCP, memory)
│   ├── validator/  codegen/  memory/  mcp/  identity/  obsidian/  orchestrator/
│   └── index.ts                      Knowledge Browser backend (Express)
└── web/                              Knowledge Browser frontend (React + Vite)
```

## Workflow (doc-to-code, P1 → P6)

```
P1 CONCEPT → P2 ADR/FEAT → P3 BLUEPRINT → P4 TASK → P5 src/ → P6 AUDIT
```

```sh
npm run msp:propose -- CONCEPT--MSP-VALIDATOR --title="..."
npm run msp:list                                    # what's in inbound
npm run msp:promote CONCEPT--MSP-VALIDATOR          # → gks/concept/
npm run msp:verify FEAT--MSP-VALIDATOR              # gate before src/
npm run msp:validate                                # MSP's own validator
```

Or use GKS directly:

```sh
npx gks new-feature msp-validator \
  --title="MSP validator pipeline" \
  --concept="why we need it" \
  --adr="forbidden fields + dangling wikilinks + ID uniqueness" \
  --blueprint-file=src/validator/index.ts
```

## Status

- [x] **M0** — Bootstrap (npm + GKS install + `gks/` tree)
- [x] **M1** — Slice `msp_spec.md` into atoms via inbound queue
- [x] **M2** — Implement validator under `src/validator/` (49/49 tests)
- [x] **M3a** — Pre-commit hook (`examples/hooks/`)
- [x] **M3b** — Runtime contract loader (`src/validator/contract.ts` + `atomic_contract.yaml`)
- [x] **M3c** — All 4 FEAT scaffolds implemented:
  - `src/memory/backlinks/` (15 tests)
  - `src/memory/sessions/` (20 tests)
  - `src/memory/episodic/` (19 tests)
  - `src/codegen/` (36 tests, mock SLM)
- [x] **M3d** — phase-6 propose wrapper (`scripts/msp/propose.mjs`)
- [x] **M4a** — bin entries (`msp-validate`, `msp-backlinks`, `msp-run-task`, `msp-propose`) + GitHub Actions CI (Node 20+22 matrix)
- [x] **M4b** — Real Ollama SLM client + factory (`src/codegen/slm/`, 14 tests, no real network in CI)
- [x] **M4c** — Vitest acceptance runner (`src/codegen/acceptance/`, 13 tests incl. real vitest spawn)
- [x] **M5a** — Pre-push hook (`gks verify-flow` per touched FEAT)
- [x] **M5b** — Hotfix wrapper (`msp:hotfix:*` scripts + pre-commit gate via `gks hotfix check`)
- [x] **M5c** — 3 remaining anti-hallucination rules (no-invented-versions, evidence-for-decisions, cite-or-mark-inferred)
- [x] **M5d** — `required_fields` enforced from `atomic_contract.yaml` runtime
- [x] **M5e** — `ADR--HUMAN-REVIEW-GATES` + `msp_spec.md` §12 alignment
- [x] **M5f** — shellcheck CI step
- [x] **M6** — `msp-mcp-server` exposing 6 MSP-specific tools over stdio MCP (run side-by-side with `gks-mcp-server`)

**233 tests passing across 38 files.** 89 atoms in `gks/` (validator dogfood: 89/89 pass).

## MCP server

```jsonc
// ~/.config/claude/mcp.json
{
  "mcpServers": {
    "msp": {
      "command": "npx",
      "args": ["-y", "msp-mcp-server"],
      "env": { "MSP_ROOT": "/path/to/your/msp/repo" }
    }
  }
}
```

Tools exposed: `msp_validate`, `msp_propose`, `msp_run_task`, `msp_session_append`, `msp_episode_append`, `msp_backlinks_rebuild`. Run alongside `gks-mcp-server` — the client merges tool surfaces.

## Pre-commit hook

```sh
bash examples/hooks/install.sh
```

After install, `git commit` blocks if any staged `.md` under `gks/` or `.brain/msp/projects/<ns>/inbound/` fails the validator. Skip with the standard `git commit --no-verify`. Full docs: [`examples/hooks/README.md`](./examples/hooks/README.md).

## Memory + codegen surfaces

```sh
# After `npm run build`, bin entries are available:
npx msp-validate --all                    # whole-tree validator
npx msp-backlinks --check                 # CI drift assertion
npx msp-propose AUDIT--FOO --phase=6 ...  # phase-6 wrapper
npx msp-run-task <T*.task.yaml>           # codegen runner

# Real SLM (M4b)
ollama pull qwen2.5-coder:7b
MSP_SLM_PROVIDER=ollama npx msp-run-task <T*.task.yaml>

# Real test gate (M4c) — programmatic
import { createVitestAcceptance } from '@/codegen/acceptance/vitest'
runTask(taskPath, { acceptanceRunner: createVitestAcceptance(...) })
```

Programmatic surfaces:

```ts
import { openSession }       from '@/memory/sessions/writer'
import { appendEpisode }     from '@/memory/episodic/writer'
import { rebuildBacklinks }  from '@/memory/backlinks/indexer'
import { runTask }           from '@/codegen/runner'
```

## Knowledge Browser (web UI)

A visual interface for exploring the GKS atom graph: interactive 2D graph (Cytoscape.js), semantic recall, multi-vault Brain Switcher, atom inspector with frontmatter, and live counts for hotfixes / inbound queue.

### Prerequisites

- Node.js 20+
- GKS atoms in a folder structure (e.g., `gks/concept/*.md`)

### Install & run

```bash
npm install
cd web && npm install && cd ..
npm run dev          # backend (Express) + frontend (Vite) together
```

Open the app at **http://localhost:3000**.

### Brain Switcher

1. Click **+ Add Brain** in the top bar.
2. Provide a **Name** (e.g., "Personal Notes").
3. Provide an **Absolute Path** to the folder (e.g., `C:/Users/Name/Documents/Brain`).
4. Click **Save**.

Your brain list is persisted in `brains-config.json` (gitignored) and survives restarts.

### Tech stack

Frontend: React + Vite + TypeScript + Cytoscape.js. Backend: Node + Express + tsx. Styling: vanilla CSS, modern dark theme.

## License

MIT
