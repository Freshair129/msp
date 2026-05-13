/**
 * PROTO--SAMPLE-RULE — trivial demo predicate (M8a foundation).
 *
 * Verifies that at least one FRAME-- or FRAMEWORK-- atom exists in the index.
 * This is a sanity check that the loader is wired correctly end-to-end; it
 * doesn't gate anything meaningful in production. Real PROTOs (M8b–f) follow
 * this shape but enforce real governance.
 */

import type {
  Predicate,
  PredicateContext,
  PredicateResult,
} from './types.js'

const predicate: Predicate = (ctx: PredicateContext): PredicateResult => {
  const hasFrame = ctx.atomicIndex.some((a) => a.type === 'frame' || a.type === 'framework')
  if (hasFrame) return { ok: true, violations: [] }
  return {
    ok: false,
    violations: [
      {
        message: 'no FRAME or FRAMEWORK atom found — every project should have at least one',
        severity: 'warning',
      },
    ],
  }
}

export default predicate
