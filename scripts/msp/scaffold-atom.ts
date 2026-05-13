#!/usr/bin/env tsx
/**
 * msp:scaffold-atom — scaffold a new atom file with valid frontmatter.
 *
 * Usage:
 *   npm run msp:scaffold-atom -- --type=<type> --slug=<SLUG> [--title=<title>] [--root=<dir>]
 *
 * Example:
 *   npm run msp:scaffold-atom -- --type=concept --slug=NEW-FEATURE
 *   → creates packages/msp/gks/concept/CONCEPT--NEW-FEATURE.md
 *
 * The generated atom:
 *   - has canonical frontmatter (status: draft, tier: process, source_type: axiomatic)
 *   - has phase derived from type (concept=1, adr/feat/frame/proto/algo=2, blueprint=3, audit=6)
 *   - has created_at = current TH-time (+07:00)
 *   - has a body skeleton with type-appropriate section headers
 *
 * Why: prevents recurring frontmatter errors (wrong status enum, wrong phase,
 * future-date created_at, missing fields). Generated atom passes
 * `msp:validate` immediately.
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

interface Args {
  type?: string
  slug?: string
  title?: string
  root?: string
  force?: boolean
}

const args: Args = {}
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([a-z-]+)(?:=(.*))?$/)
  if (!m) continue
  const [, key, value] = m
  if (key === 'force') {
    args.force = true
  } else if (value !== undefined) {
    ;(args as Record<string, string>)[key!] = value
  }
}

function die(msg: string): never {
  console.error(`scaffold-atom: ${msg}`)
  process.exit(1)
}

if (!args.type) die('missing --type (e.g. --type=concept)')
if (!args.slug) die('missing --slug (e.g. --slug=NEW-FEATURE)')

const type = args.type.toLowerCase()
// Validate slug BEFORE normalizing — reject lowercase, spaces, special chars.
// User must opt in to uppercase convention explicitly.
if (!/^[A-Z][A-Z0-9_-]*$/.test(args.slug)) {
  die(`invalid slug '${args.slug}' — must match ^[A-Z][A-Z0-9_-]*$ (use SCREAMING-KEBAB-CASE)`)
}
const slug = args.slug

// Type → phase + folder
const TYPE_CONFIG: Record<string, { phase: number; folder: string; tier: string; sections: string[] }> = {
  idea:      { phase: 0, folder: 'idea',      tier: 'process',  sections: ['Spark', 'Source'] },
  concept:   { phase: 1, folder: 'concept',   tier: 'process',  sections: ['Problem', 'Hypothesis', 'Scope', 'Out of scope', 'Verification', 'Source'] },
  adr:       { phase: 2, folder: 'adr',       tier: 'process',  sections: ['Context', 'Decision', 'Consequences', 'Alternatives considered', 'Source'] },
  frame:     { phase: 2, folder: 'frame',     tier: 'process',  sections: ['Pattern', 'When to apply', 'Out of scope', 'Source'] },
  feat:      { phase: 2, folder: 'feat',      tier: 'process',  sections: ['User-facing behaviour', 'Verification', 'Out of scope', 'Source'] },
  proto:     { phase: 2, folder: 'proto',     tier: 'safety',   sections: ['Rule', 'Severity', 'Enforcement', 'Counter-example', 'Source'] },
  algo:      { phase: 2, folder: 'algo',      tier: 'process',  sections: ['Inputs', 'Algorithm', 'Complexity', 'Edge cases', 'Source'] },
  master:    { phase: 0, folder: 'master',    tier: 'master',   sections: ['Policy', 'Scope', 'Enforcement', 'Source'] },
  mod:       { phase: 2, folder: 'mod',       tier: 'process',  sections: ['Module boundary', 'Public API', 'Dependencies', 'Source'] },
  protocol:  { phase: 2, folder: 'protocol',  tier: 'process',  sections: ['Interaction surface', 'Message shape', 'Error semantics', 'Source'] },
  blueprint: { phase: 3, folder: 'blueprint', tier: 'process',  sections: ['Geography', 'Acceptance', 'Dependencies', 'Tasks', 'Source'] },
  audit:     { phase: 6, folder: 'audit',     tier: 'process',  sections: ['Scope verified', 'Test results', 'Deviations', 'Anti-hallucination check', 'Follow-ups', 'Source'] },
}

const config = TYPE_CONFIG[type]
if (!config) {
  die(`unknown --type '${args.type}' — must be one of: ${Object.keys(TYPE_CONFIG).join(', ')}`)
}

// Compute paths
const root = resolve(args.root ?? join(process.cwd(), 'packages/msp'))
const filename = `${type.toUpperCase()}--${slug}.md`
const filepath = join(root, 'gks', config.folder, filename)

if (existsSync(filepath) && !args.force) {
  die(`file already exists: ${filepath} (use --force to overwrite)`)
}

// Generate TH-time ISO with +07:00 offset
const now = new Date()
const shifted = new Date(now.getTime() + 7 * 3600 * 1000)
const isoTH = `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(shifted.getUTCDate()).padStart(2, '0')}T${String(shifted.getUTCHours()).padStart(2, '0')}:${String(shifted.getUTCMinutes()).padStart(2, '0')}:${String(shifted.getUTCSeconds()).padStart(2, '0')}.${String(shifted.getUTCMilliseconds()).padStart(3, '0')}+07:00`

const id = `${type.toUpperCase()}--${slug}`
const title = args.title ?? slug.toLowerCase().split('-').map(w => w[0]!.toUpperCase() + w.slice(1)).join(' ')

// Build frontmatter
const frontmatter = `---
id: ${id}
phase: ${config.phase}
type: ${type}
status: draft
tier: ${config.tier}
source_type: axiomatic
vault_id: default
title: ${title}
tags:
  - msp
crosslinks: {}
created_at: ${isoTH}
---

# ${type === 'audit' ? 'AUDIT' : type === 'proto' ? 'PROTO' : type === 'algo' ? 'ALGO' : type.toUpperCase()} — ${title}

`

const body = config.sections.map(s => `## ${s}\n\nTODO\n`).join('\n')

// Ensure directory exists + write
mkdirSync(dirname(filepath), { recursive: true })
writeFileSync(filepath, frontmatter + body)

console.log(`✓ created ${filepath}`)
console.log(`  next steps:`)
console.log(`    1. fill in body sections (TODO markers)`)
console.log(`    2. add crosslinks to related atoms`)
console.log(`    3. npm run msp:validate ${filepath} --root=${root}`)
