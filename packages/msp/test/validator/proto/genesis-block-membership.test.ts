import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import predicate, {
  CORE_ROLES,
  ID_PATTERN,
  ROLE_TYPE,
  STATUS_ORDER,
  checkManifest,
  collectMembers,
  parseFrontmatter,
  statusRank,
} from '../../../src/validator/proto/genesis-block-membership.js'
import type { AtomicIndexEntry } from '../../../src/validator/types.js'

function entry(id: string, type: string, status = 'stable'): AtomicIndexEntry {
  return { id, type, status, phase: 0, vault_id: 'default', path: `${type}/${id}.md` }
}

function indexOf(...entries: AtomicIndexEntry[]): Map<string, AtomicIndexEntry> {
  return new Map(entries.map((e) => [e.id, e]))
}

/** A fully-valid 5-dim core member set + the index that resolves it. */
function happyCore() {
  const members = {
    cognitive: ['COGNITIVE--LENS'],
    algo: ['ALGO--STEP'],
    runbook: ['RUNBOOK--SOP'],
    concept: ['CONCEPT--WHY'],
    params: ['PARAMS--TUNABLES'],
  }
  const index = indexOf(
    entry('COGNITIVE--LENS', 'cognitive'),
    entry('ALGO--STEP', 'algo'),
    entry('RUNBOOK--SOP', 'runbook'),
    entry('CONCEPT--WHY', 'concept'),
    entry('PARAMS--TUNABLES', 'params'),
  )
  return { members, index }
}

describe('PROTO--GENESIS-BLOCK-MEMBERSHIP helpers', () => {
  it('CORE_ROLES is the closed five-dimension set', () => {
    expect([...CORE_ROLES]).toEqual(['cognitive', 'algo', 'runbook', 'concept', 'params'])
  })

  it('ROLE_TYPE maps every core role to its atom type', () => {
    for (const role of CORE_ROLES) expect(ROLE_TYPE[role]).toBe(role)
  })

  it('STATUS_ORDER is ascending stub→stable; statusRank reflects it', () => {
    expect([...STATUS_ORDER]).toEqual(['stub', 'raw', 'draft', 'active', 'stable'])
    expect(statusRank('draft')).toBeLessThan(statusRank('stable'))
    expect(statusRank('not-a-status')).toBe(-1)
  })

  it('ID_PATTERN accepts canonical ids and rejects malformed ones', () => {
    expect(ID_PATTERN.test('COGNITIVE--EGO-DEATH')).toBe(true)
    expect(ID_PATTERN.test('cognitive--lower')).toBe(false)
  })

  it('parseFrontmatter pulls the leading YAML block', () => {
    const fm = parseFrontmatter('---\nid: GENESIS--X\nstatus: draft\n---\n# body\n')
    expect(fm?.id).toBe('GENESIS--X')
    expect(fm?.status).toBe('draft')
  })

  it('parseFrontmatter returns null when there is no frontmatter', () => {
    expect(parseFrontmatter('# just a body\n')).toBeNull()
  })

  it('collectMembers separates core and optional role lists', () => {
    const m = collectMembers({
      core: { cognitive: ['COGNITIVE--A'], algo: ['ALGO--B'] },
      optional: { guard: ['GUARD--C'] },
    })
    expect(m.core.cognitive).toEqual(['COGNITIVE--A'])
    expect(m.optional.guard).toEqual(['GUARD--C'])
  })
})

