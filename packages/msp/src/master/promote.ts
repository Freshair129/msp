/**
 * Master Block promotion — proposal generator (no disk writes).
 *
 * Given a `GenesisBlock` (from `scanner.ts`), runs the dimension analyzer
 * and — when the block is promotable — scaffolds a draft Master atom
 * (frontmatter + canonical 5-section body). The CLI writes the proposal
 * to `gks/inbound/` for human review per `ADR--MASTER-PROMOTION-DOC-TO-CODE`.
 *
 * This module performs read-only filesystem I/O (atom lookup); it never
 * writes. Tests can pass `lookupOverride` to avoid disk entirely.
 */
import { readFile, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { parse as parseYaml } from 'yaml'

import {
  analyzeDimensions,
  type AtomLookup,
  type AtomRecord,
  type DimensionCoverage,
} from './dimensions.js'
import type { GenesisBlock } from './scanner.js'

export interface Proposal {
  readonly promotable: boolean
  readonly coverage: DimensionCoverage
  readonly reason?: string
  readonly proposed_master_id?: string
  readonly proposed_frontmatter?: string
  readonly proposed_body?: string
}

export interface ProposeOptions {
  /** Override the disk-backed lookup. Used by tests. */
  readonly lookupOverride?: AtomLookup
  /** Stamp for `promoted_at` / `created_at`. Defaults to current time. */
  readonly now?: Date
}

/**
 * Generate a Master atom proposal for one Genesis Block.
 *
 * Pure-ish: read-only filesystem access (atom lookup). Returns a `Proposal`
 * either describing the would-be Master or explaining why the block is not
 * yet promotable. Never throws on missing atoms — unresolved members feed
 * back into the coverage's `unresolved` list.
 */
export async function proposePromotion(
  block: GenesisBlock,
  root: string,
  options: ProposeOptions = {},
): Promise<Proposal> {
  const lookup = options.lookupOverride ?? (await buildVaultLookup(root))
  const coverage = analyzeDimensions(block.members, lookup)

  if (!coverage.promotable) {
    const missing = enumerateMissingDimensions(coverage)
    return {
      promotable: false,
      coverage,
      reason: `Only ${coverage.filled_count}/5 dimensions filled; missing: ${missing.join(
        ', ',
      ) || '(none — but stable count <4)'}`,
    }
  }

  const baseName = block.genesisId.replace(/^GENESIS--/, '')
  const proposedMasterId = `MASTER--${baseName}`
  const now = options.now ?? new Date()
  const promotedAt = now.toISOString()
  const createdAt = toIctTimestamp(now)
  const title = block.title ?? `${baseName.replace(/-/g, ' ')} — Master`

  const tags = dedupe([
    'msp',
    'master',
    'promotion',
    ...block.tags.filter((t) => t !== 'genesis' && t !== 'manifest'),
  ])

  const frontmatter = buildFrontmatter({
    id: proposedMasterId,
    promotedFrom: block.genesisId,
    promotedAt,
    createdAt,
    title,
    tags,
    promotionAdr: `ADR--MASTER-PROMOTION-${baseName}`,
  })

  const body = buildBody({
    masterId: proposedMasterId,
    genesisId: block.genesisId,
    coverage,
  })

  return {
    promotable: true,
    coverage,
    proposed_master_id: proposedMasterId,
    proposed_frontmatter: frontmatter,
    proposed_body: body,
  }
}

interface FrontmatterArgs {
  readonly id: string
  readonly promotedFrom: string
  readonly promotedAt: string
  readonly createdAt: string
  readonly title: string
  readonly tags: string[]
  readonly promotionAdr: string
}

function buildFrontmatter(args: FrontmatterArgs): string {
  const lines: string[] = []
  lines.push('---')
  lines.push(`id: ${args.id}`)
  lines.push('phase: 0')
  lines.push('type: master')
  lines.push('status: draft')
  lines.push('tier: master')
  lines.push('source_type: axiomatic')
  lines.push(`promoted_from: ${args.promotedFrom}`)
  lines.push(`promoted_at: ${args.promotedAt}`)
  lines.push(`promotion_adr: ${args.promotionAdr}`)
  lines.push('vault_id: default')
  lines.push(`title: ${args.title}`)
  lines.push('tags:')
  for (const t of args.tags) lines.push(`  - ${t}`)
  lines.push(
    `crosslinks: {"references":["FRAMEWORK--KNOWLEDGE-3-TIER","SPEC--GENESIS-BLOCK-MANIFEST","${args.promotedFrom}"]}`,
  )
  lines.push(`created_at: ${args.createdAt}`)
  lines.push('---')
  return lines.join('\n')
}

interface BodyArgs {
  readonly masterId: string
  readonly genesisId: string
  readonly coverage: DimensionCoverage
}

function buildBody(args: BodyArgs): string {
  const lines: string[] = []
  lines.push(`# MASTER — ${args.masterId.replace(/^MASTER--/, '')}`)
  lines.push('')
  lines.push(
    `> **Auto-generated proposal** from \`${args.genesisId}\`. Human reviewer: fill each section below to fit the 400-token cap, then author the evidence ADR before committing to \`gks/master/\`.`,
  )
  lines.push('')
  lines.push('## Intent')
  lines.push('')
  lines.push('TODO — one-sentence statement of the rule this Master encodes as instinct.')
  lines.push('')
  lines.push('## Why')
  lines.push('')
  lines.push(
    `TODO — cross-context stability evidence. Why is this rule true regardless of session, project, or context? Cite the Genesis Block members:`,
  )
  for (const dim of ['cognitive', 'algo', 'runbook', 'concept', 'params'] as const) {
    const ids = args.coverage[dim]
    if (ids.length > 0) lines.push(`- ${dim}: ${ids.join(', ')}`)
  }
  lines.push('')
  lines.push('## Directives')
  lines.push('')
  lines.push('1. TODO — first imperative directive.')
  lines.push('2. TODO — second imperative directive.')
  lines.push('')
  lines.push('## Apply when')
  lines.push('')
  lines.push('TODO — name the trigger conditions; carve out any exemptions.')
  lines.push('')
  lines.push('## Conflicts with')
  lines.push('')
  lines.push(
    '(none currently — reviewer: scan existing Master atoms for tag overlap before committing.)',
  )
  return lines.join('\n')
}

function enumerateMissingDimensions(coverage: DimensionCoverage): string[] {
  const out: string[] = []
  if (!hasStableHit(coverage.cognitive, coverage)) out.push('cognitive')
  if (!hasStableHit(coverage.algo, coverage)) out.push('algo')
  if (!hasStableHit(coverage.runbook, coverage)) out.push('runbook')
  if (!hasStableHit(coverage.concept, coverage)) out.push('concept')
  if (!hasStableHit(coverage.params, coverage)) out.push('params')
  return out
}

/**
 * Heuristic: a dimension is "missing" for reporting iff none of its listed
 * ids resolved AND were stable. We approximate that by checking the
 * dimension array against the unresolved + not_stable sets — if every id
 * in the dimension appears in one of those lists, the dimension is unfilled.
 */
function hasStableHit(dimIds: readonly string[], coverage: DimensionCoverage): boolean {
  if (dimIds.length === 0) return false
  const blocked = new Set<string>([...coverage.unresolved, ...coverage.not_stable])
  for (const id of dimIds) {
    if (!blocked.has(id)) return true
  }
  return false
}

function dedupe<T>(items: readonly T[]): T[] {
  return Array.from(new Set(items))
}

/**
 * Wall-clock ICT (UTC+07:00) ISO 8601, per repo timezone rule
 * (`CLAUDE.md` § Environment Rules). Returns e.g.
 * `2026-05-14T17:00:00.000+07:00`.
 */
function toIctTimestamp(d: Date): string {
  const ms = d.getTime() + 7 * 60 * 60 * 1000
  const shifted = new Date(ms)
  const yyyy = shifted.getUTCFullYear()
  const mm = pad2(shifted.getUTCMonth() + 1)
  const dd = pad2(shifted.getUTCDate())
  const hh = pad2(shifted.getUTCHours())
  const mi = pad2(shifted.getUTCMinutes())
  const ss = pad2(shifted.getUTCSeconds())
  const msec = String(shifted.getUTCMilliseconds()).padStart(3, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${msec}+07:00`
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/**
 * Build a synchronous atom lookup by pre-scanning `<root>/gks/**` and
 * `<root>/packages/* /gks/**` for every `*.md` file with parseable
 * frontmatter. Results are cached in a `Map` keyed by atom id.
 *
 * Exported for tests; production callers should use `proposePromotion`
 * directly.
 */
export async function buildVaultLookup(root: string): Promise<AtomLookup> {
  const cache = new Map<string, AtomRecord>()
  const roots: string[] = []
  roots.push(resolve(root, 'gks'))
  const packagesRoot = resolve(root, 'packages')
  const pkgs = await readdir(packagesRoot, { withFileTypes: true }).catch(
    () => [] as import('node:fs').Dirent[],
  )
  for (const e of pkgs) {
    if (e.isDirectory()) roots.push(resolve(packagesRoot, e.name, 'gks'))
  }
  for (const dir of roots) {
    await indexAtomDir(dir, cache)
  }
  return (id: string) => cache.get(id) ?? null
}

async function indexAtomDir(
  dir: string,
  cache: Map<string, AtomRecord>,
): Promise<void> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === '.brain'
      ) {
        continue
      }
      await indexAtomDir(full, cache)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    const rec = await tryParseAtomRecord(full)
    if (rec !== null) cache.set(rec.id, rec)
  }
}

