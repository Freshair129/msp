/**
 * Errors emitted by GenesisBlockBackend.
 *
 * Phase 0 (TypeScript-only) backend wraps the JSONL event-replay pattern from
 * GraphStore and adds an opt-in Cypher v0 surface. The two error classes here
 * make the "unsupported feature" and "store-format mismatch" paths explicit
 * so callers can distinguish them from regular `Error` instances.
 */

export class GenesisBlockUnsupportedCypher extends Error {
  readonly fragment: string
  constructor(fragment: string, hint?: string) {
    const tail = hint ? ` (${hint})` : ''
    super(`Cypher v0 does not support: ${fragment}${tail}`)
    this.name = 'GenesisBlockUnsupportedCypher'
    this.fragment = fragment
  }
}

export class GenesisBlockSchemaMismatchError extends Error {
  readonly onDisk: string
  readonly runtime: string
  constructor(onDisk: string, runtime: string) {
    super(
      `genesis-block store schema ${onDisk} on disk vs runtime ${runtime}. ` +
        `Phase-0 backend supports the 1.x format only.`,
    )
    this.name = 'GenesisBlockSchemaMismatchError'
    this.onDisk = onDisk
    this.runtime = runtime
  }
}
