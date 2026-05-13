#!/usr/bin/env node
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'

import { dispatch } from './dispatch.js'
import type { DispatchResult, DispatchTask, Severity, TaskType, Tier } from './types.js'

const HELP = `msp-dispatch — run a task through the T1/T2/T3 agent tier dispatcher

Usage:
  msp-dispatch [options] "<prompt>"
  msp-dispatch --help

Options:
  --tier=<T1|T2|T3>          force a specific tier (else routed automatically)
  --type=<summarize|classify|format|codegen|review|other>  task type (default: other)
  --severity=<critical|regular|low>                        severity (default: regular)
  --context-size=<n>         token estimate (informs routing)
  --deadline-ms=<n>          per-tier run timeout (default: 60000)
  --json                     emit DispatchResult as JSON instead of plain text
  --help                     show this help

Exit codes:
  0  dispatch succeeded (result.ok === true)
  1  dispatch failed at the chosen tier (no escalation succeeded)
  2  bad usage / parse error
`

const VALID_TIERS: readonly Tier[] = ['T1', 'T2', 'T3']
const VALID_TYPES: readonly TaskType[] = [
  'summarize',
  'classify',
  'format',
  'codegen',
  'review',
  'other',
]
const VALID_SEVERITIES: readonly Severity[] = ['critical', 'regular', 'low']

function isTier(value: string): value is Tier {
  return (VALID_TIERS as readonly string[]).includes(value)
}

function isTaskType(value: string): value is TaskType {
  return (VALID_TYPES as readonly string[]).includes(value)
}

function isSeverity(value: string): value is Severity {
  return (VALID_SEVERITIES as readonly string[]).includes(value)
}

function parsePositiveInt(value: string, flag: string): number {
  const n = Number.parseInt(value, 10)
  if (!Number.isFinite(n) || n < 0 || String(n) !== value.trim()) {
    throw new Error(`${flag} must be a non-negative integer, got "${value}"`)
  }
  return n
}

export async function main(): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        tier: { type: 'string' },
        type: { type: 'string' },
        severity: { type: 'string' },
        'context-size': { type: 'string' },
        'deadline-ms': { type: 'string' },
        json: { type: 'boolean' },
        help: { type: 'boolean' },
      },
      allowPositionals: true,
    })
  } catch (err) {
    process.stderr.write(`error: ${(err as Error).message}\n${HELP}`)
    return 2
  }
  const { values, positionals } = parsed

  if (values.help) {
    process.stdout.write(HELP)
    return 0
  }

  if (positionals.length === 0) {
    process.stderr.write(`error: no prompt given\n${HELP}`)
    return 2
  }
  const prompt = positionals.join(' ')

  // --- type
  const typeRaw = values.type ?? 'other'
  if (!isTaskType(typeRaw)) {
    process.stderr.write(
      `error: --type must be one of ${VALID_TYPES.join('|')}, got "${typeRaw}"\n${HELP}`,
    )
    return 2
  }
  const type: TaskType = typeRaw

  // --- severity
  const severityRaw = values.severity ?? 'regular'
  if (!isSeverity(severityRaw)) {
    process.stderr.write(
      `error: --severity must be one of ${VALID_SEVERITIES.join('|')}, got "${severityRaw}"\n${HELP}`,
    )
    return 2
  }
  const severity: Severity = severityRaw

  // --- tier (optional)
  let budgetHint: Tier | undefined
  if (values.tier !== undefined) {
    if (!isTier(values.tier)) {
      process.stderr.write(
        `error: --tier must be one of ${VALID_TIERS.join('|')}, got "${values.tier}"\n${HELP}`,
      )
      return 2
    }
    budgetHint = values.tier
  }

  // --- context-size (optional)
  let contextSize: number | undefined
  if (values['context-size'] !== undefined) {
    try {
      contextSize = parsePositiveInt(values['context-size'], '--context-size')
    } catch (err) {
      process.stderr.write(`error: ${(err as Error).message}\n${HELP}`)
      return 2
    }
  }

  // --- deadline-ms (optional)
  let deadlineMs: number | undefined
  if (values['deadline-ms'] !== undefined) {
    try {
      deadlineMs = parsePositiveInt(values['deadline-ms'], '--deadline-ms')
    } catch (err) {
      process.stderr.write(`error: ${(err as Error).message}\n${HELP}`)
      return 2
    }
  }

  const task: DispatchTask = {
    type,
    severity,
    prompt,
    ...(contextSize !== undefined ? { context_size_tokens: contextSize } : {}),
    ...(budgetHint !== undefined ? { budget_hint: budgetHint } : {}),
    ...(deadlineMs !== undefined ? { deadline_ms: deadlineMs } : {}),
  }

  let result
  try {
    result = await dispatch(task)
  } catch (err) {
    process.stderr.write(`✗ dispatch error: ${(err as Error).message}\n`)
    return 1
  }

  if (values.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n')
  } else {
    process.stdout.write(result.output)
    if (!result.output.endsWith('\n')) process.stdout.write('\n')
  }

  // DispatchResult may carry a runtime `ok` flag indicating failure at the
  // chosen tier with no successful escalation. If present and false, exit 1.
  const okFlag = (result as DispatchResult & { ok?: boolean }).ok
  if (okFlag === false) return 1
  return 0
}

// Auto-run when invoked as a script. When the module is imported (e.g. by
// tests that drive main() directly with a stubbed process.argv), the
// entrypoint path won't match and the side-effect is skipped.
function isDirectInvocation(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  const here = fileURLToPath(import.meta.url)
  // Match either the .ts source (tsx) or the compiled .js (dist).
  return entry === here || entry === here.replace(/\.ts$/, '.js')
}

if (isDirectInvocation()) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      process.stderr.write(`✗ unexpected: ${(err as Error).message}\n`)
      process.exit(2)
    })
}
