import { describe, expect, it } from 'vitest'

import predicate from '../../../src/validator/proto/scaling-level-gate.js'
import type { AtomicIndexEntry } from '../../../src/validator/types.js'

function feat(
  id: string,
  crosslinks: Record<string, string[]>,
  extra: Record<string, unknown> = {},
): AtomicIndexEntry {
  return {
    id,
    phase: 2,
    type: 'feat',
    status: 'stable',
    vault_id: 'default',
    path: `feat/${id}.md`,
    crosslinks,
    ...extra,
  } as AtomicIndexEntry
}

function atom(
  id: string,
  type: string,
  crosslinks: Record<string, string[]> = {},
): AtomicIndexEntry {
  return {
    id,
    phase: 2,
    type,
    status: 'stable',
    vault_id: 'default',
    path: `${type}/${id}.md`,
    crosslinks,
  } as AtomicIndexEntry
}

describe('PROTO--SCALING-LEVEL-GATE predicate', () => {
  it('passes when a FEAT has the full L2 chain (CONCEPT + ADR)', async () => {
    const index = [
      feat('FEAT--FOO', {
        implements: ['ADR--FOO'],
        references: ['CONCEPT--FOO'],
      }),
      atom('ADR--FOO', 'adr'),
      atom('CONCEPT--FOO', 'concept'),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('warns (grandfathered) when an L3 FEAT (BLUEPRINT linked) is missing BLUEPRINT chain coverage', async () => {
    // FEAT links to a BLUEPRINT (so implied level = L3) but the BLUEPRINT id
    // doesn't resolve and there's no BLUEPRINT backlink — the auto-classifier
    // therefore lands in L3 but still has only CONCEPT + ADR satisfied.
    // We simulate the inverse: FEAT references CONCEPT + ADR only, but a
    // BLUEPRINT atom in the index already references the FEAT — so expected
    // is L3 yet hasBlueprint is true → passes.
    // Instead test the missing case: declare level: L3 explicitly.
    //
    // No `created_at` set on the fixture FEAT, so it's pre-cutoff →
    // grandfathered to `severity: warning`. ok remains true (warnings don't
    // block CI per the post-2026-05-12 hardening rule).
    const index = [
      feat(
        'FEAT--BAR',
        {
          implements: ['ADR--BAR'],
          references: ['CONCEPT--BAR'],
        },
        { level: 'L3' },
      ),
      atom('ADR--BAR', 'adr'),
      atom('CONCEPT--BAR', 'concept'),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true) // grandfathered — warning doesn't fail predicate
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]!.atomId).toBe('FEAT--BAR')
    expect(result.violations[0]!.severity).toBe('warning')
    expect(result.violations[0]!.message).toMatch(/BLUEPRINT/)
    expect(result.violations[0]!.message).toMatch(/L3/)
  })

  it('warns (grandfathered) when a default-L2 FEAT is missing CONCEPT or ADR', async () => {
    const index = [
      feat('FEAT--ORPHAN', {
        references: ['CONCEPT--ORPHAN'],
        // no ADR linked
      }),
      atom('CONCEPT--ORPHAN', 'concept'),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true) // grandfathered — warning doesn't fail predicate
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]!.severity).toBe('warning')
    expect(result.violations[0]!.message).toMatch(/ADR/)
  })

  it('errors (hard-enforced) when a FEAT created_at >= cutoff is missing ADR', async () => {
    // FEATs with created_at on/after 2026-05-12 must satisfy the chain rule;
    // grandfather clause does not protect them. Severity becomes 'error',
    // ok = false (CI fails).
    const index = [
      feat(
        'FEAT--POST-CUTOFF',
        {
          references: ['CONCEPT--POST-CUTOFF'],
          // no ADR linked
        },
        { created_at: '2026-05-13T00:00:00.000Z' },
      ),
      atom('CONCEPT--POST-CUTOFF', 'concept'),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(false) // hard-enforced — error fails predicate
    expect(result.violations).toHaveLength(1)
    expect(result.violations[0]!.severity).toBe('error')
    expect(result.violations[0]!.atomId).toBe('FEAT--POST-CUTOFF')
    expect(result.violations[0]!.message).toMatch(/ADR/)
  })

  it('skips superseded FEATs (no chain check applies to historical atoms)', async () => {
    const index = [
      feat(
        'FEAT--SUPERSEDED',
        {
          // intentionally no chain — would normally trigger violation
        },
        {
          status: 'superseded',
          created_at: '2026-06-01T00:00:00.000Z', // post-cutoff but historical
        },
      ),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('respects level_override: "L1" — no chain expectation', async () => {
    const index = [
      feat(
        'FEAT--TINY',
        {
          // no CONCEPT, no ADR, no BLUEPRINT
        },
        { level_override: 'L1' },
      ),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('vacuously passes when no FEAT atoms exist in the index', async () => {
    const index = [
      atom('CONCEPT--ALONE', 'concept'),
      atom('ADR--ALONE', 'adr'),
      atom('FRAME--ALONE', 'frame'),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('passes on an empty index', async () => {
    const result = await predicate({
      atomicIndex: [],
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })

  it('treats a BLUEPRINT backlink as satisfying the L3 BLUEPRINT requirement', async () => {
    const index = [
      feat(
        'FEAT--LINKED',
        {
          implements: ['ADR--LINKED'],
          references: ['CONCEPT--LINKED'],
        },
        { level: 'L3' },
      ),
      atom('ADR--LINKED', 'adr'),
      atom('CONCEPT--LINKED', 'concept'),
      // BLUEPRINT references the FEAT (the typical real-world shape).
      atom('BLUEPRINT--LINKED', 'blueprint', {
        references: ['FEAT--LINKED'],
      }),
    ]
    const result = await predicate({
      atomicIndex: index,
      repoRoot: '/tmp/anything',
    })
    expect(result.ok).toBe(true)
    expect(result.violations).toEqual([])
  })
})
