/**
 * Errors emitted by GenesisGraphBackend.
 *
 * Schema-version mismatches are surfaced via the shared
 * `SchemaVersionMismatchError` from `lib/schema-version.ts` — see
 * BLUEPRINT--GENESIS-GRAPH-TS-FIRST §"Risks & open questions".
 */

export class GenesisGraphUnsupportedCypher extends Error {
  readonly fragment: string
  constructor(fragment: string, hint?: string) {
    const tail = hint ? ` (${hint})` : ''
    super(`Cypher v0 does not support: ${fragment}${tail}`)
    this.name = 'GenesisGraphUnsupportedCypher'
    this.fragment = fragment
  }
}