const FRONTMATTER_DELIM = '---'

async function tryParseAtomRecord(path: string): Promise<AtomRecord | null> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return null
  }
  if (!raw.startsWith(FRONTMATTER_DELIM)) return null
  const end = raw.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length)
  if (end === -1) return null
  const fmText = raw.slice(FRONTMATTER_DELIM.length, end).trim()
  let parsed: unknown
  try {
    parsed = parseYaml(fmText)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const obj = parsed as Record<string, unknown>
  const id = typeof obj.id === 'string' ? obj.id : null
  const type = typeof obj.type === 'string' ? obj.type : null
  const status = typeof obj.status === 'string' ? obj.status : null
  if (id === null || type === null || status === null) return null
  return { id, type, status }
}

/**
 * Render a proposal as a complete `.proposal.md` document (frontmatter +
 * body), suitable for writing to `gks/inbound/`.
 */
export function renderProposalDocument(proposal: Proposal): string {
  if (!proposal.promotable) {
    throw new Error(
      'renderProposalDocument called on non-promotable proposal — guard with `proposal.promotable` first',
    )
  }
  // Both fields are guaranteed non-null when promotable === true.
  const fm = proposal.proposed_frontmatter ?? ''
  const body = proposal.proposed_body ?? ''
  return `${fm}\n\n${body}\n`
}
