import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../src/brain/resolver.js', () => ({
  resolve: vi.fn(),
}))

import { resolve as mockedResolve } from '../../../src/brain/resolver.js'
import { handler, name } from '../../../src/mcp/tools/brain-resolve.js'

const resolveMock = mockedResolve as unknown as ReturnType<typeof vi.fn>

describe('msp_brain_resolve tool', () => {
  beforeEach(() => {
    resolveMock.mockReset()
  })

  it('has the right name', () => {
    expect(name).toBe('msp_brain_resolve')
  })

  it('invokes resolve() with the query and returns hit content blocks', async () => {
    resolveMock.mockResolvedValueOnce([
      {
        atom: { id: 'ADR--ALPHA', type: 'ADR' },
        source: 'project',
        path: '/abs/project/gks/adr/ADR--ALPHA.md',
      },
      {
        atom: { id: 'ADR--BETA', type: 'ADR' },
        source: 'global',
        path: '/abs/global/gks/adr/ADR--BETA.md',
      },
    ])

    const result = await handler({ root: '/tmp/repo' })({ type: 'ADR' })

    expect(resolveMock).toHaveBeenCalledTimes(1)
    expect(resolveMock).toHaveBeenCalledWith({ type: 'ADR' })
    expect(result.isError).toBeUndefined()
    const parsed = JSON.parse(result.content[0]!.text)
    expect(parsed.ok).toBe(true)
    expect(parsed.count).toBe(2)
    expect(parsed.hits).toEqual([
      {
        id: 'ADR--ALPHA',
        type: 'ADR',
        source: 'project',
        path: '/abs/project/gks/adr/ADR--ALPHA.md',
      },
      {
        id: 'ADR--BETA',
        type: 'ADR',
        source: 'global',
        path: '/abs/global/gks/adr/ADR--BETA.md',
      },
    ])
  })

  it('passes id and vault_id through to the resolver', async () => {
    resolveMock.mockResolvedValueOnce([])
    const result = await handler({ root: '/tmp/repo' })({
      id: 'CONCEPT--FOO',
      type: 'CONCEPT',
      vault_id: 'eva',
    })
    expect(resolveMock).toHaveBeenCalledWith({
      id: 'CONCEPT--FOO',
      type: 'CONCEPT',
      vault_id: 'eva',
    })
    const parsed = JSON.parse(result.content[0]!.text)
    expect(parsed.ok).toBe(true)
    expect(parsed.count).toBe(0)
    expect(parsed.hits).toEqual([])
  })

  it('returns isError when an invalid AtomType is passed', async () => {
    const result = await handler({ root: '/tmp/repo' })({ type: 'NOPE' })
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toMatch(/invalid AtomType/)
    expect(resolveMock).not.toHaveBeenCalled()
  })

  it('returns isError when resolve() throws', async () => {
    resolveMock.mockRejectedValueOnce(new Error('disk on fire'))
    const result = await handler({ root: '/tmp/repo' })({ type: 'ADR' })
    expect(result.isError).toBe(true)
    expect(result.content[0]!.text).toMatch(/brain_resolve failed/)
    expect(result.content[0]!.text).toMatch(/disk on fire/)
  })
})
