import { copyFile, cp, mkdir, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

import { AcceptanceError } from './types.js'

/**
 * Find a usable node_modules/ for the sandbox.
 *
 * In an npm workspace setup, the per-package `packages/<pkg>/node_modules/`
 * directory is usually empty (or absent) because dependencies are hoisted
 * to the workspace root. Walk upward from `start` until we find a
 * `node_modules/` that actually contains packages.
 *
 * Returns the absolute path to a non-empty node_modules dir, or null if
 * none is found within 5 levels up.
 */
async function findWorkspaceNodeModules(start: string): Promise<string | null> {
  let dir = resolve(start)
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, 'node_modules')
    try {
      const entries = await readdir(candidate)
      if (entries.length > 0) return candidate
    } catch {
      // Directory missing — keep walking up.
    }
    const parent = dirname(dir)
    if (parent === dir) break // reached filesystem root
    dir = parent
  }
  return null
}

const SANDBOX_PACKAGE_JSON = JSON.stringify(
  {
    name: 'msp-acceptance-sandbox',
    private: true,
    type: 'module',
  },
  null,
  2,
) + '\n'

const SANDBOX_VITEST_CONFIG = `import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    include: ['test/**/*.test.ts'],
    environment: 'node',
    reporters: ['json'],
  },
})
`

export async function createSandbox(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'msp-accept-'))
}

export async function cleanupSandbox(path: string): Promise<void> {
  await rm(path, { recursive: true, force: true })
}

/**
 * Scaffold the sandbox: package.json, vitest.config.ts, node_modules link.
 * Symlink first; on failure (e.g. cross-fs / Windows), fall back to copy.
 *
 * Workspace-aware: if `<repoRoot>/node_modules` is empty/missing (npm
 * workspace hoists deps to the monorepo root), walks upward to find the
 * actual populated node_modules dir.
 */
export async function scaffoldSandbox(sandbox: string, repoRoot: string): Promise<void> {
  await writeFile(join(sandbox, 'package.json'), SANDBOX_PACKAGE_JSON)
  await writeFile(join(sandbox, 'vitest.config.ts'), SANDBOX_VITEST_CONFIG)

  const sourceModules = await findWorkspaceNodeModules(repoRoot)
  if (!sourceModules) {
    throw new AcceptanceError(
      `scaffoldSandbox: no populated node_modules found above '${repoRoot}'`,
      'sandbox',
    )
  }
  const targetModules = join(sandbox, 'node_modules')
  try {
    await symlink(sourceModules, targetModules, 'dir')
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'EEXIST') return
    if (code === 'EPERM' || code === 'EXDEV') {
      // Cross-filesystem or restricted symlinks → fall back to copy.
      console.warn(`[sandbox] symlink failed (${code}); copying node_modules — slower`)
      await cp(sourceModules, targetModules, { recursive: true, dereference: false })
      return
    }
    throw new AcceptanceError(`scaffoldSandbox: ${(err as Error).message}`, 'sandbox', err)
  }
}

export async function writeCandidate(
  sandbox: string,
  geography: string[],
  code: string,
): Promise<void> {
  // Single-file candidate writes the same code to every geography path.
  // Multi-file split is a future enhancement.
  for (const rel of geography) {
    const dest = join(sandbox, rel)
    await mkdir(dirname(dest), { recursive: true })
    await writeFile(dest, code, 'utf8')
  }
}

export async function copyVerification(
  sandbox: string,
  repoRoot: string,
  files: { src: string; dest: string }[],
): Promise<void> {
  for (const f of files) {
    const dest = join(sandbox, f.dest)
    await mkdir(dirname(dest), { recursive: true })
    await copyFile(resolve(repoRoot, f.src), dest)
  }
}
