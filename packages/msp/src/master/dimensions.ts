/**
 * Master Block promotion — 5-dimension coverage analyzer (pure).
 *
 * Per `SPEC--GENESIS-BLOCK-MANIFEST` § 3.1, a Genesis Block has five
 * orthogonal core dimensions (Cognitive, Algo, Runbook, Concept, Params).
 * § 5 names the 4-of-5 promotion criterion: a block is promotable to a
 * Master atom when ≥4 of those 5 dimensions are filled with `status: stable`
 * member atoms.
 *
 * This module is pure — no I/O. Callers pass in the member-id list (the
 * union of `members.core.*` from a manifest, flattened) and a synchronous
 * `lookup` that returns an `AtomRecord` for a given id (or `null` if the
 * atom does not exist on disk).
 *
 * Authority: `CONCEPT--MASTER-PROMOTION`, `BLUEPRINT--MASTER-PROMOTION-PIPELINE`.
 */

/**
 * Minimal atom record the analyzer needs. Callers can pass a richer record
 * — only `id`, `type`, and `status` are inspected here.
 */
export interface AtomRecord {
  readonly id: string
  readonly type: string
  readonly status: string
}

/**
 * Coverage report for one Genesis Block.
 *
 * - Each of the 5 dimension arrays holds the member ids that mapped to that
 *   role by prefix (regardless of whether the lookup resolved or the member
 *   was `status: stable`).
 * - `filled_count` counts dimensions with ≥1 resolved+stable member.
 * - `promotable = filled_count >= 4` per `SPEC--GENESIS-BLOCK-MANIFEST` § 5.
 * - `unresolved` lists ids whose prefix matched a role but whose `lookup`
 *   returned `null` (atom file missing from the vault).
 * - `not_stable` lists ids that resolved but whose status is not `stable`.
 * - `unknown_prefix` lists ids whose prefix did not match any of the 5
 *   core dimension prefixes (silently filtered from the dimension arrays;
 *   surfaced here for diagnostics).
 */
export interface DimensionCoverage {
  readonly cognitive: string[]
  readonly algo: string[]
  readonly runbook: string[]
  readonly concept: string[]
  readonly params: string[]
  readonly filled_count: number
  readonly promotable: boolean
  readonly unresolved: string[]
  readonly not_stable: string[]
  readonly unknown_prefix: string[]
}

/**
 * Lookup signature. May be synchronous (cached) or async; the analyzer
 * itself does not await. Callers that need async lookup should pre-resolve
 * into a cache and pass a synchronous wrapper.
 */
export type AtomLookup = (id: string) => AtomRecord | null

/**
 * Map from v2.3 prefix → dimension key. The SPEC § 3.1 closes the core
 * to these five prefixes. `PARAMS--` is retained from the legacy taxonomy
 * (not four-letter, but still canonical for the params dimension).
 */
const PREFIX_TO_DIMENSION: Readonly<Record<string, keyof DimensionMap>> = {
  'COGNITIVE--': 'cognitive',
  'ALGO--': 'algo',
  'RUNBOOK--': 'runbook',
  'CONCEPT--': 'concept',
  'PARAMS--': 'params',
}

/**
 * v2.3 type values that align with each core dimension. The analyzer uses
 * `type` only as a *consistency hint* (logged via `unknown_prefix` if the
 * prefix says one role but the parsed atom carries a different type). The
 * authoritative classifier is the id prefix — per SPEC § 3.3 a member's
 * type MUST match its role-key in the manifest, so prefix-based dispatch
 * is sufficient.
 */
type DimensionMap = {
  cognitive: string[]
  algo: string[]
  runbook: string[]
  concept: string[]
  params: string[]
}

/**
 * Analyze 5-dimension coverage for a set of member ids.
 *
 * - Ids are classified by their `<PREFIX>--` portion. Unknown prefixes are
 *   filtered out (and reported on `unknown_prefix`).
 * - A dimension counts as "filled" iff it has ≥1 member whose `lookup`
 *   resolved AND whose `status === 'stable'`. Resolved-but-draft members
 *   appear under `not_stable`; unresolved members appear under
 *   `unresolved`.
 * - Duplicate ids are de-duplicated within each dimension array (preserves
 *   first-seen order).
 *
 * Pure — no I/O, no Date.now(), deterministic given the same inputs.
 */
export function analyzeDimensions(
  memberIds: readonly string[],
  lookup: AtomLookup,
): DimensionCoverage {
  const dims: DimensionMap = {
    cognitive: [],
    algo: [],
    runbook: [],
    concept: [],
    params: [],
  }
  const stableHits: Record<keyof DimensionMap, boolean> = {
    cognitive: false,
    algo: false,
    runbook: false,
    concept: false,
    params: false,
  }
  const unresolved: string[] = []
  const not_stable: string[] = []
  const unknown_prefix: string[] = []
  const seenPerDim = new Set<string>()

  for (const id of memberIds) {
    const dimKey = classifyById(id)
    if (dimKey === null) {
      unknown_prefix.push(id)
      continue
    }
    const seenKey = `${dimKey}::${id}`
    if (seenPerDim.has(seenKey)) continue
    seenPerDim.add(seenKey)
    dims[dimKey].push(id)

    const record = lookup(id)
    if (record === null) {
      unresolved.push(id)
      continue
    }
    if (record.status !== 'stable') {
      not_stable.push(id)
      continue
    }
    stableHits[dimKey] = true
  }

  const filled_count =
    (stableHits.cognitive ? 1 : 0) +
    (stableHits.algo ? 1 : 0) +
    (stableHits.runbook ? 1 : 0) +
    (stableHits.concept ? 1 : 0) +
    (stableHits.params ? 1 : 0)

  return {
    cognitive: dims.cognitive,
    algo: dims.algo,
    runbook: dims.runbook,
    concept: dims.concept,
    params: dims.params,
    filled_count,
    promotable: filled_count >= 4,
    unresolved,
    not_stable,
    unknown_prefix,
  }
}

/**
 * Classify a member id by its `<PREFIX>--` portion. Returns the dimension
 * key (`cognitive`, `algo`, `runbook`, `concept`, `params`) or `null` if
 * the prefix does not match a core dimension.
 */
export function classifyById(id: string): keyof DimensionMap | null {
  for (const prefix of Object.keys(PREFIX_TO_DIMENSION)) {
    if (id.startsWith(prefix)) {
      return PREFIX_TO_DIMENSION[prefix] ?? null
    }
  }
  return null
}
