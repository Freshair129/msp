import { describe, expect, it } from 'vitest'

import {
  estimateCost,
  estimateTokens,
  PRICING,
} from '../../src/agents/cost-tracker.js'

describe('cost-tracker', () => {
  describe('PRICING table', () => {
    it('has one row per tier', () => {
      const tiers = PRICING.map((r) => r.tier).sort()
      expect(tiers).toEqual(['T1', 'T2', 'T3'])
    })

    it('T1 is free (input and output)', () => {
      const t1 = PRICING.find((r) => r.tier === 'T1')!
      expect(t1.per_million_input_usd).toBe(0)
      expect(t1.per_million_output_usd).toBe(0)
    })

    it('T3 is at least 10× more expensive than T2', () => {
      const t2 = PRICING.find((r) => r.tier === 'T2')!
      const t3 = PRICING.find((r) => r.tier === 'T3')!
      expect(t3.per_million_input_usd / t2.per_million_input_usd).toBeGreaterThanOrEqual(10)
      expect(t3.per_million_output_usd / t2.per_million_output_usd).toBeGreaterThanOrEqual(10)
    })
  })

  describe('estimateCost()', () => {
    it('returns 0 for T1 regardless of token counts', () => {
      expect(estimateCost('T1', 0, 0)).toBe(0)
      expect(estimateCost('T1', 1_000_000, 1_000_000)).toBe(0)
      expect(estimateCost('T1', 999_999_999, 999_999_999)).toBe(0)
    })

    it('returns ~0.375 USD for T2 at 1M+1M tokens (0.075 + 0.30)', () => {
      const cost = estimateCost('T2', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(0.375, 6)
    })

    it('returns ~18 USD for T3 at 1M+1M tokens (3.00 + 15.00)', () => {
      const cost = estimateCost('T3', 1_000_000, 1_000_000)
      expect(cost).toBeCloseTo(18.0, 6)
    })

    it('scales linearly with token count', () => {
      const small = estimateCost('T2', 1_000, 1_000)
      const big = estimateCost('T2', 1_000_000, 1_000_000)
      expect(big / small).toBeCloseTo(1000, 1)
    })

    it('handles 0-token inputs', () => {
      expect(estimateCost('T2', 0, 0)).toBe(0)
      expect(estimateCost('T3', 0, 0)).toBe(0)
    })

    it('input and output costs add independently', () => {
      const inOnly = estimateCost('T2', 1_000_000, 0)
      const outOnly = estimateCost('T2', 0, 1_000_000)
      const both = estimateCost('T2', 1_000_000, 1_000_000)
      expect(inOnly + outOnly).toBeCloseTo(both, 9)
      expect(inOnly).toBeCloseTo(0.075, 6)
      expect(outOnly).toBeCloseTo(0.3, 6)
    })
  })

  describe('estimateTokens()', () => {
    it('returns ~1 for "hello" (5 chars)', () => {
      // 5/4 = 1.25 → ceil → 2; that's the rough heuristic. Allow 1 or 2.
      const t = estimateTokens('hello')
      expect(t).toBeGreaterThanOrEqual(1)
      expect(t).toBeLessThanOrEqual(2)
    })

    it('returns ~1000 for a 4000-char string', () => {
      const t = estimateTokens('a'.repeat(4000))
      expect(t).toBe(1000)
    })

    it('returns 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0)
    })

    it('scales linearly with length', () => {
      const small = estimateTokens('x'.repeat(100))
      const big = estimateTokens('x'.repeat(10_000))
      expect(big / small).toBeCloseTo(100, 0)
    })
  })
})
