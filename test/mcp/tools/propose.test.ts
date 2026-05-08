import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { handler, name } from '../../../src/mcp/tools/propose.js'

const tmpRoots: string[] = []
afterEach(async () => {
  for (const dir of tmpRoots.splice(0)) {
    await rm(dir, { recursive: true, force: true })
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
    //
    // Use a tmpdir for both ctx.root *and* args.root so the wrapper's gks call
    // writes (or fails) inside the tmpdir — never into the real repo, which
    // would race with --all validator tests running in parallel.
    const stranger = await mkdtemp(join(tmpdir(), 'msp-propose-stranger-'))
    const projectRoot = await mkdtemp(join(tmpdir(), 'msp-propose-root-'))
    tmpRoots.push(stranger, projectRoot)

    const result = await handler({ root: stranger })({
      id: 'CONCEPT--TEST-MCP-PROPOSE-WRAPPER-LOOKUP',
      title: 'wrapper lookup smoke',
      body: 'placeholder',
      phase: 1,
      type: 'concept',
      root: projectRoot,
    })
    const text = result.content[0]!.text
    // Either the propose succeeds, or it fails for a wrapper-internal reason
    // (e.g. gks rejects the empty project) — but it MUST NOT fail with the
    // "Cannot find module .../scripts/msp/propose.mjs" symptom from the bug.
    expect(text).not.toMatch(/Cannot find module/)
    expect(text).not.toMatch(/scripts[\\/]msp[\\/]propose\.mjs/i)
  }, 30_000)
})
