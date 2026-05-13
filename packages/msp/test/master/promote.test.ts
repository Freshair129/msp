/**
 * Tests for `src/master/promote.ts`. Uses `lookupOverride` to avoid disk I/O.
 */
import { describe, expect, it } from 'vitest'

import type { AtomLookup, AtomRecord } from '../../src/master/dimensions.js'
import {
  proposePromotion,
  renderProposalDocument,
} from '../../src/master/promote.js'
import type { GenesisBlock } from '../../src/master/scanner.js'

function makeBlock(overrides: Partial<GenesisBlock> = {}): GenesisBlock {
  return {
    genesisId: 'GENESIS--TEST-BLOCK',
    manifestPath: '/tmp/GENESIS--TEST-BLOCK.md',
    members: [],
    title: 'Test Block',
    tags: ['msp', 'manifest'],
    ...overrides,
  }
}

function lookupFrom(records: Record<string, Partial<AtomRecord>>): AtomLookup {
  return (id: string) => {
    const r = records[id]
    if (!r) return null
    return { id, type: r.type ?? 'unknown', status: r.status ?? 'draft' }
  }
}

const NOW = new Date('2026-05-14T03:00:00.000Z') // ICT 10:00

describe('proposePromotion', () => {
  it('returns promotable=false with a reason when fewer than 4 dimensions are filled', async () => {
    const block = makeBlock({
      members: ['COGNITIVE--A', 'ALGO--B'],
    })
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
    })
    const result = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: lookup,
      now: NOW,
    })
    expect(result.promotable).toBe(false)
    expect(result.reason).toContain('2/5')
    expect(result.proposed_master_id).toBeUndefined()
    expect(result.proposed_frontmatter).toBeUndefined()
    expect(result.proposed_body).toBeUndefined()
  })

  it('returns a full proposal when ≥4 dimensions are filled with stable members', async () => {
    const block = makeBlock({
      genesisId: 'GENESIS--IDENTITY-ENGINE',
      title: 'Identity Engine',
      tags: ['msp', 'identity', 'manifest'],
      members: [
        'COGNITIVE--EGO-DEATH',
        'ALGO--IDENTITY-RESOLUTION',
        'RUNBOOK--IDENTITY-MIGRATION',
        'CONCEPT--IDENTITY-LAYER',
      ],
    })
    const lookup = lookupFrom({
      'COGNITIVE--EGO-DEATH': { status: 'stable' },
      'ALGO--IDENTITY-RESOLUTION': { status: 'stable' },
      'RUNBOOK--IDENTITY-MIGRATION': { status: 'stable' },
      'CONCEPT--IDENTITY-LAYER': { status: 'stable' },
    })
    const result = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: lookup,
      now: NOW,
    })
    expect(result.promotable).toBe(true)
    expect(result.proposed_master_id).toBe('MASTER--IDENTITY-ENGINE')

    // Frontmatter contains the canonical Master keys.
    const fm = result.proposed_frontmatter ?? ''
    expect(fm).toContain('id: MASTER--IDENTITY-ENGINE')
    expect(fm).toContain('type: master')
    expect(fm).toContain('tier: master')
    expect(fm).toContain('promoted_from: GENESIS--IDENTITY-ENGINE')
    expect(fm).toContain('promotion_adr: ADR--MASTER-PROMOTION-IDENTITY-ENGINE')
    expect(fm).toContain('promoted_at: 2026-05-14T03:00:00.000Z')

    // Body contains the 5 canonical sections.
    const body = result.proposed_body ?? ''
    expect(body).toContain('## Intent')
    expect(body).toContain('## Why')
    expect(body).toContain('## Directives')
    expect(body).toContain('## Apply when')
    expect(body).toContain('## Conflicts with')
    expect(body).toContain('GENESIS--IDENTITY-ENGINE')
  })

  it('drops the genesis/manifest tags from the proposed Master tags', async () => {
    const block = makeBlock({
      genesisId: 'GENESIS--FOO',
      tags: ['msp', 'manifest', 'genesis', 'something-specific'],
      members: [
        'COGNITIVE--A',
        'ALGO--B',
        'RUNBOOK--C',
        'CONCEPT--D',
      ],
    })
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
    })
    const result = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: lookup,
      now: NOW,
    })
    const fm = result.proposed_frontmatter ?? ''
    expect(fm).toContain('  - master')
    expect(fm).toContain('  - promotion')
    expect(fm).toContain('  - something-specific')
    expect(fm).not.toMatch(/^\s*-\s*manifest\s*$/m)
    expect(fm).not.toMatch(/^\s*-\s*genesis\s*$/m)
  })

  it('reports `unresolved` dimensions correctly in the reason text', async () => {
    const block = makeBlock({
      members: ['COGNITIVE--A'],
    })
    const lookup = lookupFrom({}) // unresolved
    const result = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: lookup,
      now: NOW,
    })
    expect(result.promotable).toBe(false)
    expect(result.reason).toContain('0/5')
    expect(result.coverage.unresolved).toContain('COGNITIVE--A')
  })

  it('renders a non-empty .proposal.md document via renderProposalDocument', async () => {
    const block = makeBlock({
      genesisId: 'GENESIS--EXAMPLE',
      members: [
        'COGNITIVE--A',
        'ALGO--B',
        'RUNBOOK--C',
        'CONCEPT--D',
        'PARAMS--E',
      ],
    })
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
      'PARAMS--E': { status: 'stable' },
    })
    const proposal = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: lookup,
      now: NOW,
    })
    const doc = renderProposalDocument(proposal)
    expect(doc.startsWith('---\n')).toBe(true)
    expect(doc).toContain('id: MASTER--EXAMPLE')
    expect(doc).toContain('## Intent')
  })

  it('throws when renderProposalDocument is called on a non-promotable proposal', async () => {
    const block = makeBlock({ members: [] })
    const proposal = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: () => null,
      now: NOW,
    })
    expect(proposal.promotable).toBe(false)
    expect(() => renderProposalDocument(proposal)).toThrow(/non-promotable/)
  })

  it('produces ICT-formatted created_at and ISO-Z promoted_at', async () => {
    const block = makeBlock({
      members: [
        'COGNITIVE--A',
        'ALGO--B',
        'RUNBOOK--C',
        'CONCEPT--D',
      ],
    })
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
    })
    const result = await proposePromotion(block, '/tmp/fakeroot', {
      lookupOverride: lookup,
      now: NOW,
    })
    const fm = result.proposed_frontmatter ?? ''
    // promoted_at uses ISO UTC (Z suffix).
    expect(fm).toMatch(/promoted_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/)
    // created_at uses ICT (+07:00).
    expect(fm).toMatch(/created_at: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+07:00/)
  })
})
