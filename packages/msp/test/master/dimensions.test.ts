/**
 * Tests for `src/master/dimensions.ts`. Pure-function tests — no I/O.
 *
 * Coverage targets (per BLUEPRINT--MASTER-PROMOTION-PIPELINE § Test 5.1):
 * each dimension in isolation, unknown prefix filtered, unresolved lookup,
 * non-stable members not counted, exactly-4 promotable, exactly-3 not,
 * all-5, empty input, duplicates.
 */
import { describe, expect, it } from 'vitest'

import {
  analyzeDimensions,
  classifyById,
  type AtomLookup,
  type AtomRecord,
} from '../../src/master/dimensions.js'

/**
 * Build a lookup from a flat record map. Ids not in the map resolve to `null`.
 */
function lookupFrom(records: Record<string, Partial<AtomRecord>>): AtomLookup {
  return (id: string) => {
    const r = records[id]
    if (!r) return null
    return {
      id,
      type: r.type ?? 'unknown',
      status: r.status ?? 'draft',
    }
  }
}

describe('classifyById', () => {
  it('maps each core prefix to its dimension key', () => {
    expect(classifyById('COGNITIVE--EGO-DEATH')).toBe('cognitive')
    expect(classifyById('ALGO--SIM-ANNEAL')).toBe('algo')
    expect(classifyById('RUNBOOK--ONBOARD')).toBe('runbook')
    expect(classifyById('CONCEPT--IDENTITY')).toBe('concept')
    expect(classifyById('PARAMS--ENGINE-DEFAULTS')).toBe('params')
  })

  it('returns null for non-core prefixes', () => {
    expect(classifyById('FRAMEWORK--AUTHORITY-MATRIX')).toBeNull()
    expect(classifyById('GENESIS--IDENTITY-ENGINE')).toBeNull()
    expect(classifyById('GUARD--SCHEMA')).toBeNull()
    expect(classifyById('STACK--NODE')).toBeNull()
    expect(classifyById('SAFETY--PII')).toBeNull()
    expect(classifyById('SPEC--MANIFEST')).toBeNull()
    expect(classifyById('MOD--IDENTITY')).toBeNull()
    expect(classifyById('PROTOCOL--A2A')).toBeNull()
    expect(classifyById('NOT-AN-ATOM')).toBeNull()
    expect(classifyById('')).toBeNull()
  })
})