describe('checkManifest — block-field presence', () => {
  it('passes a well-formed manifest with all five core dimensions filled', () => {
    const { members, index } = happyCore()
    const v = checkManifest(
      'GENESIS--HAPPY',
      { status: 'stable', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(v).toEqual([])
  })

  it('flags missing members, manifest_version, and daci.driver', () => {
    const v = checkManifest('GENESIS--BARE', { status: 'draft' }, new Map())
    const msgs = v.map((x) => x.message).join('\n')
    expect(msgs).toMatch(/missing required `members:`/)
    expect(msgs).toMatch(/missing required `manifest_version:`/)
    expect(msgs).toMatch(/missing required `daci\.driver:`/)
    expect(v.every((x) => x.severity === 'error')).toBe(true)
  })
})

describe('checkManifest — five-dimension core', () => {
  it('flags an incomplete core (missing runbook + params)', () => {
    const index = indexOf(
      entry('COGNITIVE--LENS', 'cognitive'),
      entry('ALGO--STEP', 'algo'),
      entry('CONCEPT--WHY', 'concept'),
    )
    const v = checkManifest(
      'GENESIS--PARTIAL',
      {
        status: 'stable',
        manifest_version: '0.1.0',
        members: {
          core: {
            cognitive: ['COGNITIVE--LENS'],
            algo: ['ALGO--STEP'],
            concept: ['CONCEPT--WHY'],
          },
        },
        daci: { driver: 'MOD--OWN' },
      },
      index,
    )
    const msgs = v.map((x) => x.message).join('\n')
    expect(msgs).toMatch(/members\.core\.runbook must list/)
    expect(msgs).toMatch(/members\.core\.params must list/)
    expect(msgs).not.toMatch(/members\.core\.cognitive must list/)
  })
})

describe('checkManifest — aggregation grammar', () => {
  it('flags a dangling member id', () => {
    const { members, index } = happyCore()
    members.algo = ['ALGO--GHOST']
    const v = checkManifest(
      'GENESIS--DANGLING',
      { status: 'stable', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(v.some((x) => /ALGO--GHOST' does not resolve/.test(x.message))).toBe(true)
  })

  it('flags a member whose type does not match its role', () => {
    const { members, index } = happyCore()
    // Put a concept atom under the algo role.
    members.algo = ['CONCEPT--WHY']
    const v = checkManifest(
      'GENESIS--MISTYPED',
      { status: 'stable', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(
      v.some((x) => /members\.algo entry 'CONCEPT--WHY' has type 'concept', expected 'algo'/.test(x.message)),
    ).toBe(true)
  })

  it('flags a malformed (non-canonical) member id', () => {
    const { members, index } = happyCore()
    members.params = ['params--lower']
    const v = checkManifest(
      'GENESIS--BADID',
      { status: 'stable', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(v.some((x) => /'params--lower' is not a canonical atom id/.test(x.message))).toBe(true)
  })

  it('checks optional-role members too', () => {
    const { members, index } = happyCore()
    index.set('GUARD--SCHEMA', entry('GUARD--SCHEMA', 'concept')) // wrong type
    const v = checkManifest(
      'GENESIS--OPT',
      {
        status: 'stable',
        manifest_version: '1.0.0',
        members: { core: members, optional: { guard: ['GUARD--SCHEMA'] } },
        daci: { driver: 'MOD--OWN' },
      },
      index,
    )
    expect(
      v.some((x) => /members\.guard entry 'GUARD--SCHEMA' has type 'concept', expected 'guard'/.test(x.message)),
    ).toBe(true)
  })
})

describe('checkManifest — status cascade (SPEC §4.2)', () => {
  it('flags a block claiming a status above min(member statuses)', () => {
    const { members, index } = happyCore()
    // One member is only draft — block must not claim stable.
    index.set('ALGO--STEP', entry('ALGO--STEP', 'algo', 'draft'))
    const v = checkManifest(
      'GENESIS--OVERCLAIM',
      { status: 'stable', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(
      v.some((x) => /must equal min\(member statuses\) = 'draft'/.test(x.message)),
    ).toBe(true)
  })

  it('passes when block status equals min(member statuses)', () => {
    const { members, index } = happyCore()
    index.set('ALGO--STEP', entry('ALGO--STEP', 'algo', 'draft'))
    const v = checkManifest(
      'GENESIS--HONEST',
      { status: 'draft', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(v).toEqual([])
  })

  it('forces a terminal status when a member is deprecated', () => {
    const { members, index } = happyCore()
    index.set('RUNBOOK--SOP', entry('RUNBOOK--SOP', 'runbook', 'deprecated'))
    const v = checkManifest(
      'GENESIS--STALEMEMBER',
      { status: 'stable', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(v.some((x) => /forces the block to a terminal status/.test(x.message))).toBe(true)
  })

  it('accepts a block that propagated to deprecated', () => {
    const { members, index } = happyCore()
    index.set('RUNBOOK--SOP', entry('RUNBOOK--SOP', 'runbook', 'deprecated'))
    const v = checkManifest(
      'GENESIS--PROPAGATED',
      { status: 'deprecated', manifest_version: '1.0.0', members: { core: members }, daci: { driver: 'MOD--OWN' } },
      index,
    )
    expect(v).toEqual([])
  })
})

describe('PROTO--GENESIS-BLOCK-MEMBERSHIP predicate', () => {
  let repoRoot: string

  beforeEach(async () => {
    repoRoot = await mkdtemp(join(tmpdir(), 'genesis-membership-'))
    await mkdir(join(repoRoot, 'gks/genesis'), { recursive: true })
  })

  afterEach(async () => {
    await rm(repoRoot, { recursive: true, force: true })
  })

  it('passes trivially when there are no genesis manifest atoms', async () => {
    const result = await predicate({
      atomicIndex: [entry('CONCEPT--FOO', 'concept'), entry('ADR--BAR', 'adr')],
      repoRoot,
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('reads a genesis manifest from disk and validates its members', async () => {
    const id = 'GENESIS--FROM-DISK'
    const manifest = [
      '---',
      `id: ${id}`,
      'type: genesis',
      'status: stable',
      'manifest_version: 1.0.0',
      'members:',
      '  core:',
      '    cognitive: [COGNITIVE--LENS]',
      '    algo: [ALGO--STEP]',
      '    runbook: [RUNBOOK--SOP]',
      '    concept: [CONCEPT--WHY]',
      '    params: [PARAMS--TUNABLES]',
      'daci:',
      '  driver: MOD--OWN',
      '---',
      '# GENESIS — From Disk',
      '',
    ].join('\n')
    await writeFile(join(repoRoot, 'gks/genesis', `${id}.md`), manifest, 'utf8')

    const { index } = happyCore()
    const result = await predicate({
      atomicIndex: [
        { id, type: 'genesis', status: 'stable', phase: 0, vault_id: 'default', path: `genesis/${id}.md` },
        ...index.values(),
      ],
      repoRoot,
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('flags an error when the on-disk manifest has an incomplete core', async () => {
    const id = 'GENESIS--BROKEN'
    const manifest = [
      '---',
      `id: ${id}`,
      'type: genesis',
      'status: draft',
      'manifest_version: 0.1.0',
      'members:',
      '  core:',
      '    cognitive: [COGNITIVE--LENS]',
      'daci:',
      '  driver: MOD--OWN',
      '---',
      '# GENESIS — Broken',
      '',
    ].join('\n')
    await writeFile(join(repoRoot, 'gks/genesis', `${id}.md`), manifest, 'utf8')

    const result = await predicate({
      atomicIndex: [
        { id, type: 'genesis', status: 'draft', phase: 0, vault_id: 'default', path: `genesis/${id}.md` },
        entry('COGNITIVE--LENS', 'cognitive'),
      ],
      repoRoot,
    })
    expect(result.ok).toBe(false)
    expect(result.violations.some((v) => /members\.core\.algo must list/.test(v.message))).toBe(true)
    expect(result.violations.every((v) => v.severity === 'error')).toBe(true)
  })

  it('flags an error when the manifest file cannot be read', async () => {
    const id = 'GENESIS--MISSING-FILE'
    const result = await predicate({
      atomicIndex: [
        { id, type: 'genesis', status: 'draft', phase: 0, vault_id: 'default', path: `genesis/${id}.md` },
      ],
      repoRoot,
    })
    expect(result.ok).toBe(false)
    expect(result.violations[0]!.message).toMatch(/cannot read manifest/)
  })
})
