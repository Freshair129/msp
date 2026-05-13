#!/usr/bin/env node
/**
 * `msp-master-propose` — scan the vault for Genesis Block manifests,
 * evaluate the 4-of-5 promotion criterion, print coverage, optionally
 * write proposal `.md` files to `gks/inbound/` for human review.
 *
 * Authority: `BLUEPRINT--MASTER-PROMOTION-PIPELINE` § Deliverable 4,
 * `ADR--MASTER-PROMOTION-DOC-TO-CODE` (human-in-the-loop).
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseArgs } from 'node:util'

import {
  proposePromotion,
  renderProposalDocument,
  type Proposal,
} from './promote.js'
import { findGenesisBlocks, type GenesisBlock } from './scanner.js'

const HELP = `msp-master-propose — scan Genesis Blocks, propose Master atoms

Usage:
  msp-master-propose [--root=<dir>] [--write]
  msp-master-propose --help

Flags:
  --root=<dir>    project root (default: cwd)
  --write         write promotable proposals to <root>/gks/inbound/
                  as MASTER--<id>.proposal.md (human reviews + commits to
                  gks/master/ — never auto-promote per
                  ADR--MASTER-PROMOTION-DOC-TO-CODE)
  --help          this message

Output:
  Without --write, prints a table to stdout: one row per Genesis Block,
  showing which of the 5 core dimensions are filled (yes/no) and whether
  the block is promotable (filled_count >= 4 stable members).

  With --write, additionally drops one .proposal.md per promotable block.

Exit codes:
  0  success (zero or more proposals printed / written)
  1  no GENESIS atoms found under <root> (likely wrong --root)
  2  internal error (bad arguments, IO failure)
`

interface CliOptions {
  readonly root: string
  readonly write: boolean
}

interface BlockReport {
  readonly block: GenesisBlock
  readonly proposal: Proposal
}

async function run(opts: CliOptions): Promise<number> {
  const blocks = await findGenesisBlocks(opts.root)
  if (blocks.length === 0) {
    process.stderr.write(
      `[master-propose] no GENESIS atoms found under ${opts.root}\n`,
    )
    return 1
  }

  const reports: BlockReport[] = []
  for (const block of blocks) {
    const proposal = await proposePromotion(block, opts.root)
    reports.push({ block, proposal })
  }

  process.stdout.write(formatTable(reports))

  let written = 0
  if (opts.write) {
    const inboundDir = resolve(opts.root, 'gks', 'inbound')
    await mkdir(inboundDir, { recursive: true })
    for (const r of reports) {
      if (!r.proposal.promotable) continue
      const filename = `${r.proposal.proposed_master_id}.proposal.md`
      const doc = renderProposalDocument(r.proposal)
      await writeFile(join(inboundDir, filename), doc, 'utf8')
      written += 1
    }
  }

  const promotable = reports.filter((r) => r.proposal.promotable).length
  process.stderr.write(
    `[master-propose] scanned ${reports.length} block(s), ${promotable} promotable${
      opts.write ? `, ${written} proposal(s) written to gks/inbound/` : ''
    }\n`,
  )
  return 0
}

function formatTable(reports: readonly BlockReport[]): string {
  const headers = [
    'block',
    'cognitive',
    'algo',
    'runbook',
    'concept',
    'params',
    'filled',
    'promotable',
  ] as const
  const rows: string[][] = [Array.from(headers) as string[]]
  for (const r of reports) {
    const c = r.proposal.coverage
    rows.push([
      r.block.genesisId,
      cell(c.cognitive, c.unresolved, c.not_stable),
      cell(c.algo, c.unresolved, c.not_stable),
      cell(c.runbook, c.unresolved, c.not_stable),
      cell(c.concept, c.unresolved, c.not_stable),
      cell(c.params, c.unresolved, c.not_stable),
      `${c.filled_count}/5`,
      r.proposal.promotable ? 'yes' : 'no',
    ])
  }
  const widths = headers.map((_, i) =>
    Math.max(...rows.map((r) => (r[i] ?? '').length)),
  )
  const lines = rows.map((r) =>
    r.map((cellText, i) => (cellText ?? '').padEnd(widths[i] ?? 0)).join('  '),
  )
  // Insert separator after header.
  const sep = widths.map((w) => '-'.repeat(w)).join('  ')
  return `${lines[0]}\n${sep}\n${lines.slice(1).join('\n')}\n`
}

function cell(
  ids: readonly string[],
  unresolved: readonly string[],
  notStable: readonly string[],
): string {
  if (ids.length === 0) return 'no'
  const blocked = new Set<string>([...unresolved, ...notStable])
  for (const id of ids) {
    if (!blocked.has(id)) return 'yes'
  }
  return 'stub'
}

async function main(): Promise<number> {
  let parsed
  try {
    parsed = parseArgs({
      args: process.argv.slice(2),
      options: {
        root: { type: 'string' },
        write: { type: 'boolean' },
        help: { type: 'boolean' },
      },
      allowPositionals: true,
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
  const opts: CliOptions = {
    root: resolve(values.root ?? process.cwd()),
    write: values.write === true,
  }
  return run(opts)
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    process.stderr.write(`✗ unexpected error: ${(err as Error).message}\n`)
    process.exit(2)
  })
