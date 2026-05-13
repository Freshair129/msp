import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGenesisGraphBackend } from '../../src/memory/graph/genesis-graph.js'

describe('GenesisGraphBackend (Phase 0 — JSONL event-replay)', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'genesis-graph-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('adds nodes and edges and indexes both directions', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    const alice = await g.addNode({ id: 'u:alice', labels: ['User'], props: { name: 'Alice' } })
    const bob = await g.addNode({ id: 'u:bob', labels: ['User'], props: { name: 'Bob' } })
    await g.addEdge({ from: alice.id, to: bob.id, rel: 'KNOWS' })
    expect((await g.query({ from: alice.id })).length).toBe(1)
    expect((await g.query({ to: bob.id })).length).toBe(1)
    expect((await g.query({ rel: 'FOLLOWS' })).length).toBe(0)
  })

  it('rejects edges to unknown nodes', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    await g.addNode({ id: 'a', labels: ['X'] })
    await expect(g.addEdge({ from: 'a', to: 'ghost', rel: 'R' })).rejects.toThrow(/unknown to-node/)
  })

  it('supersede marks prior valid edges invalid and points them at the new one', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    await g.addNode({ id: 'u', labels: ['User'] })
    await g.addNode({ id: 'city:paris', labels: ['City'] })
    await g.addNode({ id: 'city:berlin', labels: ['City'] })

    const first = await g.addEdge({
      from: 'u',
      to: 'city:paris',
      rel: 'LIVES_IN',
      valid_from: '2022-01-01T00:00:00.000Z',
    })
    const second = await g.addEdge({
      from: 'u',
      to: 'city:berlin',
      rel: 'LIVES_IN',
      valid_from: '2024-06-01T00:00:00.000Z',
      supersede: true,
    })

    const after = await g.query({ from: 'u', rel: 'LIVES_IN', includeInvalid: true })
    const retired = after.find((e) => e.id === first.id)!
    expect(retired.valid_to).toBe(second.valid_from)
    expect(retired.superseded_by).toBe(second.id)

    const current = await g.query({ from: 'u', rel: 'LIVES_IN' })
    expect(current).toHaveLength(1)
    expect(current[0]!.id).toBe(second.id)
  })

  it('asOf returns edges valid at that point in time', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    await g.addNode({ id: 'u', labels: ['User'] })
    await g.addNode({ id: 'p', labels: ['City'] })
    await g.addNode({ id: 'b', labels: ['City'] })
    await g.addEdge({
      from: 'u',
      to: 'p',
      rel: 'LIVES_IN',
      valid_from: '2022-01-01T00:00:00.000Z',
    })
    await g.addEdge({
      from: 'u',
      to: 'b',
      rel: 'LIVES_IN',
      valid_from: '2024-06-01T00:00:00.000Z',
      supersede: true,
    })

    const in2023 = await g.query({ from: 'u', rel: 'LIVES_IN', asOf: '2023-06-01T00:00:00.000Z' })
    expect(in2023.map((e) => e.to)).toEqual(['p'])

    const in2025 = await g.query({ from: 'u', rel: 'LIVES_IN', asOf: '2025-01-01T00:00:00.000Z' })
    expect(in2025.map((e) => e.to)).toEqual(['b'])
  })

  it('retractEdge invalidates but preserves history', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    await g.addNode({ id: 'a', labels: ['X'] })
    await g.addNode({ id: 'b', labels: ['X'] })
    const e = await g.addEdge({ from: 'a', to: 'b', rel: 'R' })
    const retracted = await g.retractEdge(e.id, '2025-01-01T00:00:00.000Z')
    expect(retracted?.valid_to).toBe('2025-01-01T00:00:00.000Z')

    expect(await g.query({ from: 'a' })).toHaveLength(0)
    expect(await g.query({ from: 'a', includeInvalid: true })).toHaveLength(1)
  })

  it('neighbors() BFS respects depth and relation filter', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    for (const id of ['a', 'b', 'c', 'd']) await g.addNode({ id, labels: ['X'] })
    await g.addEdge({ from: 'a', to: 'b', rel: 'R' })
    await g.addEdge({ from: 'b', to: 'c', rel: 'R' })
    await g.addEdge({ from: 'c', to: 'd', rel: 'R' })

    const depth1 = await g.neighbors('a', { depth: 1 })
    expect(depth1.map((n) => n.node.id)).toEqual(['b'])
    const depth3 = await g.neighbors('a', { depth: 3 })
    expect(depth3.map((n) => n.node.id)).toEqual(['b', 'c', 'd'])
  })

  it('persists across re-open via JSONL event replay', async () => {
    const g1 = createGenesisGraphBackend({ path: dir })
    await g1.load()
    await g1.addNode({ id: 'a', labels: ['X'] })
    await g1.addNode({ id: 'b', labels: ['X'] })
    await g1.addEdge({ from: 'a', to: 'b', rel: 'R' })

    const g2 = createGenesisGraphBackend({ path: dir })
    await g2.load()
    expect((await g2.query({ from: 'a' })).length).toBe(1)
  })
})
