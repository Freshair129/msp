/**
 * Tests for `src/master/cli.ts` (`msp-master-propose`).
 *
 * Strategy: spawn the CLI via tsx against a tmpdir fixture vault. Verify
 * stdout table output, --write side effect, exit codes.
 */
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

const cliPath = fileURLToPath(new URL('../../src/master/cli.ts', import.meta.url))

const tmpRoots: string[] = []
afterEach(async () => {
  for (const dir of tmpRoots.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'msp-master-cli-'))
  tmpRoots.push(root)
  return root
}

interface GenesisFixture {
  readonly id: string
  readonly cognitive?: string[]
  readonly algo?: string[]
  readonly runbook?: string[]
  readonly concept?: string[]
  readonly params?: string[]
  readonly tags?: string[]
}

async function writeGenesisFixture(
  root: string,
  fx: GenesisFixture,
): Promise<void> {
  const dir = join(root, 'gks', 'genesis')
  await mkdir(dir, { recursive: true })
  const lines = [
    '---',
    `id: ${fx.id}`,
    'phase: 0',
    'type: genesis',
    'status: draft',
    'tier: genesis',
    'source_type: axiomatic',
    'vault_id: default',
    `title: ${fx.id}`,
  ]
  if (fx.tags && fx.tags.length > 0) {
    lines.push('tags:')
    for (const t of fx.tags) lines.push(`  - ${t}`)
  }
  lines.push('created_at: 2026-05-14T10:00:00.000+07:00')
  lines.push('members:')
  lines.push('  core:')
  for (const key of ['cognitive', 'algo', 'runbook', 'concept', 'params'] as const) {
    const list = fx[key] ?? []
    if (list.length === 0) {
      lines.push(`    ${key}: []`)
    } else {
      lines.push(`    ${key}:`)
      for (const id of list) lines.push(`      - ${id}`)
    }
  }
  lines.push('---')
  lines.push('')
  lines.push(`# ${fx.id}`)
  await writeFile(join(dir, `${fx.id}.md`), lines.join('\n'), 'utf8')
}

async function writeStableAtom(
  root: string,
  id: string,
  type: string,
  subdir: string,
): Promise<void> {
  const dir = join(root, 'gks', subdir)
  await mkdir(dir, { recursive: true })
  const body = [
    '---',
    `id: ${id}`,
    'phase: 1',
    `type: ${type}`,
    'status: stable',
    `title: ${id}`,
    'created_at: 2026-05-14T10:00:00.000+07:00',
    '---',
    '',
    `# ${id}`,
  ].join('\n')
  await writeFile(join(dir, `${id}.md`), body, 'utf8')
}

function runCli(args: string[]): { code: number; stdout: string; stderr: string } {
  const r = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx/esm',
      cliPath,
      ...args,
    ],
    { encoding: 'utf8' },
  )
  return { code: r.status ?? -1, stdout: r.stdout ?? '', stderr: r.stderr ?? '' }
}

describe('msp-master-propose CLI', () => {
  it('prints --help and exits 0', () => {
    const r = runCli(['--help'])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('msp-master-propose')
    expect(r.stdout).toContain('--write')
  })

  it('exits 1 when no GENESIS atoms are found under --root', async () => {
    const root = await freshRoot()
    await mkdir(join(root, 'gks'), { recursive: true })
    const r = runCli(['--root', root])
    expect(r.code).toBe(1)
    expect(r.stderr).toContain('no GENESIS atoms found')
  })

  it('prints a coverage table without writing when --write is omitted', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--PROMOTABLE',
      cognitive: ['COGNITIVE--A'],
      algo: ['ALGO--B'],
      runbook: ['RUNBOOK--C'],
      concept: ['CONCEPT--D'],
    })
    await writeStableAtom(root, 'COGNITIVE--A', 'cognitive', 'cognitive')
    await writeStableAtom(root, 'ALGO--B', 'algo', 'algo')
    await writeStableAtom(root, 'RUNBOOK--C', 'runbook', 'runbook')
    await writeStableAtom(root, 'CONCEPT--D', 'concept', 'concept')

    const r = runCli(['--root', root])
    expect(r.code).toBe(0)
    expect(r.stdout).toContain('GENESIS--PROMOTABLE')
    expect(r.stdout).toContain('cognitive')
    expect(r.stdout).toContain('promotable')
    expect(r.stdout).toMatch(/4\/5/)
    expect(r.stdout).toMatch(/\byes\b/)
    expect(r.stderr).toContain('1 promotable')
    // No inbound directory created.
    expect(existsSync(join(root, 'gks', 'inbound'))).toBe(false)
  })

  it('writes a .proposal.md to gks/inbound/ when --write is set', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--FULL',
      cognitive: ['COGNITIVE--A'],
      algo: ['ALGO--B'],
      runbook: ['RUNBOOK--C'],
      concept: ['CONCEPT--D'],
      params: ['PARAMS--E'],
    })
    await writeStableAtom(root, 'COGNITIVE--A', 'cognitive', 'cognitive')
    await writeStableAtom(root, 'ALGO--B', 'algo', 'algo')
    await writeStableAtom(root, 'RUNBOOK--C', 'runbook', 'runbook')
    await writeStableAtom(root, 'CONCEPT--D', 'concept', 'concept')
    await writeStableAtom(root, 'PARAMS--E', 'params', 'params')

    const r = runCli(['--root', root, '--write'])
    expect(r.code).toBe(0)
    expect(r.stderr).toContain('1 proposal(s) written')

    const proposalPath = join(root, 'gks', 'inbound', 'MASTER--FULL.proposal.md')
    expect(existsSync(proposalPath)).toBe(true)
    const content = await readFile(proposalPath, 'utf8')
    expect(content).toContain('id: MASTER--FULL')
    expect(content).toContain('type: master')
    expect(content).toContain('promoted_from: GENESIS--FULL')
    expect(content).toContain('## Intent')
  })

  it('writes no proposal for a non-promotable block (3/5)', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--SPARSE',
      cognitive: ['COGNITIVE--A'],
      algo: ['ALGO--B'],
      runbook: ['RUNBOOK--C'],
      // concept + params missing
    })
    await writeStableAtom(root, 'COGNITIVE--A', 'cognitive', 'cognitive')
    await writeStableAtom(root, 'ALGO--B', 'algo', 'algo')
    await writeStableAtom(root, 'RUNBOOK--C', 'runbook', 'runbook')

    const r = runCli(['--root', root, '--write'])
    expect(r.code).toBe(0)
    expect(r.stderr).toContain('0 proposal(s) written')
    // Inbound is created (mkdir runs unconditionally with --write), but empty.
    const inboundDir = join(root, 'gks', 'inbound')
    expect(existsSync(inboundDir)).toBe(true)
    expect(
      existsSync(join(inboundDir, 'MASTER--SPARSE.proposal.md')),
    ).toBe(false)
  })
})
