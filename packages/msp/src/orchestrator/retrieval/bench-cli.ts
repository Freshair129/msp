#!/usr/bin/env node
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { performance } from 'node:perf_hooks'

import { recall } from './index.js'
import { evaluateQuery, BenchmarkMetrics, calculateMRR } from './bench-engine.js'
import { createEmbedder } from '@freshair129/gks'
import { BgeReranker } from '../../../packages/gks/src/memory/vector/reranker.js' // Direct import for now

const HELP = `msp-recall bench — evaluate and tune retrieval performance

Usage:
  msp-recall bench [--dataset <path>] [--rerank] [--root <dir>] [--json]
  msp-recall bench --help

Flags:
  --dataset <path>   path to benchmark dataset (default: test/bench/fixtures/recall_dataset.json)
  --rerank           enable the second-stage re-ranker (M10c)
  --root <dir>       project root (default: cwd)
  --json             machine-readable output
  --help             this message

Examples:
  msp-recall bench
  msp-recall bench --rerank --json > bench_results.json
`

interface BenchmarkDataset {
  version: string
  queries: Array<{
    query: string
    relevant_ids: string[]
  }>
}

interface AggregateReport {
  timestamp: string
  git_sha?: string
  config: {
    rerank: boolean
    dataset: string
  }
  metrics: {
    avgPrecisionAt1: number
    avgPrecisionAt3: number
    avgPrecisionAt10: number
    avgRecallAt10: number
    meanReciprocalRank: number
  }
  latency: {
    p50: number
    p90: number
    total_ms: number
  }
}

async function main(): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        dataset: { type: 'string' },
        rerank: { type: 'boolean' },
        root: { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    })
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n${HELP}`)
    return 2
  }
  const { values } = parsed

  if (values.help) {
    process.stdout.write(HELP)
    return 0
  }

  const root = resolve(values.root ?? process.cwd())
  const datasetPath = resolve(values.dataset ?? join(root, 'packages/msp/test/bench/fixtures/recall_dataset.json'))

  // 1. Load dataset
  let dataset: BenchmarkDataset
  try {
    const raw = await readFile(datasetPath, 'utf8')
    dataset = JSON.parse(raw)
  } catch (err) {
    process.stderr.write(`✗ failed to load dataset: ${(err as Error).message}\n`)
    return 1
  }

  process.stdout.write(`🚀 Starting benchmark on ${dataset.queries.length} queries (rerank: ${!!values.rerank})\n`)

  const results: BenchmarkMetrics[] = []
  const latencies: number[] = []
  const startAll = performance.now()

  // 2. Prepare dependencies
  const embedder = await createEmbedder({ provider: 'nomic' })
  const reranker = values.rerank ? new BgeReranker() : undefined

  // 3. Run queries
  for (let i = 0; i < dataset.queries.length; i++) {
    const { query, relevant_ids } = dataset.queries[i]!
    const progress = `[${i + 1}/${dataset.queries.length}]`
    
    if (!values.json) {
      process.stdout.write(`${progress} Query: "${query}"\n`)
    }

    const qStart = performance.now()
    const recallResult = await recall({
      query,
      root,
      embedder,
      rerank: !!values.rerank,
      reranker: reranker as any, // Cast due to internal/package boundary
      topK: 10,
    })
    const qEnd = performance.now()
    
    const metrics = evaluateQuery(recallResult.hits, relevant_ids)
    results.push(metrics)
    latencies.push(qEnd - qStart)
  }

  const totalTime = performance.now() - startAll

  // 4. Aggregate results
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const sortedLatencies = [...latencies].sort((a, b) => a - b)
  const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0
  const p90 = sortedLatencies[Math.floor(sortedLatencies.length * 0.9)] || 0

  const report: AggregateReport = {
    timestamp: new Date().toISOString(),
    config: {
      rerank: !!values.rerank,
      dataset: datasetPath,
    },
    metrics: {
      avgPrecisionAt1: avg(results.map(r => r.precisionAt1)),
      avgPrecisionAt3: avg(results.map(r => r.precisionAt3)),
      avgPrecisionAt10: avg(results.map(r => r.precisionAt10)),
      avgRecallAt10: avg(results.map(r => r.recallAt10)),
      meanReciprocalRank: calculateMRR(results.map(r => r.mrr)),
    },
    latency: {
      p50,
      p90,
      total_ms: totalTime,
    }
  }

  // 5. Output
  if (values.json) {
    process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  } else {
    process.stdout.write('\n' + '='.repeat(60) + '\n')
    process.stdout.write('BENCHMARK RESULTS\n')
    process.stdout.write('='.repeat(60) + '\n')
    process.stdout.write(`Queries:    ${dataset.queries.length}\n`)
    process.stdout.write(`Rerank:     ${report.config.rerank ? 'ENABLED' : 'DISABLED'}\n`)
    process.stdout.write('-'.repeat(60) + '\n')
    process.stdout.write(`Precision@1:  ${report.metrics.avgPrecisionAt1.toFixed(3)}\n`)
    process.stdout.write(`Precision@3:  ${report.metrics.avgPrecisionAt3.toFixed(3)}\n`)
    process.stdout.write(`Precision@10: ${report.metrics.avgPrecisionAt10.toFixed(3)}\n`)
    process.stdout.write(`Recall@10:    ${report.metrics.avgRecallAt10.toFixed(3)}\n`)
    process.stdout.write(`MRR:          ${report.metrics.meanReciprocalRank.toFixed(3)}\n`)
    process.stdout.write('-'.repeat(60) + '\n')
    process.stdout.write(`Latency p50:  ${report.latency.p50.toFixed(1)}ms\n`)
    process.stdout.write(`Latency p90:  ${report.latency.p90.toFixed(1)}ms\n`)
    process.stdout.write(`Total Time:   ${(report.latency.total_ms / 1000).toFixed(2)}s\n`)
    process.stdout.write('='.repeat(60) + '\n\n')
  }

  return 0
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`✗ unexpected error: ${(err as Error).message}\n`)
    process.exit(2)
  })
