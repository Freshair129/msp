#!/usr/bin/env tsx
/**
 * msp:atom-date — print a current Thailand-time (UTC+07:00) ISO 8601
 * timestamp suitable for `created_at` frontmatter in atoms.
 *
 * Why: avoids the recurring "future-date" validator error where agents
 * type local TH wall-clock but append `Z` (UTC) — making the timestamp
 * 7 hours ahead of actual UTC.
 *
 * Usage:
 *   npm run msp:atom-date              → prints current TH-time ISO
 *   npm run msp:atom-date -- --utc     → prints current UTC absolute (Z suffix)
 *
 * Authoring rule (per CLAUDE.md): use the +07:00 form by default.
 */

const args = new Set(process.argv.slice(2))
const wantUtc = args.has('--utc')

const now = new Date()

if (wantUtc) {
  // UTC absolute form — for callers who want Z suffix
  console.log(now.toISOString())
  process.exit(0)
}

// Shift to Bangkok (UTC+07:00) wall-clock and format with offset
const shifted = new Date(now.getTime() + 7 * 3600 * 1000)
const yyyy = shifted.getUTCFullYear()
const mm = String(shifted.getUTCMonth() + 1).padStart(2, '0')
const dd = String(shifted.getUTCDate()).padStart(2, '0')
const hh = String(shifted.getUTCHours()).padStart(2, '0')
const mi = String(shifted.getUTCMinutes()).padStart(2, '0')
const ss = String(shifted.getUTCSeconds()).padStart(2, '0')
const ms = String(shifted.getUTCMilliseconds()).padStart(3, '0')

console.log(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}.${ms}+07:00`)
