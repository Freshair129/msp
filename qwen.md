# qwen.md — Guidance for Qwen Agents (T1 Tier)

This file documents specific rules and context for Qwen models (qwen-cli) operating as the T1 (fast codegen) agent tier in this repository.

## 🌍 Environment Rules
- **Timezone**: Use **UTC+07:00** (Indochina Time / ICT — Thailand) for all human-readable timestamps. 
- **Format**: ISO 8601 with offset (e.g. `2026-05-13T11:55:00+07:00`). 
- **Working directory**: The monorepo root is `C:\Users\freshair\cognitive_system`.

## 🤖 Calling Qwen CLI as a subagent
The Qwen CLI is a Python-based tool located in `apps/qwen/`.

Invocation pattern:
```bash
python apps/qwen/qwen.py --prompt "<prompt>"
```

**Known caveats:**
- **Python-based**: Ensure the environment has the necessary dependencies installed (see `apps/qwen/setup.py`).
- **SLM Provider**: Qwen is not yet wired as a pluggable `MSP_SLM_PROVIDER` alternative.

## 🏗️ Monorepo Workflow
Follow the strict phase order documented in `GEMINI.md`:
1. P1 CONCEPT
2. P2 ADR/FEAT
3. P3 BLUEPRINT
4. P5 CODE
5. P6 AUDIT

## ⚛️ Atom Taxonomy (v2.3)
Refer to `AGENT.md` §"Atom taxonomy" for the canonical reference. Key prefixes include:
- `ADR--`: Architectural Decision Record
- `CONCEPT--`: Strategic concept
- `FEAT--`: Feature specification
- `BLUEPRINT--`: Implementation plan

## 🛠️ Tooling & Strategy
- **Fast Codegen**: Qwen is optimized for rapid code generation and small-to-medium refactors.
- **Validation**: Always run `npm run typecheck` and `npm test` after code changes.

---
*For project-wide rules, see root `AGENT.md`. For T2 guidance, see `GEMINI.md`. For T3 guidance, see `CLAUDE.md`.*
