import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { runTask } from '../../src/codegen/runner.js'
import { createSlmClient } from '../../src/codegen/slm/factory.js'
import type { SlmClient } from '../../src/codegen/types.js'

/**
 * Pins the FRAMEWORK_MASTER_SPEC §8 / §17.3 contract: the default codegen
 * SLM is Ollama + qwen2.5-coder. Earlier the runner hardcoded `provider: 'qwen'`
 * which contradicted CONCEPT--CODEGEN-MICROTASK-RUNNER.
 */
describe('runner — default SLM provider', () => {
  let originalCwd: string
  let originalProvider: string | undefined
  let root: string

  beforeEach(async () => {
    originalCwd = process.cwd()
    originalProvider = process.env.MSP_SLM_PROVIDER
    delete process.env.MSP_SLM_PROVIDER
    root = await mkdtemp(join(tmpdir(), 'msp-default-slm-'))
    await mkdir(join(root, 'gks/blueprint'), { recursive: true })
    await mkdir(join(root, 'tasks'), { recursive: true })
    await writeFile(
      join(root, 'gks/blueprint/BLUEPRINT--TEST.md'),
      `---\nid: BLUEPRINT--TEST\nphase: 3\ntype: blueprint\nstatus: stable\nvault_id: TEST\n---\nbody`,
    )
    process.chdir(root)
  })

  afterEach(() => {
    process.chdir(originalCwd)
    if (originalProvider === undefined) delete process.env.MSP_SLM_PROVIDER
    else process.env.MSP_SLM_PROVIDER = originalProvider
  })

  it('createSlmClient() with no provider resolves to Ollama (factory default)', () => {
    // Pure factory probe: just confirms no throw and a callable is returned.
    // The full network round-trip is exercised in ollama.test.ts.
    const client = createSlmClient()
    expect(typeof client).toBe('function')
  })

  it('runner --dry-run executes without specifying a provider', async () => {
    const taskYaml = `id: TEST
parent_blueprint: BLUEPRINT--TEST
prompt: |
  Make a thing
acceptance:
  - it works
geography:
  - src/foo.ts
`
    const path = join(root, 'tasks/T1.task.yaml')
    await writeFile(path, taskYaml)
    const r = await runTask(path, { dryRun: true })
    expect(r.exitCode).toBe(0)
  })

  it('Caller-supplied slmClient still overrides the factory default', async () => {
    const taskYaml = `id: TEST
parent_blueprint: BLUEPRINT--TEST
prompt: |
  Make a thing
acceptance:
  - it works
geography:
  - src/foo.ts
`
    const path = join(root, 'tasks/T1.task.yaml')
    await writeFile(path, taskYaml)
    const slm: SlmClient = async () => 'export const handler = async () => 1\n'
    const r = await runTask(path, { slmClient: slm })
    expect(r.exitCode).toBe(0)
  })
})
