#!/usr/bin/env node
/**
 * Rename — "Genesis Block (DB engine)" → "Genesis Graph Backend".
 *
 * Frees the term "Genesis Block" so it can carry the EVA-aligned meaning
 * (composite knowledge unit declared by a FRAME-- manifest atom) without
 * colliding with the storage-engine usage. See ADR--GENESIS-BLOCK-RENAME
 * (this PR) for the rationale.
 *
 * Atom renames (per-atom, not a uniform prefix swap):
 *   CONCEPT--GENESIS-BLOCK-ENGINE        → CONCEPT--GENESIS-GRAPH-BACKEND
 *   ADR--GENESIS-BLOCK-AS-GKS-BACKEND    → ADR--GENESIS-GRAPH-AS-GKS-BACKEND
 *   PROTOCOL--GENESIS-BLOCK-FFI          → PROTOCOL--GENESIS-GRAPH-FFI
 *   BLUEPRINT--GENESIS-BLOCK-INTEGRATION → BLUEPRINT--GENESIS-GRAPH-INTEGRATION
 *   BLUEPRINT--GENESIS-BLOCK-TS-FIRST    → BLUEPRINT--GENESIS-GRAPH-TS-FIRST
 *   SPEC--KNOWLEDGE-BLOCK-MANIFEST       → SPEC--GENESIS-BLOCK-MANIFEST  (revert PR #93)
 *
 * Source-file path references in docs:
 *   packages/gks/src/memory/graph/genesis-block.ts        → genesis-graph.ts
 *   packages/gks/src/memory/graph/genesis-block-errors.ts → genesis-graph-errors.ts
 *
 * Class/symbol names in prose (best-effort; the source code rename is
 * done separately):
 *   "GenesisBlockBackend"               → "GenesisGraphBackend"
 *   "GenesisBlockBackendOptions"        → "GenesisGraphBackendOptions"
 *   "createGenesisBlockBackend"         → "createGenesisGraphBackend"
 *   "GenesisBlockUnsupportedCypher"     → "GenesisGraphUnsupportedCypher"
 *   "GenesisBlockSchemaMismatchError"   → "GenesisGraphSchemaMismatchError"
 *
 * Composite-knowledge naming revert (from PR #93):
 *   "Knowledge Block" (composite) → "Genesis Block" (now unambiguous —
 *   this script runs AFTER the engine renames above, so by the time we
 *   restore "Genesis Block" for the composite, the engine references
 *   already moved to "Genesis Graph Backend".)
 *
 * Usage:
 *   node packages/msp/scripts/msp/migrate-genesisblock-to-genesisgraph.mjs --dry-run
 *   node packages/msp/scripts/msp/migrate-genesisblock-to-genesisgraph.mjs
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const REPO_ROOT = path.resolve(path.dirname(__filename), '..', '..', '..', '..')
const DRY_RUN = process.argv.includes('--dry-run')

// Atom-id mapping (per-atom). Order matters: longest match first so
// `GENESIS-BLOCK-INTEGRATION` is rewritten before bare `GENESIS-BLOCK`.
const ATOM_RENAMES = [
  ['CONCEPT--GENESIS-BLOCK-ENGINE', 'CONCEPT--GENESIS-GRAPH-BACKEND'],
  ['ADR--GENESIS-BLOCK-AS-GKS-BACKEND', 'ADR--GENESIS-GRAPH-AS-GKS-BACKEND'],
  ['PROTOCOL--GENESIS-BLOCK-FFI', 'PROTOCOL--GENESIS-GRAPH-FFI'],
  ['BLUEPRINT--GENESIS-BLOCK-INTEGRATION', 'BLUEPRINT--GENESIS-GRAPH-INTEGRATION'],
  ['BLUEPRINT--GENESIS-BLOCK-TS-FIRST', 'BLUEPRINT--GENESIS-GRAPH-TS-FIRST'],
  ['SPEC--KNOWLEDGE-BLOCK-MANIFEST', 'SPEC--GENESIS-BLOCK-MANIFEST'],
]

// File-path strings in docs that reference the renamed source files.
const PATH_RENAMES = [
  ['packages/gks/src/memory/graph/genesis-block-errors.ts', 'packages/gks/src/memory/graph/genesis-graph-errors.ts'],
  ['packages/gks/src/memory/graph/genesis-block.ts', 'packages/gks/src/memory/graph/genesis-graph.ts'],
  // shorter forms used inside packages/gks/docs/*
  ['src/memory/graph/genesis-block-errors.ts', 'src/memory/graph/genesis-graph-errors.ts'],
  ['src/memory/graph/genesis-block.ts', 'src/memory/graph/genesis-graph.ts'],
]

// Symbol / class-name rewrites in prose (validator runs against the
// renamed source; this fixes doc references).
const SYMBOL_RENAMES = [
  ['GenesisBlockBackendOptions', 'GenesisGraphBackendOptions'],
  ['GenesisBlockBackend', 'GenesisGraphBackend'],
  ['createGenesisBlockBackend', 'createGenesisGraphBackend'],
  ['GenesisBlockUnsupportedCypher', 'GenesisGraphUnsupportedCypher'],
  ['GenesisBlockSchemaMismatchError', 'GenesisGraphSchemaMismatchError'],
]

// Composite-knowledge revert (PR #93 → this PR). Order: do this LAST
// so prior engine renames are already done.
const COMPOSITE_RENAMES = [
  ['Knowledge Block Manifest', 'Genesis Block Manifest'],
  ['knowledge-block-manifest', 'genesis-block-manifest'],
  ['Knowledge Block', 'Genesis Block'],
  ['knowledge block', 'genesis block'],
]

const stats = {
  filesRenamed: 0,
  atomRefsRewritten: 0,
  pathRefsRewritten: 0,
  symbolRefsRewritten: 0,
  compositeRenamesApplied: 0,
  filesEdited: new Set(),
}

function log(...args) {
  console.log(DRY_RUN ? '[dry-run]' : '[migrate]', ...args)
}

async function exists(p) {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
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

async function renameAtomFile(oldId, newId) {
  // Find old atom file path. Atoms live at packages/{gks,msp}/gks/<type>/<id>.md.
  const packages = ['packages/gks/gks', 'packages/msp/gks']
  for (const pkg of packages) {
    const pkgRoot = path.join(REPO_ROOT, pkg)
    const subdirs = await fs.readdir(pkgRoot, { withFileTypes: true }).catch(() => [])
    for (const sub of subdirs) {
      if (!sub.isDirectory()) continue
      const oldFile = path.join(pkgRoot, sub.name, `${oldId}.md`)
      if (!(await exists(oldFile))) continue
      const newFile = path.join(pkgRoot, sub.name, `${newId}.md`)
      log(`rename atom ${path.relative(REPO_ROOT, oldFile)} → ${path.relative(REPO_ROOT, newFile)}`)
      if (!DRY_RUN) {
        const content = await fs.readFile(oldFile, 'utf8')
        // Update the frontmatter id: line atomically with the rename.
        const updated = content.replace(
          new RegExp(`^id:\\s*${oldId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm'),
          `id: ${newId}`,
        )
        await fs.writeFile(newFile, updated, 'utf8')
        await fs.unlink(oldFile)
      }
      stats.filesRenamed++
      return
    }
  }
  log(`warn: atom ${oldId} not found — skipping rename`)
}

async function rewriteReferences() {
  const mdFiles = await listMarkdownFiles(REPO_ROOT)
  for (const file of mdFiles) {
    const original = await fs.readFile(file, 'utf8')
    let updated = original

    // 1. Atom-id rewrites.
    for (const [oldId, newId] of ATOM_RENAMES) {
      const re = new RegExp(`\\b${oldId.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'g')
      const before = updated
      updated = updated.replace(re, () => {
        stats.atomRefsRewritten++
        return newId
      })
      if (before !== updated) stats.filesEdited.add(file)
    }

    // 2. File-path rewrites (literal substring; not regex).
    for (const [oldPath, newPath] of PATH_RENAMES) {
      const before = updated
      let count = 0
      while (updated.includes(oldPath)) {
        updated = updated.replace(oldPath, newPath)
        count++
      }
      if (count > 0) {
        stats.pathRefsRewritten += count
        stats.filesEdited.add(file)
      }
      if (before === updated) {
        // unchanged — fall through
      }
    }

    // 3. Symbol rewrites in prose. Word-boundary not strict for TS
    // identifiers (they can have leading capitals); use simple substring.
    for (const [oldSym, newSym] of SYMBOL_RENAMES) {
      const re = new RegExp(`\\b${oldSym}\\b`, 'g')
      const before = updated
      updated = updated.replace(re, () => {
        stats.symbolRefsRewritten++
        return newSym
      })
      if (before !== updated) stats.filesEdited.add(file)
    }

    // 4. Composite-knowledge revert (last, to avoid double-rewrite).
    for (const [oldText, newText] of COMPOSITE_RENAMES) {
      // Case-sensitive replace — preserves the user-facing variants.
      const re = new RegExp(oldText.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&'), 'g')
      const before = updated
      updated = updated.replace(re, () => {
        stats.compositeRenamesApplied++
        return newText
      })
      if (before !== updated) stats.filesEdited.add(file)
    }

    if (updated !== original) {
      if (!DRY_RUN) await fs.writeFile(file, updated, 'utf8')
    }
  }
}

async function main() {
  log(`mode: ${DRY_RUN ? 'DRY RUN' : 'APPLY'}`)
  log(`repo root: ${REPO_ROOT}`)

  // Step 1: rename atom files (also rewrites the frontmatter id of the
  // moved file).
  for (const [oldId, newId] of ATOM_RENAMES) {
    await renameAtomFile(oldId, newId)
  }

  // Step 2: sweep every .md file for atom-id refs, file-path refs,
  // symbol-name refs, and the composite-knowledge revert.
  await rewriteReferences()

  console.log('')
  console.log('Summary:')
  console.log(`  atom files renamed:        ${stats.filesRenamed}`)
  console.log(`  atom-id refs rewritten:    ${stats.atomRefsRewritten}`)
  console.log(`  file-path refs rewritten:  ${stats.pathRefsRewritten}`)
  console.log(`  symbol refs rewritten:     ${stats.symbolRefsRewritten}`)
  console.log(`  composite renames applied: ${stats.compositeRenamesApplied}`)
  console.log(`  markdown files edited:     ${stats.filesEdited.size}`)
  if (DRY_RUN) {
    console.log('')
    console.log('(no files were modified — pass without --dry-run to apply)')
  } else {
    console.log('')
    console.log('Next:')
    console.log('  1. Source-code rename: TS class + file rename (separate commit)')
    console.log('  2. npm run msp:index')
    console.log('  3. npm run typecheck')
    console.log('  4. npm test')
  }
}

main().catch((err) => {
  console.error('migration failed:', err)
  process.exit(1)
})
