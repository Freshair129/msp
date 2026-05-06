import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'

import { z } from 'zod'

import { errorResult, jsonResult, type ToolHandlerCtx, type ToolTextResult } from '../types.js'

export const name = 'msp_propose'

export const description =
  'Propose a new atom to the MSP inbound queue. Handles phase 0..6 (the wrapper translates phase 6 to GKS phase 5 then patches the file). Returns the proposed_id and inbound file path.'

export const inputSchema = {
  id: z
    .string()
    .describe('Atomic id (TYPE--SLUG, e.g. CONCEPT--FOO or AUDIT--BAR; ADR-NNN also accepted).'),
  title: z.string().describe('Human-readable title (≤ 100 chars).'),
  body: z.string().describe('Body markdown. Pass "placeholder" if you intend to edit before promoting.'),
  phase: z.number().int().min(0).max(6).describe('Atom phase 0..6.'),
  type: z.string().describe('Atom type (concept, adr, feat, blueprint, audit, frame, ...).'),
  root: z.string().optional().describe('Project root (default: server context root).'),
}

export function handler(ctx: ToolHandlerCtx) {
  return async (args: {
    id: string
    title: string
    body: string
    phase: number
    type: string
    root?: string
  }): Promise<ToolTextResult> => {
    const root = resolve(args.root ?? ctx.root)
    const wrapper = resolve(root, 'scripts/msp/propose.mjs')

    const r = spawnSync(
      'node',
      [
        wrapper,
        args.id,
        `--title=${args.title}`,
        `--body=${args.body}`,
        `--phase=${args.phase}`,
        `--type=${args.type}`,
        `--root=${root}`,
      ],
      { encoding: 'utf8', cwd: root },
    )

    if (r.status !== 0) {
      return errorResult(`msp:propose failed (exit ${r.status}): ${r.stderr || r.stdout}`)
    }

    // Wrapper output includes "✓ <id> → <path>"
    const match = (r.stdout + r.stderr).match(/✓\s+(\S+)\s+→\s+(\S+)/)
    if (!match) {
      return jsonResult({ proposed_id: args.id, output: r.stdout })
    }
    return jsonResult({ proposed_id: match[1], inbound_path: match[2] })
  }
}
