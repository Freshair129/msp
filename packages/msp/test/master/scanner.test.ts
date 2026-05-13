/**
 * Tests for `src/master/scanner.ts`. Uses tmpdir fixtures.
 */
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { findGenesisBlocks } from '../../src/master/scanner.js'

const tmpRoots: string[] = []
afterEach(async () => {
  for (const dir of tmpRoots.splice(0)) {
    await rm(dir, { recursive: true, force: true })
  }
})

async function freshRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'msp-master-scanner-'))
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
  readonly title?: string
  readonly tags?: string[]
}

async function writeGenesisFixture(
  root: string,
  fx: GenesisFixture,
  subdir = 'gks/genesis',
): Promise<void> {
  const dir = join(root, subdir)
  await mkdir(dir, { recursive: true })
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${fx.id}`)
  lines.push('phase: 0')
  lines.push('type: genesis')
  lines.push('status: draft')
  lines.push('tier: genesis')
  lines.push('source_type: axiomatic')
  lines.push('vault_id: default')
  lines.push(`title: ${fx.title ?? fx.id}`)
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

async function writeAtom(
  root: string,
  subdir: string,
  filename: string,
  frontmatter: Record<string, unknown>,
): Promise<void> {
  const dir = join(root, subdir)
  await mkdir(dir, { recursive: true })
  const lines: string[] = ['---']
  for (const [k, v] of Object.entries(frontmatter)) {
    lines.push(`${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
  }
  lines.push('---')
  lines.push('')
  lines.push('# body')
  await writeFile(join(dir, filename), lines.join('\n'), 'utf8')
}

describe('findGenesisBlocks', () => {
  it('returns an empty list when the vault has no GENESIS atoms', async () => {
    const root = await freshRoot()
    await mkdir(join(root, 'gks', 'concept'), { recursive: true })
    const blocks = await findGenesisBlocks(root)
    expect(blocks).toEqual([])
  })

  it('finds a single Genesis manifest in gks/genesis/ and parses its members', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--IDENTITY-ENGINE',
      cognitive: ['COGNITIVE--EGO-DEATH'],
      algo: ['ALGO--IDENTITY-RESOLUTION'],
      runbook: ['RUNBOOK--IDENTITY-MIGRATION'],
      concept: ['CONCEPT--IDENTITY-LAYER'],
      params: ['PARAMS--IDENTITY-PROFILE-DEFAULTS'],
      title: 'Identity Engine',
      tags: ['msp', 'identity', 'manifest'],
    })

    const blocks = await findGenesisBlocks(root)
    expect(blocks).toHaveLength(1)
    const b = blocks[0]!
    expect(b.genesisId).toBe('GENESIS--IDENTITY-ENGINE')
    expect(b.title).toBe('Identity Engine')
    expect(b.tags).toEqual(['msp', 'identity', 'manifest'])
    expect(b.members).toEqual([
      'COGNITIVE--EGO-DEATH',
      'ALGO--IDENTITY-RESOLUTION',
      'RUNBOOK--IDENTITY-MIGRATION',
      'CONCEPT--IDENTITY-LAYER',
      'PARAMS--IDENTITY-PROFILE-DEFAULTS',
    ])
    expect(b.manifestPath.endsWith('GENESIS--IDENTITY-ENGINE.md')).toBe(true)
  })

  it('preserves the SPEC order of core dimensions in the flattened members list', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--ORDER',
      // Two ids per dimension to also test order preservation within each.
      cognitive: ['COGNITIVE--A', 'COGNITIVE--B'],
      algo: ['ALGO--X'],
      runbook: [],
      concept: ['CONCEPT--Z'],
      params: ['PARAMS--P'],
    })
    const blocks = await findGenesisBlocks(root)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.members).toEqual([
      'COGNITIVE--A',
      'COGNITIVE--B',
      'ALGO--X',
      'CONCEPT--Z',
      'PARAMS--P',
    ])
  })

  it('skips files whose frontmatter is malformed', async () => {
    const root = await freshRoot()
    const dir = join(root, 'gks', 'genesis')
    await mkdir(dir, { recursive: true })
    // Missing closing --- → unparseable.
    await writeFile(
      join(dir, 'GENESIS--BROKEN.md'),
      '---\nid: GENESIS--BROKEN\ntype: genesis\n# never closes\n',
      'utf8',
    )
    await writeGenesisFixture(root, {
      id: 'GENESIS--OK',
      concept: ['CONCEPT--X'],
    })
    const blocks = await findGenesisBlocks(root)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.genesisId).toBe('GENESIS--OK')
  })

  it('skips files with type !== genesis even if filename starts with GENESIS', async () => {
    const root = await freshRoot()
    await writeAtom(root, 'gks/framework', 'GENESIS--LOOKS-LIKE.md', {
      id: 'GENESIS--LOOKS-LIKE',
      phase: 0,
      type: 'framework',
      status: 'draft',
      title: 'Mislabeled',
      created_at: '2026-05-14T10:00:00.000+07:00',
    })
    await writeAtom(root, 'gks/concept', 'CONCEPT--ALSO-NOT.md', {
      id: 'CONCEPT--ALSO-NOT',
      phase: 1,
      type: 'concept',
      status: 'draft',
      title: 'Definitely not a manifest',
      created_at: '2026-05-14T10:00:00.000+07:00',
    })
    const blocks = await findGenesisBlocks(root)
    expect(blocks).toEqual([])
  })

  it('discovers Genesis manifests under packages/<pkg>/gks/genesis/', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--PKG-LOCAL',
      concept: ['CONCEPT--A'],
    }, 'packages/msp/gks/genesis')
    const blocks = await findGenesisBlocks(root)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.genesisId).toBe('GENESIS--PKG-LOCAL')
  })

  it('returns blocks sorted by genesisId for determinism', async () => {
    const root = await freshRoot()
    await writeGenesisFixture(root, { id: 'GENESIS--ZEBRA', concept: ['CONCEPT--Z'] })
    await writeGenesisFixture(root, { id: 'GENESIS--ALPHA', concept: ['CONCEPT--A'] })
    await writeGenesisFixture(root, { id: 'GENESIS--MID', concept: ['CONCEPT--M'] })
    const blocks = await findGenesisBlocks(root)
    expect(blocks.map((b) => b.genesisId)).toEqual([
      'GENESIS--ALPHA',
      'GENESIS--MID',
      'GENESIS--ZEBRA',
    ])
  })

  it('de-dupes manifests reachable via multiple search roots', async () => {
    // A manifest in gks/genesis/ is also reachable via the gks/ recursive
    // fallback root; the scanner must not return it twice.
    const root = await freshRoot()
    await writeGenesisFixture(root, {
      id: 'GENESIS--DEDUPE',
      concept: ['CONCEPT--X'],
    })
    const blocks = await findGenesisBlocks(root)
    expect(blocks.filter((b) => b.genesisId === 'GENESIS--DEDUPE')).toHaveLength(1)
  })
})
