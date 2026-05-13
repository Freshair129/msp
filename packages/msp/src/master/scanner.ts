/**
 * Master Block promotion — Genesis Block manifest scanner.
 *
 * Walks the atom vault for `*.md` files whose YAML frontmatter declares
 * `type: genesis`, then extracts each manifest's `members.core.*` ids into
 * a flat list. The scanner is the input to `promote.ts`.
 *
 * Search roots, in priority order:
 *   1. `<root>/gks/genesis/`
 *   2. `<root>/gks/`               (recursive fallback)
 *   3. `<root>/packages/<pkg>/gks/genesis/`  (per-package post-migration)
 *
 * Duplicates by canonical path are de-duped. Files that are unparseable
 * or whose `type !== 'genesis'` are silently skipped.
 *
 * Authority: `SPEC--GENESIS-BLOCK-MANIFEST` § 2.2 (`members:` frontmatter),
 * `BLUEPRINT--MASTER-PROMOTION-PIPELINE` § Deliverable 2.
 */
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { parse as parseYaml } from 'yaml'

export interface GenesisBlock {
  /** The atom id (e.g. `GENESIS--IDENTITY-ENGINE`). */
  readonly genesisId: string
  /** Absolute path to the manifest `.md` file. */
  readonly manifestPath: string
  /** Flat union of `members.core.*` ids in declaration order. */
  readonly members: string[]
  /** Frontmatter `title`, when present (used by `promote.ts`). */
  readonly title: string | null
  /** Frontmatter `tags`, when present and an array of strings. */
  readonly tags: string[]
}

interface ParsedFrontmatter {
  readonly id: string
  readonly type: string
  readonly title: string | null
  readonly tags: string[]
  readonly members: string[]
}

const FRONTMATTER_DELIM = '---'

/**
 * Discover Genesis Block manifests under `root`.
 *
 * Returns one `GenesisBlock` per parsed `type: genesis` atom, sorted by
 * `genesisId` ascending for determinism. Empty array if no manifests are
 * present.
 */
export async function findGenesisBlocks(root: string): Promise<GenesisBlock[]> {
  const seenPaths = new Set<string>()
  const blocks: GenesisBlock[] = []

  const candidates: string[] = []
  candidates.push(resolve(root, 'gks', 'genesis'))
  candidates.push(resolve(root, 'gks'))

  // Per-package genesis directories. Best-effort — skip if `packages/` absent.
  const packagesRoot = resolve(root, 'packages')
  if (await pathExists(packagesRoot)) {
    const pkgEntries = await readdir(packagesRoot, { withFileTypes: true }).catch(
      () => [] as import('node:fs').Dirent[],
    )
    for (const e of pkgEntries) {
      if (e.isDirectory()) {
        candidates.push(resolve(packagesRoot, e.name, 'gks', 'genesis'))
        candidates.push(resolve(packagesRoot, e.name, 'gks'))
      }
    }
  }

  for (const dir of candidates) {
    if (!(await pathExists(dir))) continue
    await scanDir(dir, seenPaths, blocks)
  }

  blocks.sort((a, b) => a.genesisId.localeCompare(b.genesisId))
  return blocks
}

async function scanDir(
  dir: string,
  seenPaths: Set<string>,
  out: GenesisBlock[],
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
      // Skip node_modules / .git / dist-style folders to stay fast.
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === '.brain'
      ) {
        continue
      }
      await scanDir(full, seenPaths, out)
      continue
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) continue
    if (seenPaths.has(full)) continue
    seenPaths.add(full)

    const block = await tryParseManifest(full)
    if (block !== null) out.push(block)
  }
}

async function tryParseManifest(path: string): Promise<GenesisBlock | null> {
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    return null
  }
  const fm = parseFrontmatter(raw)
  if (fm === null) return null
  if (fm.type !== 'genesis') return null
  if (!fm.id.startsWith('GENESIS--')) return null
  return {
    genesisId: fm.id,
    manifestPath: path,
    members: fm.members,
    title: fm.title,
    tags: fm.tags,
  }
}

function parseFrontmatter(source: string): ParsedFrontmatter | null {
  if (!source.startsWith(FRONTMATTER_DELIM)) return null
  const end = source.indexOf(`\n${FRONTMATTER_DELIM}`, FRONTMATTER_DELIM.length)
  if (end === -1) return null
  const fmText = source.slice(FRONTMATTER_DELIM.length, end).trim()
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
  if (id === null || type === null) return null
  const title = typeof obj.title === 'string' ? obj.title : null
  const tags: string[] = []
  if (Array.isArray(obj.tags)) {
    for (const t of obj.tags) if (typeof t === 'string') tags.push(t)
  }
  const members = extractCoreMembers(obj.members)
  return { id, type, title, tags, members }
}

/**
 * Flatten `members.core.{cognitive,algo,runbook,concept,params}` into a
 * single ordered list. Unknown role keys are ignored (optional members
 * are not part of the 5-dimension promotion criterion).
 */
function extractCoreMembers(members: unknown): string[] {
  if (!members || typeof members !== 'object' || Array.isArray(members)) return []
  const m = members as Record<string, unknown>
  const core = m.core
  if (!core || typeof core !== 'object' || Array.isArray(core)) return []
  const c = core as Record<string, unknown>
  const out: string[] = []
  for (const key of ['cognitive', 'algo', 'runbook', 'concept', 'params'] as const) {
    const list = c[key]
    if (Array.isArray(list)) {
      for (const id of list) if (typeof id === 'string') out.push(id)
    }
  }
  return out
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p)
    return true
  } catch {
    return false
  }
}
