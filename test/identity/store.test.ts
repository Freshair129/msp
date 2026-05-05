import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { describe, expect, it } from 'vitest'

import {
  identityPath,
  readIdentity,
  resolveOptions,
  writeIdentity,
} from '../../src/identity/store.js'
import { defaultIdentity, type Identity } from '../../src/identity/types.js'

async function freshRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'msp-identity-store-'))
}

describe('identityPath', () => {
  it('joins root + .brain/msp/projects/<ns>/identity.json', () => {
    const p = identityPath('/home/user/work', 'evaAI')
    expect(p).toBe('/home/user/work/.brain/msp/projects/evaAI/identity.json')
  })
})

describe('resolveOptions', () => {
  it('defaults root to cwd and namespace to evaAI', () => {
    const { root, namespace } = resolveOptions()
    expect(root).toBe(process.cwd())
    expect(namespace).toBe('evaAI')
  })

  it('honours explicit overrides', () => {
    const { root, namespace } = resolveOptions({ root: '/r', namespace: 'ns2' })
    expect(root).toBe('/r')
    expect(namespace).toBe('ns2')
  })
})

describe('readIdentity', () => {
  it('returns default-constructed Identity when the file is missing (no file created)', async () => {
    const root = await freshRoot()
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.schemaVersion).toBe(1)
    expect(id.profile.name).toBe('')
    expect(id.profile.tier).toBe('T3')
    expect(id.voice.formality).toBe('neutral')
    expect(id.preferences).toEqual({})
    // Confirm the default-construction did NOT materialise the file.
    await expect(readFile(identityPath(root, 'evaAI'))).rejects.toThrow()
  })

  it('throws when on-disk file has schemaVersion > 1', async () => {
    const root = await freshRoot()
    const path = identityPath(root, 'evaAI')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 2, profile: {}, voice: {}, preferences: {} }),
      'utf8',
    )
    await expect(readIdentity({ root, namespace: 'evaAI' })).rejects.toThrow(
      /schemaVersion=2/,
    )
  })

  it('shallow-merges missing fields with defaults', async () => {
    const root = await freshRoot()
    const path = identityPath(root, 'evaAI')
    await mkdir(dirname(path), { recursive: true })
    // Partial file: profile.name only, no voice, no preferences.
    await writeFile(
      path,
      JSON.stringify({ schemaVersion: 1, profile: { name: 'EVA' } }),
      'utf8',
    )
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.name).toBe('EVA')
    // Missing fields filled from defaults
    expect(id.profile.tier).toBe('T3')
    expect(id.voice.formality).toBe('neutral')
    expect(id.preferences).toEqual({})
  })
})

describe('writeIdentity', () => {
  it('creates the namespace directory and writes valid JSON', async () => {
    const root = await freshRoot()
    const id = defaultIdentity()
    id.profile.name = 'EVA'
    await writeIdentity({ root, namespace: 'evaAI' }, id)
    const text = await readFile(identityPath(root, 'evaAI'), 'utf8')
    const parsed = JSON.parse(text) as Identity
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.profile.name).toBe('EVA')
  })

  it('round-trips through readIdentity', async () => {
    const root = await freshRoot()
    const written = defaultIdentity()
    written.profile.name = 'EVA'
    written.profile.role = 'research assistant'
    written.voice.tone = ['analytical', 'warm']
    written.voice.languagePreference = 'thai+english'
    written.preferences.top_k = { value: 5, expiresAt: null }
    await writeIdentity({ root, namespace: 'evaAI' }, written)
    const loaded = await readIdentity({ root, namespace: 'evaAI' })
    expect(loaded).toEqual(written)
  })

  it('namespace isolation: writing namespace A does not affect namespace B', async () => {
    const root = await freshRoot()
    const a = defaultIdentity()
    a.profile.name = 'EVA-A'
    await writeIdentity({ root, namespace: 'nsA' }, a)
    // nsB still default (file missing)
    const b = await readIdentity({ root, namespace: 'nsB' })
    expect(b.profile.name).toBe('')
    // nsA is intact after nsB read.
    const a2 = await readIdentity({ root, namespace: 'nsA' })
    expect(a2.profile.name).toBe('EVA-A')
  })

  it('forces schemaVersion to 1 on every write', async () => {
    const root = await freshRoot()
    // Pretend caller passed wrong schemaVersion in object literal
    const bogus = {
      ...defaultIdentity(),
      schemaVersion: 99 as unknown as 1,
    }
    await writeIdentity({ root, namespace: 'evaAI' }, bogus)
    const text = await readFile(identityPath(root, 'evaAI'), 'utf8')
    const parsed = JSON.parse(text) as Identity
    expect(parsed.schemaVersion).toBe(1)
  })

  it('atomic write — temp file is gone after rename', async () => {
    const root = await freshRoot()
    const id = defaultIdentity()
    id.profile.name = 'EVA'
    await writeIdentity({ root, namespace: 'evaAI' }, id)
    // Read directory, expect only identity.json (no .tmp.* leftover)
    const { readdir } = await import('node:fs/promises')
    const files = await readdir(dirname(identityPath(root, 'evaAI')))
    expect(files).toContain('identity.json')
    expect(files.filter((f) => f.includes('.tmp.'))).toEqual([])
  })

  it('serialised writes preserve last-writer-wins (in-process)', async () => {
    // Documented constraint per ADR: same-process is fine. Two awaited writes
    // back-to-back must produce the second writer's content.
    const root = await freshRoot()
    const a = defaultIdentity()
    a.profile.name = 'first'
    await writeIdentity({ root, namespace: 'evaAI' }, a)
    const b = defaultIdentity()
    b.profile.name = 'second'
    await writeIdentity({ root, namespace: 'evaAI' }, b)
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.name).toBe('second')
  })

  it('readIdentity uses defaults for missing nested fields (forward-compat)', async () => {
    const root = await freshRoot()
    const path = identityPath(root, 'evaAI')
    await mkdir(dirname(path), { recursive: true })
    // File with only voice.tone — missing voice.formality, etc.
    await writeFile(
      path,
      JSON.stringify({
        schemaVersion: 1,
        voice: { tone: ['analytical'] },
      }),
      'utf8',
    )
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.voice.tone).toEqual(['analytical'])
    expect(id.voice.formality).toBe('neutral')
    expect(id.voice.languagePreference).toBe('auto')
    expect(id.voice.responseCadence).toBe('normal')
  })
})
