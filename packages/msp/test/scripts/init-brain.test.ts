/**
 * Tests for scripts/msp/init-brain.mjs (Stream D P4).
 *
 * Strategy: spawn the .mjs via plain node (no tsx needed — pure ESM Node script).
 * Override USERPROFILE (win32) + XDG_DATA_HOME (POSIX) + HOME (POSIX fallback)
 * before each test so the script targets a tmpdir instead of the developer's
 * real home.
 *
 * Pattern matches packages/msp/test/scripts/workflow-scripts.test.ts.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const repoRoot = fileURLToPath(new URL('../../../..', import.meta.url))
const initBrainScript = join(repoRoot, 'scripts/msp/init-brain.mjs')

/**
 * The script's globalRoot() picks USERPROFILE on win32 and XDG_DATA_HOME / HOME on POSIX.
 * Setting all three guarantees the script targets `<fakeHome>/.brain` (win32) or
 * `<fakeHome>/brain` (POSIX with XDG set) regardless of the test runner's OS.
 */
function runScript(args: string[], fakeHome: string): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(process.execPath, [initBrainScript, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...process.env,
      USERPROFILE: fakeHome,
      XDG_DATA_HOME: fakeHome,
      HOME: fakeHome,
    },
  })
  return { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

/**
 * Resolve where the script's globalRoot() will land for a given fakeHome.
 * Mirrors the script's logic: win32 → fakeHome/.brain; otherwise (XDG set) → fakeHome/brain.
 */
function expectedBrainRoot(fakeHome: string): string {
  return process.platform === 'win32' ? join(fakeHome, '.brain') : join(fakeHome, 'brain')
}

/**
 * Where the script looks for the legacy ~/.msp/ directory. On POSIX the script
 * uses os.homedir() (HOME). On win32 it uses USERPROFILE.
 */
function expectedLegacyMspRoot(fakeHome: string): string {
  return join(fakeHome, '.msp')
}

describe('scripts/msp/init-brain.mjs', () => {
  let fakeHome: string
  let brainRoot: string
  let legacyMspRoot: string

  beforeEach(() => {
    fakeHome = mkdtempSync(join(tmpdir(), 'init-brain-'))
    brainRoot = expectedBrainRoot(fakeHome)
    legacyMspRoot = expectedLegacyMspRoot(fakeHome)
  })

  afterEach(() => {
    rmSync(fakeHome, { recursive: true, force: true })
  })

  it('dry-run reports planned creates without touching the filesystem', () => {
    const r = runScript(['--dry-run'], fakeHome)
    expect(r.code).toBe(0)
    expect(r.stdout).toMatch(/\[dry-run\]/)
    expect(r.stdout).toMatch(/create:.*\.brain|create:.*brain/)
    expect(r.stdout).toMatch(/dry-run: no filesystem changes/)
    // Filesystem must be untouched.
    expect(existsSync(brainRoot)).toBe(false)
  })

  it('creates target root + subdirs + identity.json + registry.yaml on first real run', () => {
    const r = runScript([], fakeHome)
    expect(r.code).toBe(0)
    expect(existsSync(brainRoot)).toBe(true)
    expect(existsSync(join(brainRoot, 'skills'))).toBe(true)
    expect(existsSync(join(brainRoot, 'episodic'))).toBe(true)
    expect(existsSync(join(brainRoot, 'proto'))).toBe(true)
    expect(existsSync(join(brainRoot, 'params'))).toBe(true)
    expect(existsSync(join(brainRoot, 'identity.json'))).toBe(true)
    expect(existsSync(join(brainRoot, 'registry.yaml'))).toBe(true)

    // identity.json is empty JSON object
    const identity = readFileSync(join(brainRoot, 'identity.json'), 'utf8')
    expect(JSON.parse(identity)).toEqual({})

    // registry.yaml has the header + an empty projects list
    const registry = readFileSync(join(brainRoot, 'registry.yaml'), 'utf8')
    expect(registry).toMatch(/^# ~\/\.brain\/registry\.yaml/m)
    expect(registry).toMatch(/^projects: \[\]/m)
  })

  it('is idempotent — second run says already initialised and exits 0', () => {
    runScript([], fakeHome)
    const second = runScript([], fakeHome)
    expect(second.code).toBe(0)
    expect(second.stdout).toMatch(/already initialised/)
  })

  it('migrates a legacy ~/.msp/ directory into the new brain root', () => {
    // Pre-create a fake ~/.msp/ with one file + one nested file.
    mkdirSync(legacyMspRoot, { recursive: true })
    writeFileSync(join(legacyMspRoot, 'something.txt'), 'hello\n')
    mkdirSync(join(legacyMspRoot, 'nested'), { recursive: true })
    writeFileSync(join(legacyMspRoot, 'nested', 'deep.txt'), 'world\n')

    const r = runScript([], fakeHome)
    expect(r.code).toBe(0)

    // Files migrated.
    expect(existsSync(join(brainRoot, 'something.txt'))).toBe(true)
    expect(readFileSync(join(brainRoot, 'something.txt'), 'utf8')).toBe('hello\n')
    expect(existsSync(join(brainRoot, 'nested', 'deep.txt'))).toBe(true)
    expect(readFileSync(join(brainRoot, 'nested', 'deep.txt'), 'utf8')).toBe('world\n')

    // Legacy source removed after successful migration. (Allow either fully
    // gone OR empty on Windows, per ADR / BLUEPRINT § "Migration".)
    if (existsSync(legacyMspRoot)) {
      // On platforms where rm couldn't fully remove (file locks etc.), the
      // directory must at least be empty.
      expect(readdirSync(legacyMspRoot)).toHaveLength(0)
    } else {
      expect(existsSync(legacyMspRoot)).toBe(false)
    }
  })

  it('honours --legacy-msp-path=<custom path> for migration source', () => {
    const customLegacy = join(fakeHome, 'custom-msp')
    mkdirSync(customLegacy, { recursive: true })
    writeFileSync(join(customLegacy, 'custom.txt'), 'custom\n')

    const r = runScript([`--legacy-msp-path=${customLegacy}`], fakeHome)
    expect(r.code).toBe(0)
    expect(existsSync(join(brainRoot, 'custom.txt'))).toBe(true)
    expect(readFileSync(join(brainRoot, 'custom.txt'), 'utf8')).toBe('custom\n')
  })

  it('--force re-runs migration even if brain root already exists', () => {
    // First init.
    runScript([], fakeHome)
    expect(existsSync(join(brainRoot, 'identity.json'))).toBe(true)

    // Now pre-create a fresh legacy dir and re-run with --force.
    mkdirSync(legacyMspRoot, { recursive: true })
    writeFileSync(join(legacyMspRoot, 'late-arrival.txt'), 'late\n')

    const r = runScript(['--force'], fakeHome)
    expect(r.code).toBe(0)
    expect(existsSync(join(brainRoot, 'late-arrival.txt'))).toBe(true)
    expect(r.stdout).not.toMatch(/already initialised/)
  })
})
