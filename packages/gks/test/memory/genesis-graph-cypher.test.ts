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

  it('empty query rejects with GenesisGraphUnsupportedCypher', async () => {
    const g = createGenesisGraphBackend({ path: dir })
    await g.load()
    await expect(g.cypher('')).rejects.toBeInstanceOf(GenesisGraphUnsupportedCypher)
    await expect(g.cypher('   ')).rejects.toBeInstanceOf(GenesisGraphUnsupportedCypher)
  })

  it('missing RETURN clause rejects with GenesisGraphUnsupportedCypher', async () => {
    const g = await seedAtomVault()
    await expect(
      g.cypher(`MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom)`),
    ).rejects.toBeInstanceOf(GenesisGraphUnsupportedCypher)
  })

  it('inverted hop range *5..3 rejects with GenesisGraphUnsupportedCypher', async () => {
    const g = await seedAtomVault()
    await expect(
      g.cypher(`MATCH (a:Atom {id: 'FEAT--A'})-[r:references*5..3]->(b:Atom) RETURN b.id`),
    ).rejects.toBeInstanceOf(GenesisGraphUnsupportedCypher)
  })

  it.each([
    ['CREATE', `CREATE (n:Atom {id: 'X'}) RETURN n`],
    ['MERGE', `MERGE (n:Atom {id: 'X'}) RETURN n`],
    ['DELETE', `MATCH (a:Atom {id: 'FEAT--A'}) DELETE a RETURN a`],
    ['SET', `MATCH (a:Atom {id: 'FEAT--A'}) SET a.flag = 'x' RETURN a.id`],
    ['UNWIND', `UNWIND [1,2,3] AS x RETURN x`],
    ['WITH', `MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) WITH b RETURN b.id`],
    [
      'UNION',
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) RETURN b.id UNION MATCH (a:Atom {id: 'ADR--A'})-[r:implements]->(b:Atom) RETURN b.id`,
    ],
  ])('unsupported keyword %s rejects with GenesisGraphUnsupportedCypher', async (_kw, query) => {
    const g = await seedAtomVault()
    await expect(g.cypher(query)).rejects.toBeInstanceOf(GenesisGraphUnsupportedCypher)
  })

  it('WHERE predicate on seed alias a filters the seed', async () => {
    const g = await seedAtomVault()
    const match = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) WHERE a.type = 'feat' RETURN b.id`,
    )
    expect(match).toEqual([{ 'b.id': 'ADR--A' }])

    const miss = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) WHERE a.type = 'adr' RETURN b.id`,
    )
    expect(miss).toEqual([])
  })

  it('WHERE with AND combines predicates conjunctively', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references|implements*1..6]->(b:Atom) WHERE b.status = 'stable' AND b.type = 'adr' RETURN b.id`,
    )
    expect(rows).toEqual([{ 'b.id': 'ADR--A' }])
  })

  it('length(r) without AS uses default key length_r', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references|implements*1..6]->(b:Atom) RETURN b.id, length(r)`,
    )
    expect(rows).toContainEqual({ 'b.id': 'ADR--A', length_r: 1 })
    expect(rows).toContainEqual({ 'b.id': 'CONCEPT--A', length_r: 2 })
  })

  it('rel-type union r:references|implements walks both edge types', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references|implements*1..6]->(b:Atom) RETURN b.id, length(r) AS hops`,
    )
    expect(rows).toHaveLength(2)
    expect(rows).toContainEqual({ 'b.id': 'ADR--A', hops: 1 })
    expect(rows).toContainEqual({ 'b.id': 'CONCEPT--A', hops: 2 })
  })

  it('keywords are case-insensitive', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `match (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) Where b.status = 'stable' return b.id`,
    )
    expect(rows).toEqual([{ 'b.id': 'ADR--A' }])
  })

  it('seed label mismatch yields empty result', async () => {
    const g = await seedAtomVault()
    const rows = await g.cypher(
      `MATCH (a:Concept {id: 'FEAT--A'})-[r:references]->(b:Atom) RETURN b.id`,
    )
    expect(rows).toEqual([])
  })
})
