import { RetrievalHit } from './types.js'

/**
 * Calculates Precision at K.
 * Precision@K = (Relevant items retrieved in top K) / K
 */
export function calculatePrecision(hits: RetrievalHit[], relevantIds: string[], k: number): number {
  if (k <= 0) return 0
  const topK = hits.slice(0, k)
  const relevantCount = topK.filter(h => relevantIds.includes(h.atomId)).length
  return relevantCount / k
}

/**
 * Calculates Recall at K.
 * Recall@K = (Relevant items retrieved in top K) / (Total relevant items)
 */
export function calculateRecall(hits: RetrievalHit[], relevantIds: string[], k: number): number {
  if (relevantIds.length === 0) return 1.0 // Vacuous pass
  const topK = hits.slice(0, k)
  const relevantCount = topK.filter(h => relevantIds.includes(h.atomId)).length
  return relevantCount / relevantIds.length
}

/**
 * Calculates Reciprocal Rank.
 * RR = 1 / (rank of the first relevant item)
 */
export function calculateRR(hits: RetrievalHit[], relevantIds: string[]): number {
  for (let i = 0; i < hits.length; i++) {
    if (relevantIds.includes(hits[i]!.atomId)) {
      return 1 / (i + 1)
    }
  }
  return 0
}

/**
 * Calculates Mean Reciprocal Rank (MRR) over multiple results.
 * MRR = average of RR over all queries
 */
export function calculateMRR(allRRs: number[]): number {
  if (allRRs.length === 0) return 0
  const sum = allRRs.reduce((a, b) => a + b, 0)
  return sum / allRRs.length
}

export interface BenchmarkMetrics {
  precisionAt1: number
  precisionAt3: number
  precisionAt10: number
  recallAt10: number
  mrr: number
}

/**
 * Aggregates all metrics for a single query result.
 */
export function evaluateQuery(hits: RetrievalHit[], relevantIds: string[]): BenchmarkMetrics {
  return {
    precisionAt1: calculatePrecision(hits, relevantIds, 1),
    precisionAt3: calculatePrecision(hits, relevantIds, 3),
    precisionAt10: calculatePrecision(hits, relevantIds, 10),
    recallAt10: calculateRecall(hits, relevantIds, 10),
    mrr: calculateRR(hits, relevantIds),
  }
}
