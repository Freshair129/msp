import { describe, expect, it } from 'vitest'

import { pick } from '../../src/agents/routing.js'
import type { DispatchTask } from '../../src/agents/types.js'

function task(overrides: Partial<DispatchTask> = {}): DispatchTask {
  return {
    type: 'other',
    severity: 'regular',
    prompt: 'noop',
    ...overrides,
  }
}

describe('pick()', () => {
  describe('budget_hint override', () => {
    it('forces T3 when budget_hint is T3, even for a T1-shaped task', () => {
      expect(
        pick(task({ type: 'summarize', severity: 'low', budget_hint: 'T3' })),
      ).toBe('T3')
    })

    it('forces T3 even when context would otherwise route to T2', () => {
      expect(
        pick(
          task({
            type: 'codegen',
            severity: 'regular',
            context_size_tokens: 5_000_000,
            budget_hint: 'T3',
          }),
        ),
      ).toBe('T3')
    })

    it('does not force T1 when budget_hint is T1 (hint is only honoured for T3)', () => {
      expect(pick(task({ type: 'codegen', budget_hint: 'T1' }))).toBe('T2')
    })

    it('does not force T2 when budget_hint is T2 (hint is only honoured for T3)', () => {
      expect(pick(task({ type: 'summarize', budget_hint: 'T2' }))).toBe('T1')
    })
  })

  describe('context-size gate', () => {
    it('routes to T2 when context_size_tokens > 2_000_000', () => {
      expect(
        pick(
          task({
            type: 'summarize',
            severity: 'critical',
            context_size_tokens: 2_000_001,
          }),
        ),
      ).toBe('T2')
    })

    it('does NOT route to T2 at exactly 2_000_000 (boundary is strict >)', () => {
      expect(
        pick(
          task({ type: 'summarize', context_size_tokens: 2_000_000 }),
        ),
      ).toBe('T1')
    })

    it('treats missing context_size_tokens as 0 (no T2 trigger)', () => {
      expect(pick(task({ type: 'summarize' }))).toBe('T1')
    })
  })

  describe('severity gate', () => {
    it('routes critical severity to T3 when context is within bounds', () => {
      expect(pick(task({ type: 'codegen', severity: 'critical' }))).toBe('T3')
    })

    it('regular severity does not trigger T3', () => {
      expect(pick(task({ type: 'codegen', severity: 'regular' }))).toBe('T2')
    })

    it('low severity does not trigger T3', () => {
      expect(pick(task({ type: 'codegen', severity: 'low' }))).toBe('T2')
    })
  })

  describe('task.type routing', () => {
    it('routes summarize to T1', () => {
      expect(pick(task({ type: 'summarize', severity: 'regular' }))).toBe('T1')
    })

    it('routes classify to T1', () => {
      expect(pick(task({ type: 'classify', severity: 'regular' }))).toBe('T1')
    })

    it('routes format to T1', () => {
      expect(pick(task({ type: 'format', severity: 'low' }))).toBe('T1')
    })

    it('routes codegen to T2 (default cloud tier)', () => {
      expect(pick(task({ type: 'codegen', severity: 'regular' }))).toBe('T2')
    })

    it('routes review to T2', () => {
      expect(pick(task({ type: 'review', severity: 'regular' }))).toBe('T2')
    })

    it('routes other to T2', () => {
      expect(pick(task({ type: 'other', severity: 'low' }))).toBe('T2')
    })
  })

  describe('decision-tree precedence', () => {
    it('context-size beats severity (oversized critical task goes to T2, not T3)', () => {
      expect(
        pick(
          task({
            type: 'codegen',
            severity: 'critical',
            context_size_tokens: 2_000_001,
          }),
        ),
      ).toBe('T2')
    })

    it('severity beats task.type (critical summarize goes to T3, not T1)', () => {
      expect(pick(task({ type: 'summarize', severity: 'critical' }))).toBe('T3')
    })
  })
})
