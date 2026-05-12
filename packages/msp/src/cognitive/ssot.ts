/**
 * §14.1 — SSOT authority hierarchy.
 *
 * When two atoms disagree, the winning source is the one with the highest
 * authority. Code (runtime behaviour) beats anything; PROTO beats MASTER
 * beats ADR beats FRAME beats KNOWLEDGE-TYPES beats CONCEPT/FEAT/BLUEPRINT.
 *
 * Returns the winning citation, or `null` if the input is empty.
 */

import type { AtomCitation } from './types.js'

/** Lower index = higher authority. */
const AUTHORITY_ORDER: readonly string[] = [
  // 1. Code is implicit — represented by AtomCitation.source === 'code'.
  'proto', // 2. machine-enforced invariants
  'master', // 3. root-level policy
  'adr', // 4. architectural decision
  'frame', // 5. framework / architecture standards
  'knowledge-types', // 6. canonical taxonomy
  'concept', // 7. requirements
  'feat',
  'blueprint',
  // everything else falls through to the lowest tier
]

export function resolveSSOT(citations: AtomCitation[]): AtomCitation | null {
  if (citations.length === 0) return null
  let winner: AtomCitation | null = null
  let winnerRank = Number.POSITIVE_INFINITY
  for (const c of citations) {
    const rank = rankOf(c)
    if (rank < winnerRank) {
      winner = c
      winnerRank = rank
    }
  }
  return winner
}

function rankOf(c: AtomCitation): number {
  if (c.source === 'code') return -1
  const idx = AUTHORITY_ORDER.indexOf((c.type || '').toLowerCase())
  return idx === -1 ? AUTHORITY_ORDER.length : idx
}
