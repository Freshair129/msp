import { describe, expect, it, vi } from 'vitest'
import { SymbolTracer } from '../../../src/symbols/tracer/tracer.js'
import type { Symbol, Edge, EdgeType } from '../../../src/symbols/types.js'
import type { SymbolStore } from '../../../src/symbols/store/sqlite.js'

function sym(id: string): Symbol {
  return {
    id,
    name: id.split(':').pop()!,
    kind: 'function',
    file: 'test.ts',
    start_line: 1,
    end_line: 1,
    exported: true,
    parent_id: null,
    signature: null,
    community_id: null,
    created_at: new Date().toISOString()
  }
}

function edge(src: string, dst: string): Edge {
  return {
    src_id: src,
    dst_id: dst,
    type: 'calls',
    weight: 1.0,
    resolved: true
  }
}

describe('SymbolTracer', () => {
  it('traces a simple linear path', async () => {
    const symbols = new Map<string, Symbol>([
      ['A', sym('A')],
      ['B', sym('B')],
      ['C', sym('C')],
    ])
    const outgoing = new Map<string, Edge[]>([
      ['A', [edge('A', 'B')]],
      ['B', [edge('B', 'C')]],
    ])

    const mockStore = {
      getSymbol: vi.fn((id) => symbols.get(id)),
      getOutgoingEdges: vi.fn((id) => outgoing.get(id) || []),
      getIncomingEdges: vi.fn(() => []),
    } as unknown as SymbolStore

    const tracer = new SymbolTracer(mockStore)
    const paths = await tracer.trace('A', { direction: 'down' })

    expect(paths).toHaveLength(1)
    expect(paths[0].nodes.map(n => n.id)).toEqual(['A', 'B', 'C'])
    expect(paths[0].edges).toHaveLength(2)
  })

  it('detects and marks cycles', async () => {
    const symbols = new Map<string, Symbol>([
      ['A', sym('A')],
      ['B', sym('B')],
    ])
    const outgoing = new Map<string, Edge[]>([
      ['A', [edge('A', 'B')]],
      ['B', [edge('B', 'A')]],
    ])

    const mockStore = {
      getSymbol: vi.fn((id) => symbols.get(id)),
      getOutgoingEdges: vi.fn((id) => outgoing.get(id) || []),
      getIncomingEdges: vi.fn(() => []),
    } as unknown as SymbolStore

    const tracer = new SymbolTracer(mockStore)
    const paths = await tracer.trace('A', { direction: 'down' })

    // A -> B -> A (cycle)
    expect(paths).toHaveLength(1)
    expect(paths[0].nodes.map(n => n.id)).toEqual(['A', 'B', 'A'])
    expect(paths[0].nodes[2].isCycle).toBe(true)
  })

  it('respects maxDepth limit', async () => {
    const symbols = new Map<string, Symbol>([
      ['A', sym('A')],
      ['B', sym('B')],
      ['C', sym('C')],
    ])
    const outgoing = new Map<string, Edge[]>([
      ['A', [edge('A', 'B')]],
      ['B', [edge('B', 'C')]],
    ])

    const mockStore = {
      getSymbol: vi.fn((id) => symbols.get(id)),
      getOutgoingEdges: vi.fn((id) => outgoing.get(id) || []),
      getIncomingEdges: vi.fn(() => []),
    } as unknown as SymbolStore

    const tracer = new SymbolTracer(mockStore)
    const paths = await tracer.trace('A', { direction: 'down', maxDepth: 1 })

    // Truncated at B (depth 1)
    expect(paths).toHaveLength(1)
    expect(paths[0].nodes.map(n => n.id)).toEqual(['A', 'B'])
  })

  it('traces upwards (callers)', async () => {
    const symbols = new Map<string, Symbol>([
      ['A', sym('A')],
      ['B', sym('B')],
      ['C', sym('C')],
    ])
    const incoming = new Map<string, Edge[]>([
      ['C', [edge('B', 'C')]],
      ['B', [edge('A', 'B')]],
    ])

    const mockStore = {
      getSymbol: vi.fn((id) => symbols.get(id)),
      getOutgoingEdges: vi.fn(() => []),
      getIncomingEdges: vi.fn((id) => incoming.get(id) || []),
    } as unknown as SymbolStore

    const tracer = new SymbolTracer(mockStore)
    const paths = await tracer.trace('C', { direction: 'up' })

    // C -> B -> A
    expect(paths).toHaveLength(1)
    expect(paths[0].nodes.map(n => n.id)).toEqual(['C', 'B', 'A'])
  })
})
