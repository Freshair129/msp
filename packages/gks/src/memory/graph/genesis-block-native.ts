import { createRequire } from 'node:module'
import { join } from 'node:path'
import { mkdir } from 'node:fs/promises'

import type {
  AddEdgeArgs,
  AddNodeArgs,
  GraphBackend,
  GraphEdge,
  GraphNode,
  GraphQuery,
  NeighborQuery,
  NeighborResult,
} from '../graph.js'

const require = createRequire(import.meta.url)

// The native addon is loaded from the prebuild directory.
// In a real monorepo setup, this would be managed by @napi-rs/cli.
// For now we assume the binary is built and available at the expected location.
let native: any
try {
  // Try to load the local build first (for development)
  native = require('../../native/genesis-block/index.js')
} catch (err) {
  // Fallback to prebuilds or throw
  throw new Error(`Failed to load genesis-block native addon: ${err}`)
}

export interface GenesisBlockNativeOptions {
  path: string
  readOnly?: boolean
  pageCacheMB?: number
}

export function createGenesisBlockNativeBackend(opts: GenesisBlockNativeOptions): GenesisBlockNativeBackend {
  return new GenesisBlockNativeBackend(opts)
}

export class GenesisBlockNativeBackend implements GraphBackend {
  private readonly path: string
  private readonly readOnly: boolean
  private readonly pageCacheMB: number
  private db: any | null = null

  constructor(opts: GenesisBlockNativeOptions) {
    this.path = opts.path
    this.readOnly = opts.readOnly ?? false
    this.pageCacheMB = opts.pageCacheMB ?? 64
  }

  async load(): Promise<void> {
    if (this.db) return
    await mkdir(this.path, { recursive: true })
    
    try {
      this.db = native.GenesisDatabase.open({
        path: this.path,
        readOnly: this.readOnly,
        pageCacheMb: this.pageCacheMB
      })
    } catch (err: any) {
      throw new Error(`genesis-block: io: ${err.message}`)
    }
  }

  async size(): Promise<{ nodes: number; edges: number }> {
    this.ensureLoaded()
    const status = this.db.statusSync()
    return { nodes: status.nodes, edges: status.edges }
  }

  async addNode(args: AddNodeArgs): Promise<GraphNode> {
    this.ensureLoaded()
    return await this.db.addNode({
      id: args.id,
      labels: args.labels,
      props: args.props
    })
  }

  async addEdge(args: AddEdgeArgs): Promise<GraphEdge> {
    this.ensureLoaded()
    return await this.db.addEdge({
      id: args.id,
      from: args.from,
      to: args.to,
      rel: args.rel,
      props: args.props,
      validFrom: args.valid_from,
      supersede: args.supersede
    })
  }

  async retractEdge(id: string, at?: string): Promise<GraphEdge | null> {
    this.ensureLoaded()
    return await this.db.retractEdge(id, at)
  }

  async query(q: GraphQuery = {}): Promise<GraphEdge[]> {
    this.ensureLoaded()
    return await this.db.query({
      from: q.from,
      to: q.to,
      rel: q.rel,
      asOf: q.asOf,
      includeInvalid: q.includeInvalid,
      limit: q.limit
    })
  }

  async neighbors(seed: string, q: NeighborQuery = {}): Promise<NeighborResult[]> {
    this.ensureLoaded()
    const results = await this.db.neighbors(seed, {
      depth: q.depth,
      rel: q.rel,
      direction: q.direction,
      asOf: q.asOf,
      includeInvalid: q.includeInvalid,
      limit: q.limit
    })

    // Normalise to GKS NeighborResult shape
    return results.map((r: any) => ({
      node: r.node,
      path: r.path,
      depth: r.depth
    }))
  }

  async flush(): Promise<void> {
    if (this.db) {
      await this.db.flush()
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      await this.db.close()
      this.db = null
    }
  }

  private ensureLoaded(): void {
    if (!this.db) {
      throw new Error('genesis-block: internal: backend not loaded. Call .load() first.')
    }
  }
}
