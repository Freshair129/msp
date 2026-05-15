import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MemoryStore } from '../../src/memory/index.js'
import {
  createGenesisGraphBackend,
  GenesisGraphBackend,
} from '../../src/memory/graph/genesis-graph.js'

describe('MemoryStore × GenesisGraphBackend wiring', () => {
  let root: string
  let graphDir: string

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'mem-root-'))
    graphDir = await mkdtemp(join(tmpdir(), 'mem-graph-'))
  })

  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
    await rm(graphDir, { recursive: true, force: true })
  })

  it('wires a GenesisGraphBackend instance directly', async () => {
    const backend = createGenesisGraphBackend({ path: graphDir })
    const store = new MemoryStore({
      root,
      graphBackend: backend,
      audit: false,
      cost: false,
    })
    await store.init()
    expect(store.graph).toBe(backend)
    expect(store.graph).toBeInstanceOf(GenesisGraphBackend)
  })

  it('wires a GenesisGraphBackend factory using the resolved layout', async () => {
    const store = new MemoryStore({
      root,
      graphBackend: (layout) =>
        createGenesisGraphBackend({ path: join(layout.graph, 'genesis-graph') }),
      audit: false,
      cost: false,
    })
    await store.init()
    expect(store.graph).toBeInstanceOf(GenesisGraphBackend)

    const alice = await store.graph.addNode({
      id: 'u:alice',
      labels: ['User'],
      props: { name: 'Alice' },
    })
    const bob = await store.graph.addNode({
      id: 'u:bob',
      labels: ['User'],
      props: { name: 'Bob' },
    })
    await store.graph.addEdge({ from: alice.id, to: bob.id, rel: 'KNOWS' })
    expect(await store.graph.query({ from: alice.id })).toHaveLength(1)
  })

  it('persists nodes across MemoryStore re-init at the same path', async () => {
    const factory = () => createGenesisGraphBackend({ path: graphDir })

    const first = new MemoryStore({ root, graphBackend: factory, audit: false, cost: false })
    await first.init()
    await first.graph.addNode({ id: 'persist-test', labels: ['X'] })

    const second = new MemoryStore({ root, graphBackend: factory, audit: false, cost: false })
    await second.init()
    expect(await second.graph.size()).toEqual({ nodes: 1, edges: 0 })
  })
})
