import { describe, expect, it } from 'vitest'

import { resolveSSOT } from '../../src/cognitive/ssot.js'

describe('resolveSSOT (§14.1 authority hierarchy)', () => {
  it('returns null on empty input', () => {
    expect(resolveSSOT([])).toBeNull()
  })

  it('Code beats every atom type', () => {
    const winner = resolveSSOT([
      { id: 'PROTO--RULE', type: 'proto', source: 'atom' },
      { id: 'src/x.ts', type: 'code', source: 'code' },
    ])
    expect(winner?.id).toBe('src/x.ts')
  })

  it('PROTO beats MASTER beats ADR beats FRAME beats CONCEPT', () => {
    const winner = resolveSSOT([
      { id: 'CONCEPT--A', type: 'concept', source: 'atom' },
      { id: 'FRAME--A', type: 'frame', source: 'atom' },
      { id: 'ADR--A', type: 'adr', source: 'atom' },
      { id: 'MASTER--A', type: 'master', source: 'atom' },
      { id: 'PROTO--A', type: 'proto', source: 'atom' },
    ])
    expect(winner?.id).toBe('PROTO--A')
  })

  it('unknown types fall to the bottom of the hierarchy', () => {
    const winner = resolveSSOT([
      { id: 'WEIRD--A', type: 'weird', source: 'atom' },
      { id: 'CONCEPT--A', type: 'concept', source: 'atom' },
    ])
    expect(winner?.id).toBe('CONCEPT--A')
  })
})
