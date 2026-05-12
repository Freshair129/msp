import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createCognitiveLayer } from '../../src/cognitive/index.js'

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cognitive-layer-'))
  // Minimal gks/ tree for MemoryStore.init() to succeed.
  await mkdir(join(root, 'gks', '00_index'), { recursive: true })
  await writeFile(join(root, 'gks', '00_index', 'atomic_index.jsonl'), '')
  return root
}

describe('createCognitiveLayer', () => {
  let roots: string[] = []

  beforeEach(() => {
    roots = []
  })

  afterEach(async () => {
    // best-effort cleanup — let the test runner handle stragglers
    void roots
  })

  it('initialises with defaults and exposes the MemoryStore + GraphBackend escape hatches', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layer = await createCognitiveLayer({ root })
    expect(layer.store).toBeDefined()
    expect(layer.graph).toBeDefined()
    expect(typeof layer.graph.addNode).toBe('function')
  })

  it('remember() returns a vectorDocId', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layer = await createCognitiveLayer({ root })
    const r = await layer.remember('Cortex handles planning in the Tri-Brain.')
    expect(typeof r.id).toBe('string')
    expect(r.id.length).toBeGreaterThan(0)
  })

  it('recall() returns hits with cognitive shape and audit_only stamp on episodic', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layer = await createCognitiveLayer({ root })
    await layer.remember('Cortex handles planning.', { tags: ['cortex'] })
    const result = await layer.recall('cortex planning', { topK: 5, scoreThreshold: -1 })
    expect(Array.isArray(result.hits)).toBe(true)
    for (const h of result.hits) {
      if (h.source === 'episodic') expect(h.audit_only).toBe(true)
    }
  })

  it('mcpServer() returns a McpServer instance', async () => {
    const root = await makeRoot()
    roots.push(root)
    const layer = await createCognitiveLayer({ root })
    const server = layer.mcpServer()
    expect(server).toBeDefined()
  })
})
