# GEMINI.md — Guidance for Gemini Agents

This file documents specific rules and context for Gemini models (Gemini CLI, Gemini API, qwen-cli subagents) operating in this repository.

## 🌍 Environment Rules
- **Timezone**: Use **UTC+07:00** (Indochina Time / ICT — Thailand) for all human-readable timestamps. 
- **Format**: ISO 8601 with offset (e.g. `2026-05-13T11:55:00+07:00`). 
- **Crucial**: Do NOT use the `Z` suffix unless you have computed UTC absolute yourself. Authoring rule: write `created_at: 2026-05-13T11:55:00.000+07:00` (TH wall-clock).
- **Working directory**: The monorepo root is `C:\Users\freshair\cognitive_system`.

## 🤖 Calling Gemini CLI as a subagent
The CLI is installed globally (`gemini --version` → 0.42.0+). For headless invocation from scripts:

```bash
gemini --approval-mode plan -p "<prompt>"     # read-only investigation
gemini --approval-mode yolo -p "<prompt>"     # auto-approve edits (use with care)
```

**Known caveats:**
- **PowerShell**: Here-strings (`@'...'@`) can be misparsed as both a positional arg and a `-p` flag. Prefer Bash heredocs or pipe via stdin.
- **Hidden Paths**: `--approval-mode plan` blocks `invoke_agent` and any file under `.brain/` (ignored by default policy). Use `--approval-mode yolo` or access these via shell commands if necessary.
- **Windows**: The binary is `gemini.cmd`. Production code spawning it MUST pass `shell: true` or `shell: process.platform === 'win32'`.
- **Git Redundancy**: Avoid scanning into `.claude/worktrees/`. These contain nested `.git` files that can confuse Git-based tools and cause agent crashes (Ref: `INCIDENT_REPORT--ANTIGRAVITY-AGENT-FAIL.md`).

## 🏗️ Monorepo Workflow (Doc-Before-Code)
Every feature implementation follows a strict phase order:
1. **P1 CONCEPT**: Problem + intent (`gks/concept/`)
2. **P2 ADR/FEAT**: Decisions + API Specs (`gks/adr/`, `gks/feat/`)
3. **P3 BLUEPRINT**: Implementation plan (`gks/blueprint/`)
4. **P5 CODE**: Actual implementation (`src/`, `test/`)
5. **P6 AUDIT**: Post-implementation report (`gks/audit/`)

**Checklist before implementation:**
- [ ] `FEAT--` exists and is `status: stable/active`.
- [ ] `BLUEPRINT--` (YAML or MD) exists and is `status: stable/active`.
- [ ] All required `ADR--` references are `status: stable/active`.

## ⚛️ Atom Taxonomy (v2.3)
Canonical reference: `packages/gks/docs/KNOWLEDGE-TYPES.md`.

| Prefix | Change in v2.3 | Role |
|---|---|---|
| `FRAME--` | **New Meaning** | Block Manifest — runtime entry-point of a Genesis Block. |
| `FRAMEWORK--`| **New Prefix** | Governance / architectural framework (prior `FRAME--` meaning). |
| `GUARD--` | **Renamed** | Enforced behavioural policy (was `GUARDRAIL--`). |
| `STACK--` | **New Prefix** | Technology stack inventory. |
| `SPEC--` | **New Prefix** | Data shape specification (e.g. `SPEC--KNOWLEDGE-BLOCK-MANIFEST`). |
| `MOD--` | **New Prefix** | Module manifest (boundary + dependencies). |

**Authoring Rules:**
- **Inbound**: `msp_propose` is REMOVED. Use the `msp_candidate` MCP tool to draft atoms to `.brain/msp/projects/<ns>/candidates/`.
- **Promotion**: Atoms are promoted to `gks/<type>/` via **Human PR** only.
- **Frontmatter**: Check `packages/msp/.brain/msp/LLM_Contract/atomic_contract.yaml` for required fields.
- **Tier**: Must be one of {`safety`, `master`, `genesis`, `process`}.

## 🛠️ Tooling & Strategy
- **Parallelism**: Leverage parallel tool execution for independent tasks (e.g., reading multiple files, running independent tests).
- **Surgical Edits**: Prefer `replace` over `write_file` for targeted updates to existing files. Ensure `old_string` is unique and provides enough context.
- **Validation**: After any code change, run `npm test` and `npm run typecheck` in the relevant package.
- **Atom Integrity**: Run `npm run msp:validate` and `npm run msp:check-links` before proposing new atoms.

## 🌿 Git Guidelines
- **Branching**: Use `gemini/msp-<milestone>-<slug>` or follow `AGENT.md` convention.
- **Commit Messages**: Present tense, concise. `feat(scope): summary`.
- **Merge**: Never push to `main` directly. Open a PR and squash-merge.

---
*For project-wide rules, see `AGENT.md`. For Claude-specific guidance, see `CLAUDE.md`.*
