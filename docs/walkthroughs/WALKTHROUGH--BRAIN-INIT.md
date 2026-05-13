# Walkthrough: Initialising the Global `~/.brain/`

The cognitive_system runs on a **two-brain architecture**: a global brain at `~/.brain/` (cross-project skills, identity, learned patterns) and a per-repo project brain at `<repo>/gks/` (ADRs, FEATs, BLUEPRINTs, audits). See `CONCEPT--TWO-BRAIN-ARCHITECTURE` and `ADR--BRAIN-PATH-RESOLUTION` for the full design.

The `scripts/msp/init-brain.mjs` script bootstraps the global brain on a fresh machine and migrates the prior `~/.msp/` idiom into the new `~/.brain/` layout.

## What it does

In one pass it: (a) creates `~/.brain/` plus the canonical subdirs (`skills/`, `episodic/`, `proto/`, `params/`); (b) writes empty `identity.json` and `registry.yaml` seed files; and (c) if a legacy `~/.msp/` directory exists, copies its contents into `~/.brain/` and removes the source only after the copy is verified. The script is idempotent — re-running on an already-initialised root is a no-op unless you pass `--force`.

## When to run it

- **First time using cognitive_system on a new machine** — before running any MSP commands that touch the global brain (skills, identity, episodic memory).
- **Migrating from the prior `~/.msp/` layout** — superseded by `ADR--BRAIN-PATH-RESOLUTION` §"Migration from prior idiom". One-shot move, then `~/.msp/` is gone.

## Commands

Preview without writing anything:

```sh
node scripts/msp/init-brain.mjs --dry-run
```

Apply for real:

```sh
node scripts/msp/init-brain.mjs
```

Force re-migration when the brain root already exists (e.g. you populated `~/.msp/` after the initial init):

```sh
node scripts/msp/init-brain.mjs --force
```

Migrate from a non-standard legacy location:

```sh
node scripts/msp/init-brain.mjs --legacy-msp-path=/path/to/old/.msp
```

## What to do if it fails halfway

The migration always **copies before removing**. If the copy aborts (disk full, permission error, locked file on Windows), the source `~/.msp/` is preserved untouched — re-run with `--force` after resolving the issue and the migration resumes safely. Files that already landed in `~/.brain/` are skipped on the second pass so you won't get duplicates.

## Verifying the result

```sh
ls -la ~/.brain          # POSIX
dir %USERPROFILE%\.brain # Windows
```

You should see `identity.json`, `registry.yaml`, and four subdirectories (`skills/`, `episodic/`, `proto/`, `params/`) plus any files migrated from `~/.msp/`.

## Notes

- The script does **not** write any audit atom — that wiring is deferred to Stream D P5 per `BLUEPRINT--BRAIN-MERGE-STRATEGY` §"Init script".
- `~/.brain/` is machine-local and **never committed to git**. Back it up via your normal home-directory backup strategy.
- On Linux/macOS with `XDG_DATA_HOME` set, the brain lives at `$XDG_DATA_HOME/brain` instead of `~/.brain` (the script honours XDG).

## Related

- `gks/concept/CONCEPT--TWO-BRAIN-ARCHITECTURE.md`
- `gks/adr/ADR--BRAIN-PATH-RESOLUTION.md`
- `gks/blueprint/BLUEPRINT--BRAIN-MERGE-STRATEGY.md`
