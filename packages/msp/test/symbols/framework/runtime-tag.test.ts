import { describe, expect, it } from 'vitest'
import { RuntimeTagRecognizer } from '../../../src/symbols/framework/runtime-tag.js'

describe('RuntimeTagRecognizer', () => {
  const recognizer = new RuntimeTagRecognizer()
  const root = 'C:/repo'

  it('detects use client', async () => {
    const source = '"use client";\nexport function ClientComp() {}'
    const result = await recognizer.recognize('C:/repo/comp.tsx', root, source)
    expect(result.nodes[0].attrs?.runtime).toBe('client')
  })

  it('detects use server', async () => {
    const source = "'use server';\nexport async function myAction() {}"
    const result = await recognizer.recognize('C:/repo/action.ts', root, source)
    expect(result.nodes[0].attrs?.runtime).toBe('server')
  })

  it('defaults to server in Next.js app directory', async () => {
    const source = 'export default function Page() {}'
    const result = await recognizer.recognize('C:/repo/app/page.tsx', root, source)
    expect(result.nodes[0].attrs?.runtime).toBe('server')
  })

  it('returns nothing for files with no tag and not in app directory', async () => {
    const source = 'export const x = 1'
    const result = await recognizer.recognize('C:/repo/lib/utils.ts', root, source)
    expect(result.nodes).toHaveLength(0)
  })
})
