/**
 * PROTO--SAMPLE-RULE — trivial demo predicate (M8a foundation).
 *
 * Verifies that at least one GENESIS-- (Block Manifest), FRAMEWORK-- (governance),
 * or legacy FRAME-- atom exists in the index. This is a sanity check that the
 * loader is wired correctly end-to-end; it doesn't gate anything meaningful in
 * production. Real PROTOs (M8b–f) follow this shape but enforce real governance.
 */

import type {
  Predicate,
  PredicateContext,
  PredicateResult,
} from './types.js'

const predicate: Predicate = (ctx: PredicateContext): PredicateResult => {
  const hasFrame = ctx.atomicIndex.some(
    (a) => a.type === 'genesis' || a.type === 'framework' || a.type === 'frame',
  )
  if (hasFrame) return { ok: true, violations: [] }
  return {
    ok: false,
    violations: [
      {
        message:
          'no GENESIS, FRAMEWORK, or FRAME atom found — every project should have at least one',
        severity: 'warning',
      },
    ],
  }
}

export default predicate
