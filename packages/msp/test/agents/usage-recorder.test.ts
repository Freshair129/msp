import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { recordUsage } from '../../src/agents/usage-recorder.js'

const SUMMARY_START = '<!-- USAGE-SUMMARY-START -->'
const SUMMARY_END = '<!-- USAGE-SUMMARY-END -->'

interface ParsedSummary {
  total_cost_usd: number
  call_count: number
  by_tier: Record<'T1' | 'T2' | 'T3', { count: number; cost_usd: number }>
  top_episodes: { id: string; cost_usd: number; tier: string }[]
  updated_at: string
}

function extractSummary(content: string): ParsedSummary {
  const startIdx = content.indexOf(SUMMARY_START)
  const endIdx = content.indexOf(SUMMARY_END)
  expect(startIdx).toBeGreaterThan(-1)
  expect(endIdx).toBeGreaterThan(startIdx)
  const block = content.slice(startIdx + SUMMARY_START.length, endIdx)
  const fenceMatch = block.match(/```json\s*([\s\S]*?)\s*```/)
  expect(fenceMatch).not.toBeNull()
  return JSON.parse(fenceMatch![1]!) as ParsedSummary
}

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10)
}

describe('usage-recorder', () => {
  let root: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'msp-usage-recorder-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('creates USAGE--DAILY-<today>.md with correct frontmatter on first call', async () => {
    const date = todayIsoDate()
    const expectedPath = resolve(root, 'gks', 'usage', `USAGE--DAILY-${date}.md`)

    const writtenPath = await recordUsage(
      { tier: 'T2', cost_usd: 0.001 },
      root,
    )

    expect(writtenPath).toBe(expectedPath)

    const content = await readFile(expectedPath, 'utf8')
    expect(content).toContain(`id: USAGE--DAILY-${date}`)
    expect(content).toContain('phase: 5')
    expect(content).toContain('type: usage')
    expect(content).toContain('status: stable')
    expect(content).toContain('tier: genesis')
    expect(content).toContain('source_type: episodic')
    expect(content).toContain('  - agents')
    expect(content).toContain('  - usage')
    expect(content).toContain('  - cost')
    expect(content).toContain('  - daily')
    expect(content).toMatch(/created_at: \d{4}-\d{2}-\d{2}T/)
  })

  it('body contains parseable JSON summary block', async () => {
    await recordUsage({ tier: 'T2', cost_usd: 0.001 }, root)
    const path = resolve(
      root,
      'gks',
      'usage',
      `USAGE--DAILY-${todayIsoDate()}.md`,
    )
    const content = await readFile(path, 'utf8')
    const summary = extractSummary(content)

    expect(summary.total_cost_usd).toBeCloseTo(0.001, 9)
    expect(summary.call_count).toBe(1)
    expect(summary.by_tier.T1).toEqual({ count: 0, cost_usd: 0 })
    expect(summary.by_tier.T2.count).toBe(1)
    expect(summary.by_tier.T2.cost_usd).toBeCloseTo(0.001, 9)
    expect(summary.by_tier.T3).toEqual({ count: 0, cost_usd: 0 })
    expect(Array.isArray(summary.top_episodes)).toBe(true)
  })

  it('second call same day updates the same atom (no new file)', async () => {
    await recordUsage({ tier: 'T1', cost_usd: 0 }, root)
    await recordUsage({ tier: 'T2', cost_usd: 0.002 }, root)
    await recordUsage({ tier: 'T3', cost_usd: 0.05 }, root)

    const dir = resolve(root, 'gks', 'usage')
    const files = await readdir(dir)
    expect(files.length).toBe(1)
    expect(files[0]).toBe(`USAGE--DAILY-${todayIsoDate()}.md`)

    const content = await readFile(join(dir, files[0]!), 'utf8')
    const summary = extractSummary(content)

    expect(summary.call_count).toBe(3)
    expect(summary.total_cost_usd).toBeCloseTo(0.052, 9)
    expect(summary.by_tier.T1.count).toBe(1)
    expect(summary.by_tier.T2.count).toBe(1)
    expect(summary.by_tier.T2.cost_usd).toBeCloseTo(0.002, 9)
    expect(summary.by_tier.T3.count).toBe(1)
    expect(summary.by_tier.T3.cost_usd).toBeCloseTo(0.05, 9)
  })

  it('preserves frontmatter on update (does not rewrite created_at)', async () => {
    const path = resolve(
      root,
      'gks',
      'usage',
      `USAGE--DAILY-${todayIsoDate()}.md`,
    )
    await recordUsage({ tier: 'T2', cost_usd: 0.01 }, root)
    const firstContent = await readFile(path, 'utf8')
    const firstCreatedMatch = firstContent.match(/created_at: (.+)/)
    expect(firstCreatedMatch).not.toBeNull()

    // Small delay so updated_at differs
    await new Promise((r) => setTimeout(r, 5))
    await recordUsage({ tier: 'T2', cost_usd: 0.02 }, root)
    const secondContent = await readFile(path, 'utf8')
    const secondCreatedMatch = secondContent.match(/created_at: (.+)/)

    expect(secondCreatedMatch![1]).toBe(firstCreatedMatch![1])
  })

  it('tracks top_episodes when episode_id is provided', async () => {
    await recordUsage(
      { tier: 'T3', cost_usd: 0.05, episode_id: 'EPISODE--AGENT-RUN-A' },
      root,
    )
    await recordUsage(
      { tier: 'T2', cost_usd: 0.001, episode_id: 'EPISODE--AGENT-RUN-B' },
      root,
    )

    const path = resolve(
      root,
      'gks',
      'usage',
      `USAGE--DAILY-${todayIsoDate()}.md`,
    )
    const summary = extractSummary(await readFile(path, 'utf8'))
    expect(summary.top_episodes.length).toBe(2)
    // Sorted by cost desc.
    expect(summary.top_episodes[0]!.id).toBe('EPISODE--AGENT-RUN-A')
    expect(summary.top_episodes[1]!.id).toBe('EPISODE--AGENT-RUN-B')
  })
})
