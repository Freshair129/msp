#!/usr/bin/env node
/**
 * Taxonomy v2.3 migration — FRAME-- → FRAMEWORK--
 *
 * Renames the 9 existing FRAME-- atom files, moves them out of `gks/frame/`
 * into `gks/framework/`, rewrites their frontmatter (id + type), and updates
 * every reference across the repo's .md files.
 *
 * Authoritative ADR: gks/adr/ADR--TAXONOMY-V2-3-MIGRATION.md
 *
 * Usage:
 *   node packages/msp/scripts/msp/migrate-frame-to-framework.mjs --dry-run
 *   node packages/msp/scripts/msp/migrate-frame-to-framework.mjs
 *   node packages/msp/scripts/msp/migrate-frame-to-framework.mjs --inverse
 */

import { promises as fs } from 'node:fs'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..', '..')

const DRY_RUN = process.argv.includes('--dry-run')
const INVERSE = process.argv.includes('--inverse')

// The 9 FRAME-- atoms to migrate. Identified by id suffix (the part after FRAME--).
const ATOM_SUFFIXES = [
  'FOUR-LAYERS',
  'AUTHORITY-MATRIX',
  'CROSSLINKS-VOCABULARY',
  'KNOWLEDGE-3-TIER',
  'MSP-ARCHITECTURE',
  'MSP-ARCHITECTURE-V2',
  'PHASE-GOVERNANCE',
  'SCALING-LEVELS',
  'SYMBOL-GRAPH',
]

const FROM_PREFIX = INVERSE ? 'FRAMEWORK--' : 'FRAME--'
const TO_PREFIX = INVERSE ? 'FRAME--' : 'FRAMEWORK--'
const FROM_DIR = INVERSE ? 'framework' : 'frame'
const TO_DIR = INVERSE ? 'frame' : 'framework'
const FROM_TYPE = INVERSE ? 'framework' : 'frame'
const TO_TYPE = INVERSE ? 'frame' : 'framework'

const PACKAGES = ['packages/gks/gks', 'packages/msp/gks']

const stats = {
  filesRenamed: 0,
  refsRewritten: 0,
  refsScanned: 0,
  filesEdited: new Set(),
}

function log(...args) {
  console.log(DRY_RUN ? '[dry-run]' : '[migrate]', ...args)
}

async function fileExists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

async function readUtf8(p) {
  return fs.readFile(p, 'utf8')
}

async function writeUtf8(p, content) {
  if (DRY_RUN) return
  await fs.writeFile(p, content, 'utf8')
}

async function listMarkdownFiles(root) {
  const out = []
  async function walk(dir) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch (err) {
      if (err.code === 'ENOENT') return
      throw err
    }
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git' || e.name === 'dist') continue
        await walk(full)
      } else if (e.isFile() && e.name.endsWith('.md')) {
        out.push(full)
      }
    }
  }
  await walk(root)
  return out
}

async function renameAndRewriteAtomFiles() {
  for (const pkg of PACKAGES) {
    const fromDir = path.join(REPO_ROOT, pkg, FROM_DIR)
    const toDir = path.join(REPO_ROOT, pkg, TO_DIR)

    if (!(await fileExists(fromDir))) continue

    for (const suffix of ATOM_SUFFIXES) {
      const fromFile = path.join(fromDir, `${FROM_PREFIX}${suffix}.md`)
      const toFile = path.join(toDir, `${TO_PREFIX}${suffix}.md`)
      if (!(await fileExists(fromFile))) continue

      if (!DRY_RUN) await fs.mkdir(toDir, { recursive: true })

      const content = await readUtf8(fromFile)
      const rewritten = content
        .replace(new RegExp(`^id:\\s*${FROM_PREFIX}${suffix}\\s*$`, 'm'), `id: ${TO_PREFIX}${suffix}`)
        .replace(new RegExp(`^type:\\s*${FROM_TYPE}\\s*$`, 'm'), `type: ${TO_TYPE}`)

      log(`rename ${path.relative(REPO_ROOT, fromFile)} → ${path.relative(REPO_ROOT, toFile)}`)
      await writeUtf8(toFile, rewritten)
      if (!DRY_RUN) await fs.unlink(fromFile)
      stats.filesRenamed++
    }

    if (!DRY_RUN) {
      try {
        const remaining = await fs.readdir(fromDir)
        if (remaining.length === 0) {
          await fs.rmdir(fromDir)
          log(`removed empty dir ${path.relative(REPO_ROOT, fromDir)}`)
        }
      } catch (err) {
        if (err.code !== 'ENOENT') throw err
      }
    }
  }
}

async function rewriteReferences() {
  const mdFiles = await listMarkdownFiles(REPO_ROOT)
  const patterns = ATOM_SUFFIXES.map((suffix) => ({
    re: new RegExp(`\\b${FROM_PREFIX}${suffix}\\b`, 'g'),
    to: `${TO_PREFIX}${suffix}`,
    suffix,
  }))

  for (const file of mdFiles) {
    const original = await readUtf8(file)
    let updated = original
    let fileRefs = 0
    for (const { re, to } of patterns) {
      updated = updated.replace(re, (match) => {
        fileRefs++
        return to
      })
    }
    stats.refsScanned += fileRefs
    if (fileRefs > 0 && updated !== original) {
      stats.refsRewritten += fileRefs
      stats.filesEdited.add(file)
      log(`rewrote ${fileRefs} ref(s) in ${path.relative(REPO_ROOT, file)}`)
      await writeUtf8(file, updated)
    }
  }
}

async function main() {
  log(`mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}${INVERSE ? ' (INVERSE rollback)' : ''}`)
  log(`repo root: ${REPO_ROOT}`)

  await renameAndRewriteAtomFiles()
  await rewriteReferences()

  console.log('')
  console.log('Summary:')
  console.log(`  atom files renamed: ${stats.filesRenamed}`)
  console.log(`  reference rewrites: ${stats.refsRewritten}`)
  console.log(`  markdown files edited: ${stats.filesEdited.size}`)
  if (DRY_RUN) {
    console.log('')
    console.log('(no files were modified — pass without --dry-run to apply)')
  } else {
    console.log('')
    console.log('Next: regenerate the atom index')
    console.log('  npm run msp:index')
  }
}

main().catch((err) => {
  console.error('migration failed:', err)
  process.exit(1)
})
