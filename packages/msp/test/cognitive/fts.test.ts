import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { ftsSearch } from '../../src/cognitive/fts.js'

async function seedVault(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'fts-'))
  await mkdir(join(root, 'concept'), { recursive: true })
  await mkdir(join(root, 'adr'), { recursive: true })
  await writeFile(
    join(root, 'concept', 'CONCEPT--CORTEX.md'),
    `---
id: CONCEPT--CORTEX
title: Cortex handles planning
---

The Cortex module is responsible for planning and reasoning in the Tri-Brain.`,
  )
  await writeFile(
    join(root, 'adr', 'ADR--MOTOR.md'),
    `---
id: ADR--MOTOR
title: Motor uses Qwen for code generation
---

Decided to use Qwen 2.5-Coder for Motor's local SLM tier.`,
  )
  return root
}

describe('ftsSearch', () => {
  it('returns hits ranked by token-overlap', async () => {
    const root = await seedVault()
    const hits = await ftsSearch(root, 'cortex planning')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.id).toBe('CONCEPT--CORTEX')
    expect(hits[0]!.score).toBe(1) // both tokens match
  })

  it('respects the limit parameter', async () => {
    const root = await seedVault()
    const hits = await ftsSearch(root, 'cortex', { limit: 1 })
    expect(hits.length).toBe(1)
  })

  it('returns [] when no token matches anything', async () => {
    const root = await seedVault()
    const hits = await ftsSearch(root, 'zzz-no-such-token-zzz')
    expect(hits).toEqual([])
  })
})
