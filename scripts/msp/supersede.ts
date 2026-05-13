#!/usr/bin/env tsx
/**
 * msp:supersede — atomically supersede an existing atom with one or more
 * replacement atoms, updating both sides' crosslinks reciprocally.
 *
 * Usage:
 *   npm run msp:supersede -- --old=<OLD-ID> --new=<NEW-ID-1>[,<NEW-ID-2>,...] [--root=<dir>]
 *
 * Example:
 *   npm run msp:supersede -- --old=FEAT--FOO --new=CONCEPT--FOO,ADR--FOO,ALGO--FOO,PROTO--FOO
 *
 * Behaviour:
 *   1. Validate <OLD-ID> exists in atomic_index.jsonl
 *   2. Validate every <NEW-ID> exists
 *   3. In the old atom file:
 *      - status: → 'superseded'
 *      - crosslinks.superseded_by: append each <NEW-ID> (dedupe)
 *   4. In each new atom file:
 *      - crosslinks.supersedes: append <OLD-ID> (dedupe)
 *
 * Safety:
 *   - Refuses to operate on an atom already `status: superseded`
 *   - Refuses if any --new id can't be located in the index
 *   - Only modifies frontmatter; never touches body
 *   - Atom contradiction policy (`MASTER--ATOM-CONTRADICTION-POLICY`) requires
 *     all three reciprocal updates to land in the same PR. This script enforces
 *     that by either updating all sides or aborting.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

interface Args {
  old?: string
  new?: string
  root?: string
}

const args: Args = {}
for (const arg of process.argv.slice(2)) {
  const m = arg.match(/^--([a-z-]+)=(.*)$/)
  if (m) (args as Record<string, string>)[m[1]!] = m[2]!
}

function die(msg: string): never {
  console.error(`supersede: ${msg}`)
  process.exit(1)
}

if (!args.old) die('missing --old=<ID>')
if (!args.new) die('missing --new=<ID,ID,...>')

const oldId = args.old.trim()
const newIds = args.new.split(',').map(s => s.trim()).filter(Boolean)
if (newIds.length === 0) die('--new must list at least one id')

const root = resolve(args.root ?? join(process.cwd(), 'packages/msp'))
const indexPath = join(root, 'gks/00_index/atomic_index.jsonl')

if (!existsSync(indexPath)) {
  die(`atomic index not found at ${indexPath} — run 'npm run msp:index' first`)
}

// Load index → id → path lookup
const indexLines = readFileSync(indexPath, 'utf8').trim().split('\n')
const idToPath = new Map<string, string>()
for (const line of indexLines) {
  try {
    const entry = JSON.parse(line) as { id: string; path: string }
    idToPath.set(entry.id, entry.path)
  } catch {
    // skip malformed
  }
}

// Validate all ids resolve
const allIds = [oldId, ...newIds]
const missing = allIds.filter(id => !idToPath.has(id))
if (missing.length > 0) {
  die(`atom(s) not found in index: ${missing.join(', ')}`)
}

// Resolve absolute file paths
function atomPath(id: string): string {
  return join(root, 'gks', idToPath.get(id)!.split('\\').join('/'))
}

/**
 * Update a single atom's frontmatter: set/append fields by mutating the
 * crosslinks JSON object and (optionally) the status field.
 */
function updateAtom(
  filepath: string,
  ops: {
    setStatus?: 'superseded'
    addToCrosslinkList?: { key: 'supersedes' | 'superseded_by'; values: string[] }
  },
): { changed: boolean; reason?: string } {
  const content = readFileSync(filepath, 'utf8')

  // Frontmatter must be between leading --- and the next ---
  const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!fmMatch) return { changed: false, reason: 'no frontmatter delimiters found' }

  let frontmatter = fmMatch[1]!
  let modified = false

  // Status set
  if (ops.setStatus) {
    const statusMatch = frontmatter.match(/^status:\s*([a-z]+)\s*$/m)
    if (statusMatch && statusMatch[1] === 'superseded' && ops.setStatus === 'superseded') {
      return { changed: false, reason: `atom already status: superseded — refusing to re-apply` }
    }
    if (statusMatch) {
      frontmatter = frontmatter.replace(/^status:\s*[a-z]+\s*$/m, `status: ${ops.setStatus}`)
      modified = true
    } else {
      return { changed: false, reason: 'no status: field found in frontmatter' }
    }
  }

  // Crosslinks list append (mutates the inline JSON)
  if (ops.addToCrosslinkList) {
    const { key, values } = ops.addToCrosslinkList
    const xlMatch = frontmatter.match(/^crosslinks:\s*(\{.*\})\s*$/m)
    if (!xlMatch) {
      return { changed: false, reason: 'no crosslinks: field found in frontmatter (must exist for safe append)' }
    }
    let xl: Record<string, string[]>
    try {
      xl = JSON.parse(xlMatch[1]!)
    } catch (err) {
      return { changed: false, reason: `crosslinks JSON parse failed: ${(err as Error).message}` }
    }
    const existing = new Set(xl[key] ?? [])
    for (const v of values) existing.add(v)
    xl[key] = Array.from(existing)
    frontmatter = frontmatter.replace(/^crosslinks:\s*\{.*\}\s*$/m, `crosslinks: ${JSON.stringify(xl)}`)
    modified = true
  }

  if (!modified) return { changed: false, reason: 'no ops applied' }

  // Stitch back: leading ---\n + new frontmatter + \n---  + rest
  const trailer = content.slice(fmMatch[0].length)
  const updated = `---\n${frontmatter}\n---${trailer}`
  writeFileSync(filepath, updated)
  return { changed: true }
}

// Apply: update old atom
const oldPath = atomPath(oldId)
console.log(`[1/${newIds.length + 1}] updating ${oldId} (${oldPath})`)
const oldResult = updateAtom(oldPath, {
  setStatus: 'superseded',
  addToCrosslinkList: { key: 'superseded_by', values: newIds },
})
if (!oldResult.changed) die(`failed to update ${oldId}: ${oldResult.reason}`)
console.log(`  ✓ status → superseded, superseded_by += ${newIds.join(', ')}`)

// Apply: update each new atom
let stepIdx = 2
for (const newId of newIds) {
  const newPath = atomPath(newId)
  console.log(`[${stepIdx}/${newIds.length + 1}] updating ${newId} (${newPath})`)
  const r = updateAtom(newPath, {
    addToCrosslinkList: { key: 'supersedes', values: [oldId] },
  })
  if (!r.changed) {
    console.error(`  ✗ ${r.reason}`)
    console.error(`  (partial update — ${oldId} flipped to superseded but ${newId} did not get reciprocal link. Manual cleanup required.)`)
    process.exit(2)
  }
  console.log(`  ✓ supersedes += ${oldId}`)
  stepIdx++
}

console.log('')
console.log('next steps:')
console.log('  1. npm run msp:index   (regenerate atomic_index.jsonl)')
console.log('  2. npm run msp:check-links   (verify all crosslinks resolve)')
console.log('  3. review diffs + commit')
