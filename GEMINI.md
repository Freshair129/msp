# GEMINI.md — Guidance for Gemini Agents

This file documents specific rules and context for Gemini models (Gemini CLI, Gemini API, qwen-cli subagents) operating in this repository. Project-wide rules live in `AGENT.md`; Claude-Code-specific guidance in `CLAUDE.md`.

## Environment Rules
- **Timezone**: Use **UTC+07:00** (Indochina Time / ICT — Thailand) for all human-readable timestamps. Format: ISO 8601 with offset (e.g. `2026-05-13T11:55:00+07:00`). Do NOT use `Z` suffix unless you've computed UTC absolute yourself.
- **Working directory**: monorepo root is `C:\Users\freshair\cognitive_system`.

## Calling Gemini CLI as a subagent
The CLI is installed globally (`gemini --version` → 0.42.0+). For headless invocation from scripts:

```bash
gemini --approval-mode plan -p "<prompt>"     # read-only investigation
gemini --approval-mode yolo -p "<prompt>"     # auto-approve edits (use with care)
```

**Known caveats:**
- PowerShell here-strings (`@'...'@`) sometimes get parsed as both a positional arg and a `-p` flag, causing `Cannot use both a positional prompt and the --prompt (-p) flag together`. Prefer Bash heredocs (`$(cat <<'EOF' ... EOF)`) or pipe via stdin.
- `--approval-mode plan` blocks `invoke_agent` and any file under `.brain/` (ignored by Gemini's default policy). Pass `--approval-mode yolo` or use Claude Code directly when reading those paths.
- On Windows, the binary is `gemini.cmd`. Production code spawning it must pass `shell: process.platform === 'win32'` to `execFile` / `spawn` — see `packages/msp/src/codegen/slm/gemini.ts`.

## Atom taxonomy (v2.3)
Same as `AGENT.md` §"Atom taxonomy" — canonical doc at `packages/gks/docs/KNOWLEDGE-TYPES.md`. When asked to author an atom, always check:
1. The prefix exists in the taxonomy.
2. Required frontmatter fields per `packages/msp/.brain/msp/LLM_Contract/atomic_contract.yaml`.
3. `tier:` ∈ {`safety`, `master`, `genesis`, `process`} (no `logic`, `architecture`, `api`).
4. `created_at:` uses ICT offset (`+07:00`), not `Z`.

## Use as MSP SLM provider
Gemini is wired as a tier-2 SLM via `packages/msp/src/codegen/slm/gemini.ts`. Selection:

```bash
MSP_SLM_PROVIDER=gemini msp-run-task ...
GEMINI_BIN=/path/to/gemini msp-run-task ...    # override binary discovery
GEMINI_MODEL=gemini-2.5-pro msp-run-task ...   # override default model
```

Escalation tier (final fallback after Ollama exhausts retries) is configured in `codegen/runner.ts`.
