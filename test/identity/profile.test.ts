import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { setProfile } from '../../src/identity/profile.js'
import { readIdentity } from '../../src/identity/store.js'

async function freshRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'msp-identity-profile-'))
}

describe('setProfile', () => {
  it('writes a profile with set-once createdAt on first write', async () => {
    const root = await freshRoot()
    const fixed = new Date('2026-05-04T12:00:00.000Z')
    await setProfile(
      { root, namespace: 'evaAI' },
      { name: 'EVA', role: 'research assistant', tier: 'T3' },
      () => fixed,
    )
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.name).toBe('EVA')
    expect(id.profile.role).toBe('research assistant')
    expect(id.profile.tier).toBe('T3')
    expect(id.profile.createdAt).toBe('2026-05-04T12:00:00.000Z')
  })

  it('preserves createdAt on subsequent writes', async () => {
    const root = await freshRoot()
    const first = new Date('2026-05-04T12:00:00.000Z')
    const second = new Date('2026-06-15T15:30:00.000Z')
    await setProfile(
      { root, namespace: 'evaAI' },
      { name: 'EVA' },
      () => first,
    )
    // Second call uses a different `now`; createdAt must be the FIRST one.
    await setProfile(
      { root, namespace: 'evaAI' },
      { role: 'updated' },
      () => second,
    )
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.createdAt).toBe('2026-05-04T12:00:00.000Z')
    expect(id.profile.name).toBe('EVA')
    expect(id.profile.role).toBe('updated')
  })

  it('partial merge keeps unspecified fields', async () => {
    const root = await freshRoot()
    await setProfile(
      { root, namespace: 'evaAI' },
      { name: 'EVA', role: 'research', originStory: 'born in May' },
    )
    // Only update role; name + originStory must persist.
    await setProfile({ root, namespace: 'evaAI' }, { role: 'orchestrator' })
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.name).toBe('EVA')
    expect(id.profile.role).toBe('orchestrator')
    expect(id.profile.originStory).toBe('born in May')
  })

  it('refuses caller-supplied createdAt (set-once defends against override)', async () => {
    const root = await freshRoot()
    const real = new Date('2026-05-04T12:00:00.000Z')
    await setProfile({ root, namespace: 'evaAI' }, { name: 'EVA' }, () => real)
    // Caller tries to overwrite createdAt via partial — must be ignored.
    await setProfile(
      { root, namespace: 'evaAI' },
      {
        role: 'r',
        createdAt: '1999-01-01T00:00:00.000Z',
      } as unknown as Partial<import('../../src/identity/types.js').Profile>,
    )
    const id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.createdAt).toBe('2026-05-04T12:00:00.000Z')
  })

  it('does not touch voice or preferences', async () => {
    const root = await freshRoot()
    await setProfile({ root, namespace: 'evaAI' }, { name: 'EVA' })
    const id = await readIdentity({ root, namespace: 'evaAI' })
    // Voice + preferences are still default after setProfile
    expect(id.voice.formality).toBe('neutral')
    expect(id.voice.tone).toEqual([])
    expect(id.preferences).toEqual({})
  })

  it('accepts tier override (T1 / T2 / T3)', async () => {
    const root = await freshRoot()
    await setProfile({ root, namespace: 'evaAI' }, { tier: 'T1' })
    let id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.tier).toBe('T1')
    await setProfile({ root, namespace: 'evaAI' }, { tier: 'T2' })
    id = await readIdentity({ root, namespace: 'evaAI' })
    expect(id.profile.tier).toBe('T2')
  })
})
