import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterEach, describe, expect, it } from 'vitest'

import { handler, name } from '../../../src/mcp/tools/propose.js'

const repoRoot = fileURLToPath(new URL('../../..', import.meta.url))
const inboundDir = join(repoRoot, '.brain/msp/projects/evaAI/inbound')

const cleanup: string[] = []
afterEach(async () => {
  for (const id of cleanup.splice(0)) {
    try {
      const entries = await readdir(inboundDir)
      const match = entries.find((n) => n.startsWith(`${id}.rev-`) && n.endsWith('.md'))
      if (match) await rm(join(inboundDir, match), { force: true })
    } catch {
      // inbound dir may not exist; ignore
    }
  }
})

describe('msp_propose tool', () => {
  it('has the right name', () => {
    expect(name).toBe('msp_propose')
  })

  it('finds its wrapper script even when ctx.root points outside the package', async () => {
    // Simulates the Claude Desktop on Windows case where the MCP server
    // launches with cwd=C:\Windows\system32 — ctx.root then defaults there
    // and used to make the tool resolve `scripts/msp/propose.mjs` to a
    // non-existent path. The wrapper must be found via the package layout.
    const stranger = await mkdtemp(join(tmpdir(), 'msp-propose-stranger-'))
    const id = 'CONCEPT--TEST-MCP-PROPOSE-WRAPPER-LOOKUP'
    cleanup.push(id)
    const result = await handler({ root: stranger })({
      id,
      title: 'wrapper lookup smoke',
      body: 'placeholder',
      phase: 1,
      type: 'concept',
      root: repoRoot,
    })
    const text = result.content[0]!.text
    // Either the propose succeeds, or it fails for a wrapper-internal reason
    // (e.g. the id already exists in inbound) — but it MUST NOT fail with the
    // "Cannot find module .../scripts/msp/propose.mjs" symptom from the bug.
    expect(text).not.toMatch(/Cannot find module/)
    expect(text).not.toMatch(/scripts[\\/]msp[\\/]propose\.mjs/i)
  }, 30_000)
})