describe('analyzeDimensions', () => {
  it('returns an empty coverage with promotable=false for an empty input', () => {
    const cov = analyzeDimensions([], () => null)
    expect(cov.cognitive).toEqual([])
    expect(cov.algo).toEqual([])
    expect(cov.runbook).toEqual([])
    expect(cov.concept).toEqual([])
    expect(cov.params).toEqual([])
    expect(cov.filled_count).toBe(0)
    expect(cov.promotable).toBe(false)
    expect(cov.unresolved).toEqual([])
    expect(cov.not_stable).toEqual([])
    expect(cov.unknown_prefix).toEqual([])
  })

  it('classifies each of the 5 dimensions in isolation', () => {
    const ids = [
      'COGNITIVE--A',
      'ALGO--B',
      'RUNBOOK--C',
      'CONCEPT--D',
      'PARAMS--E',
    ]
    const lookup = lookupFrom({
      'COGNITIVE--A': { type: 'cognitive', status: 'stable' },
      'ALGO--B': { type: 'algo', status: 'stable' },
      'RUNBOOK--C': { type: 'runbook', status: 'stable' },
      'CONCEPT--D': { type: 'concept', status: 'stable' },
      'PARAMS--E': { type: 'params', status: 'stable' },
    })
    const cov = analyzeDimensions(ids, lookup)
    expect(cov.cognitive).toEqual(['COGNITIVE--A'])
    expect(cov.algo).toEqual(['ALGO--B'])
    expect(cov.runbook).toEqual(['RUNBOOK--C'])
    expect(cov.concept).toEqual(['CONCEPT--D'])
    expect(cov.params).toEqual(['PARAMS--E'])
    expect(cov.filled_count).toBe(5)
    expect(cov.promotable).toBe(true)
  })

  it('reports promotable=true when exactly 4 dimensions are filled with stable members', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
      // PARAMS--E omitted — only 4/5.
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'ALGO--B', 'RUNBOOK--C', 'CONCEPT--D'],
      lookup,
    )
    expect(cov.filled_count).toBe(4)
    expect(cov.promotable).toBe(true)
  })

  it('reports promotable=false when only 3 dimensions are filled', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'ALGO--B', 'RUNBOOK--C'],
      lookup,
    )
    expect(cov.filled_count).toBe(3)
    expect(cov.promotable).toBe(false)
  })

  it('does not count a draft member towards filled_count', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
      'PARAMS--E': { status: 'draft' }, // not stable
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'ALGO--B', 'RUNBOOK--C', 'CONCEPT--D', 'PARAMS--E'],
      lookup,
    )
    expect(cov.filled_count).toBe(4)
    expect(cov.promotable).toBe(true)
    expect(cov.not_stable).toContain('PARAMS--E')
    // PARAMS-- still appears under the dimension array.
    expect(cov.params).toEqual(['PARAMS--E'])
  })

  it('reports unresolved ids and excludes them from filled_count', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      // ALGO--B not in lookup → unresolved
    })
    const cov = analyzeDimensions(['COGNITIVE--A', 'ALGO--B'], lookup)
    expect(cov.unresolved).toEqual(['ALGO--B'])
    expect(cov.algo).toEqual(['ALGO--B'])
    expect(cov.filled_count).toBe(1)
  })

  it('filters ids with unknown prefix into unknown_prefix', () => {
    const lookup = lookupFrom({})
    const cov = analyzeDimensions(
      ['FRAMEWORK--X', 'GUARD--Y', 'WHATEVER-NOT-PREFIX'],
      lookup,
    )
    expect(cov.unknown_prefix).toEqual([
      'FRAMEWORK--X',
      'GUARD--Y',
      'WHATEVER-NOT-PREFIX',
    ])
    expect(cov.cognitive).toEqual([])
    expect(cov.algo).toEqual([])
    expect(cov.runbook).toEqual([])
    expect(cov.concept).toEqual([])
    expect(cov.params).toEqual([])
    expect(cov.filled_count).toBe(0)
    expect(cov.promotable).toBe(false)
  })

  it('dedupes ids within a dimension', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'COGNITIVE--A', 'COGNITIVE--A'],
      lookup,
    )
    expect(cov.cognitive).toEqual(['COGNITIVE--A'])
    expect(cov.filled_count).toBe(1)
  })

  it('counts a dimension once even if multiple stable members fill it', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'stable' },
      'COGNITIVE--B': { status: 'stable' },
      'ALGO--C': { status: 'stable' },
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'COGNITIVE--B', 'ALGO--C'],
      lookup,
    )
    expect(cov.cognitive).toEqual(['COGNITIVE--A', 'COGNITIVE--B'])
    expect(cov.filled_count).toBe(2) // cognitive + algo, not 3
  })

  it('preserves first-seen order within each dimension array', () => {
    const lookup = lookupFrom({
      'COGNITIVE--Z': { status: 'stable' },
      'COGNITIVE--A': { status: 'stable' },
      'COGNITIVE--M': { status: 'stable' },
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--Z', 'COGNITIVE--A', 'COGNITIVE--M'],
      lookup,
    )
    expect(cov.cognitive).toEqual(['COGNITIVE--Z', 'COGNITIVE--A', 'COGNITIVE--M'])
  })

  it('treats a dimension with only unresolved members as unfilled', () => {
    const lookup = lookupFrom({
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
      'PARAMS--E': { status: 'stable' },
      // COGNITIVE--A intentionally absent
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'ALGO--B', 'RUNBOOK--C', 'CONCEPT--D', 'PARAMS--E'],
      lookup,
    )
    expect(cov.cognitive).toEqual(['COGNITIVE--A'])
    expect(cov.unresolved).toContain('COGNITIVE--A')
    expect(cov.filled_count).toBe(4) // still promotable via 4 other dims
    expect(cov.promotable).toBe(true)
  })

  it('treats a dimension with only draft members as unfilled', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'draft' },
      'ALGO--B': { status: 'stable' },
      'RUNBOOK--C': { status: 'stable' },
      'CONCEPT--D': { status: 'stable' },
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'ALGO--B', 'RUNBOOK--C', 'CONCEPT--D'],
      lookup,
    )
    expect(cov.filled_count).toBe(3)
    expect(cov.promotable).toBe(false)
    expect(cov.not_stable).toContain('COGNITIVE--A')
  })

  it('handles a mixed-status dimension — one stable member is enough', () => {
    const lookup = lookupFrom({
      'COGNITIVE--A': { status: 'draft' },
      'COGNITIVE--B': { status: 'stable' },
      'ALGO--C': { status: 'stable' },
      'RUNBOOK--D': { status: 'stable' },
      'CONCEPT--E': { status: 'stable' },
    })
    const cov = analyzeDimensions(
      ['COGNITIVE--A', 'COGNITIVE--B', 'ALGO--C', 'RUNBOOK--D', 'CONCEPT--E'],
      lookup,
    )
    expect(cov.filled_count).toBe(4) // cognitive filled because B is stable
    expect(cov.promotable).toBe(true)
    expect(cov.not_stable).toContain('COGNITIVE--A')
    expect(cov.not_stable).not.toContain('COGNITIVE--B')
  })
})
