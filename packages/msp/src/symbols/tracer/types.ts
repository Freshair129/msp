import type { Symbol, Edge } from '../types.js'

export interface TraceNode extends Symbol {
  /** The depth of this node in the trace (0-indexed from seed). */
  depth: number
  /** True if this node completes a cycle in the current path. */
  isCycle: boolean
}

export interface TraceEdge extends Edge {
  /** The depth of the edge in the trace. */
  depth: number
}

export interface TracePath {
  nodes: TraceNode[]
  edges: TraceEdge[]
}

export interface TracerOptions {
  /** Maximum number of hops (default 8). */
  maxDepth?: number
  /** Direction of traversal. */
  direction: 'down' | 'up'
}
