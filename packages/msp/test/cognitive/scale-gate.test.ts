import { describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { enforceScaleGate } from '../../src/cognitive/scale-gate.js'
import { ScaleLevelGateError } from '../../src/cognitive/types.js'

interface AtomSeed {
  type: 'concept' | 'adr' | 'feat' | 'blueprint' | 'frame' | 'flow'
  id: string
  status: 'stable' | 'draft' | 'active'
  references?: string[]
}

async function seed(atoms: AtomSeed[]): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'scale-gate-'))
  await mkdir(join(root, 'gks'), { recursive: true })
  await mkdir(join(root, 'gks', '00_index'), { recursive: true })
  for (const a of atoms) {
    await mkdir(join(root, 'gks', a.type), { recursive: true })
    const crosslinks = a.references ? `\ncrosslinks: {"references":${JSON.stringify(a.references)}}` : ''
    const fm = `---\nid: ${a.id}\ntype: ${a.type}\nstatus: ${a.status}\nvault_id: test${crosslinks}\n---\nbody\n`
    await writeFile(join(root, 'gks', a.type, `${a.id}.md`), fm)
  }
  return root
}

describe('enforceScaleGate', () => {
  it('L1 is a no-op even without any atoms', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scale-gate-l1-'))
    await mkdir(join(root, 'gks'), { recursive: true })
    await expect(
      enforceScaleGate({ root, blueprintId: 'BLUEPRINT--MISSING', scale: 'L1' }),
    ).resolves.toBeUndefined()
  })

  it('L2 passes when CONCEPT + ADR + FEAT + BLUEPRINT exist and are stable', async () => {
    const root = await seed([
      {
        type: 'blueprint',
        id: 'BLUEPRINT--TEST',
        status: 'stable',
        references: ['CONCEPT--T', 'ADR--T', 'FEAT--T'],
      },
      { type: 'concept', id: 'CONCEPT--T', status: 'stable' },
      { type: 'adr', id: 'ADR--T', status: 'stable' },
      { type: 'feat', id: 'FEAT--T', status: 'stable' },
    ])
    await expect(
      enforceScaleGate({ root, blueprintId: 'BLUEPRINT--TEST', scale: 'L2' }),
    ).resolves.toBeUndefined()
  })

  it('L2 fails when a required atom is missing', async () => {
    const root = await seed([
      {
        type: 'blueprint',
        id: 'BLUEPRINT--TEST',
        status: 'stable',
        references: ['CONCEPT--T'],
      },
      { type: 'concept', id: 'CONCEPT--T', status: 'stable' },
    ])
    await expect(
      enforceScaleGate({ root, blueprintId: 'BLUEPRINT--TEST', scale: 'L2' }),
    ).rejects.toBeInstanceOf(ScaleLevelGateError)
  })

  it('L3 fails when FRAME or FLOW is missing', async () => {
    const root = await seed([
      {
        type: 'blueprint',
        id: 'BLUEPRINT--TEST',
        status: 'stable',
        references: ['CONCEPT--T', 'ADR--T', 'FEAT--T'],
      },
      { type: 'concept', id: 'CONCEPT--T', status: 'stable' },
      { type: 'adr', id: 'ADR--T', status: 'stable' },
      { type: 'feat', id: 'FEAT--T', status: 'stable' },
    ])
    await expect(
      enforceScaleGate({ root, blueprintId: 'BLUEPRINT--TEST', scale: 'L3' }),
    ).rejects.toBeInstanceOf(ScaleLevelGateError)
  })

  it('treats draft atoms as missing for the gate', async () => {
    const root = await seed([
      {
        type: 'blueprint',
        id: 'BLUEPRINT--TEST',
        status: 'stable',
        references: ['CONCEPT--T', 'ADR--T', 'FEAT--T'],
      },
      { type: 'concept', id: 'CONCEPT--T', status: 'draft' },
      { type: 'adr', id: 'ADR--T', status: 'stable' },
      { type: 'feat', id: 'FEAT--T', status: 'stable' },
    ])
    await expect(
      enforceScaleGate({ root, blueprintId: 'BLUEPRINT--TEST', scale: 'L2' }),
    ).rejects.toBeInstanceOf(ScaleLevelGateError)
  })
})
