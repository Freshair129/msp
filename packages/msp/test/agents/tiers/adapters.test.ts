import { describe, expect, it } from 'vitest'
import { claudeAdapter } from '../../../src/agents/tiers/claude.js'
import { geminiAdapter } from '../../../src/agents/tiers/gemini.js'
import { qwenAdapter } from '../../../src/agents/tiers/qwen.js'
import type { TierAdapter } from '../../../src/agents/tiers/types.js'

const DEFAULT_OPTS = { timeout_ms: 1000, capture_stderr: true }

describe('tier adapter scaffolds', () => {
  it('qwenAdapter has name T1', () => {
    expect(qwenAdapter.name).toBe('T1')
  })

  it('geminiAdapter has name T2', () => {
    expect(geminiAdapter.name).toBe('T2')
  })

  it('claudeAdapter has name T3', () => {
    expect(claudeAdapter.name).toBe('T3')
  })

  it('qwenAdapter healthcheck returns false (stub)', async () => {
    expect(await qwenAdapter.healthcheck()).toBe(false)
  })

  it('geminiAdapter healthcheck returns false (stub)', async () => {
    expect(await geminiAdapter.healthcheck()).toBe(false)
  })

  it('claudeAdapter healthcheck returns false (stub)', async () => {
    expect(await claudeAdapter.healthcheck()).toBe(false)
  })

  it('qwenAdapter run returns not-implemented sentinel', async () => {
    const result = await qwenAdapter.run('hello', DEFAULT_OPTS)
    expect(result.ok).toBe(false)
    expect(result.exit_code).toBe(-1)
    expect(result.output).toMatch(/not implemented/i)
    expect(result.output).toMatch(/qwen/i)
  })

  it('geminiAdapter run returns not-implemented sentinel', async () => {
    const result = await geminiAdapter.run('hello', DEFAULT_OPTS)
    expect(result.ok).toBe(false)
    expect(result.exit_code).toBe(-1)
    expect(result.output).toMatch(/not implemented/i)
    expect(result.output).toMatch(/gemini/i)
  })

  it('claudeAdapter run returns not-implemented sentinel', async () => {
    const result = await claudeAdapter.run('hello', DEFAULT_OPTS)
    expect(result.ok).toBe(false)
    expect(result.exit_code).toBe(-1)
    expect(result.output).toMatch(/not implemented/i)
    expect(result.output).toMatch(/claude/i)
  })

  it('all three adapters conform structurally to TierAdapter', async () => {
    const adapters: readonly TierAdapter[] = [qwenAdapter, geminiAdapter, claudeAdapter]
    const expectedNames: readonly ('T1' | 'T2' | 'T3')[] = ['T1', 'T2', 'T3']

    expect(adapters).toHaveLength(3)

    for (let i = 0; i < adapters.length; i++) {
      const adapter = adapters[i]!
      expect(adapter.name).toBe(expectedNames[i])
      expect(typeof adapter.healthcheck).toBe('function')
      expect(typeof adapter.run).toBe('function')

      const health = await adapter.healthcheck()
      expect(typeof health).toBe('boolean')

      const result = await adapter.run('probe', DEFAULT_OPTS)
      expect(typeof result.ok).toBe('boolean')
      expect(typeof result.output).toBe('string')
      expect(typeof result.exit_code).toBe('number')
    }
  })
})
