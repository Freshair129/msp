import { describe, it, expect } from 'vitest'
import { assignResolutionTiers } from '../../../src/orchestrator/resolution/tier.js'
import { enforceResolutionBudget } from '../../../src/orchestrator/resolution/budget.js'
import type { RetrievalHit } from '../../../src/orchestrator/retrieval/types.js'

function hit(atomId: string, score: number, snippet?: string): RetrievalHit {
  return {
    atomId,
    source: 'gks-vector',
    score,
    rank: 1,
    perSourceRanks: {},
    snippet,
  }
}

describe('UCF Resolution Gradient', () => {
  const mockHits: RetrievalHit[] = [
    hit('A', 0.9, 'Hello world'),
    hit('B', 0.8, 'Foo bar'),
    hit('C', 0.7, 'Baz qux'),
    hit('D', 0.6, 'Test 123'),
  ]

  describe('assignResolutionTiers', () => {
    it('should assign FULL to top N hits and MENTION to others', () => {
      const results = assignResolutionTiers(mockHits, { fullCount: 2 })
      expect(results[0]!.tier).toBe('FULL')
      expect(results[1]!.tier).toBe('FULL')
      expect(results[2]!.tier).toBe('MENTION')
      expect(results[3]!.tier).toBe('MENTION')
    })

    it('should use default fullCount of 3', () => {
      const results = assignResolutionTiers(mockHits)
      expect(results[0]!.tier).toBe('FULL')
      expect(results[1]!.tier).toBe('FULL')
      expect(results[2]!.tier).toBe('FULL')
      expect(results[3]!.tier).toBe('MENTION')
    })
  })

  describe('enforceResolutionBudget', () => {
    const hitsWithBody = [
      { ...hit('A', 0.9), tier: 'FULL' as const, body: 'A '.repeat(100) },
      { ...hit('B', 0.8), tier: 'FULL' as const, body: 'B '.repeat(1000) },
      { ...hit('C', 0.7), tier: 'FULL' as const, body: 'C '.repeat(1000) },
    ]

    it('should downgrade hits when budget is exceeded (downgrade mode)', () => {
      const results = enforceResolutionBudget(hitsWithBody, {
        maxTokens: 1500,
        onOverflow: 'downgrade',
      })

      expect(results[0]!.atomId).toBe('A')
      expect(results[0]!.tier).toBe('FULL')
      expect(results[1]!.atomId).toBe('B')
      expect(results[1]!.tier).toBe('FULL')
      expect(results[2]!.atomId).toBe('C')
      expect(results[2]!.tier).toBe('MENTION')
    })

    it('should drop hits when budget is exceeded (drop mode)', () => {
      const results = enforceResolutionBudget(hitsWithBody, {
        maxTokens: 1500,
        onOverflow: 'drop',
      })

      expect(results).toHaveLength(2)
      expect(results[0]!.atomId).toBe('A')
      expect(results[1]!.atomId).toBe('B')
      expect(results.find((h) => h.atomId === 'C')).toBeUndefined()
    })

    it('should always keep MENTION hits', () => {
      const hitsWithMentions = [
        { ...hit('A', 0.9), tier: 'FULL' as const, body: 'A '.repeat(1000) },
        { ...hit('B', 0.8), tier: 'MENTION' as const, snippet: 'Short' },
      ]

      const results = enforceResolutionBudget(hitsWithMentions, { maxTokens: 100 })
      expect(results[0]!.tier).toBe('MENTION')
      expect(results[1]!.tier).toBe('MENTION')
    })
  })
})
