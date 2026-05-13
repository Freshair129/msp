import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGenesisGraphBackend } from '../../src/memory/graph/genesis-graph.js'
import { GenesisGraphUnsupportedCypher } from '../../src/memory/graph/genesis-graph-errors.js'

describe('GenesisGraphBackend — Cypher v0', () => {
  let dir: string
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'genesis-graph-cypher-'))
  })
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  async function seedAtomVault() {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    // Three Atom nodes; FEAT--A references ADR--A which implements CONCEPT--A.
    await g.addNode({
      id: 'FEAT--A',
      labels: ['Atom'],
      props: { type: 'feat', status: 'stable' },
    })
    await g.addNode({
      id: 'ADR--A',
      labels: ['Atom'],
      props: { type: 'adr', status: 'stable' },
    })
    await g.addNode({
      id: 'CONCEPT--A',
      labels: ['Atom'],
      props: { type: 'concept', status: 'draft' },
    })
    await g.addEdge({ from: 'FEAT--A', to: 'ADR--A', rel: 'references' })
    await g.addEdge({ from: 'ADR--A', to: 'CONCEPT--A', rel: 'implements' })
    return g
  }

  it('exact-id MATCH + single-hop returns the neighbour', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) RETURN b.id`,
    )
    expect(rows).toEqual([{ 'b.id': 'ADR--A' }])
  })

  it('variable-length [r:*1..6] crosses both edges and reports length(r)', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references|implements*1..6]->(b:Atom) RETURN b.id, length(r) AS hops`,
    )
    // Hops: 1 → ADR--A, 2 → CONCEPT--A. Order is BFS (depth-first growth).
    expect(rows).toContainEqual({ 'b.id': 'ADR--A', hops: 1 })
    expect(rows).toContainEqual({ 'b.id': 'CONCEPT--A', hops: 2 })
  })

  it('WHERE filters target properties (equality)', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references|implements*1..6]->(b:Atom) WHERE b.status = 'stable' RETURN b.id`,
    )
    expect(rows).toEqual([{ 'b.id': 'ADR--A' }])
  })

  it('unsupported feature (OPTIONAL MATCH) raises GenesisGraphUnsupportedCypher', async () => {
    const g = await seedAtomVault()
    await expect(
      g.cypher(`OPTIONAL MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) RETURN b.id`),
    ).rejects.toBeInstanceOf(GenesisGraphUnsupportedCypher)
  })

  it('unknown seed returns an empty result set (not an error)', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'NOPE'})-[r:references]->(b:Atom) RETURN b.id`,
    )
    expect(rows).toEqual([])
  })
})
