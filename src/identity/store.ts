import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'

import {
  CURRENT_SCHEMA_VERSION,
  DEFAULT_NAMESPACE,
  defaultIdentity,
  defaultProfile,
  defaultVoice,
  type Identity,
  type IdentityOptions,
} from './types.js'

/**
 * Compute the on-disk path for a namespace's identity file.
 * Per ADR: `.brain/msp/projects/<namespace>/identity.json`.
 */
export function identityPath(root: string, namespace: string): string {
  return resolve(root, '.brain/msp/projects', namespace, 'identity.json')
}

/**
 * Resolve `IdentityOptions` to (root, namespace) with defaults applied.
 * Defaults: `root = process.cwd()`, `namespace = 'evaAI'`.
 */
export function resolveOptions(opts?: IdentityOptions): {
  root: string
  namespace: string
} {
  return {
    root: opts?.root ?? process.cwd(),
    namespace: opts?.namespace ?? DEFAULT_NAMESPACE,
  }
}

/**
 * Read the identity file for a namespace.
 *
 * - Missing file → returns `defaultIdentity()`. Does NOT create the file.
 * - File with `schemaVersion > 1` → throws (refuse to clobber newer format).
 * - Missing fields are filled from defaults so callers get a complete shape.
 *
 * Atomic write contract: only writes happen via `writeIdentity` (temp + rename).
 */
export async function readIdentity(opts?: IdentityOptions): Promise<Identity> {
  const { root, namespace } = resolveOptions(opts)
  const path = identityPath(root, namespace)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return defaultIdentity()
    }
    throw err
  }

  const parsed = JSON.parse(raw) as Partial<Identity> & {
    schemaVersion?: number
  }

  if (
    typeof parsed.schemaVersion === 'number' &&
    parsed.schemaVersion > CURRENT_SCHEMA_VERSION
  ) {
    throw new Error(
      `identity.json at ${path} has schemaVersion=${parsed.schemaVersion}; ` +
        `this build only supports up to ${CURRENT_SCHEMA_VERSION}. Refusing to read ` +
        `(forward-compat is undefined; remove or migrate the file).`,
    )
  }

  // Shallow-merge with defaults so a partial file still surfaces a complete shape.
  const base = defaultIdentity()
  const profileBase = defaultProfile()
  const voiceBase = defaultVoice()
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: { ...profileBase, ...(parsed.profile ?? {}) },
    voice: { ...voiceBase, ...(parsed.voice ?? {}) },
    preferences: { ...base.preferences, ...(parsed.preferences ?? {}) },
  }
}

/**
 * Atomically replace the identity file for a namespace.
 *
 * Algorithm (per ADR):
 *   1. mkdir -p the parent directory (first write creates the namespace dir)
 *   2. write to `<path>.tmp.<pid>.<timestamp>`
 *   3. rename(tmp, path) — atomic on POSIX
 *
 * The `schemaVersion` is forced to `CURRENT_SCHEMA_VERSION` on every write.
 */
export async function writeIdentity(
  opts: IdentityOptions | undefined,
  identity: Identity,
): Promise<void> {
  const { root, namespace } = resolveOptions(opts)
  const path = identityPath(root, namespace)
  await mkdir(dirname(path), { recursive: true })
  const payload: Identity = {
    ...identity,
    schemaVersion: CURRENT_SCHEMA_VERSION,
  }
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`
  await writeFile(tmp, JSON.stringify(payload, null, 2), 'utf8')
  await rename(tmp, path)
}
