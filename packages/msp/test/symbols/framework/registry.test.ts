import { describe, expect, it } from 'vitest'
import { frameworkRegistry } from '../../../src/symbols/framework/index.js'

describe('FrameworkRegistry', () => {
  const root = 'C:/repo'

  it('coordinates multiple recognizers for a single file', async () => {
    // A file that is both a Next.js page AND a Client Component
    const path = 'C:/repo/app/profile/page.tsx'
    const source = '"use client";\nexport default function Page() {}'
    
    const result = await frameworkRegistry.processFile(path, root, source)
    
    // Should have:
    // 1 node from NextJsRecognizer (page)
    // 1 node from RuntimeTagRecognizer (runtime: client)
    expect(result.nodes).toHaveLength(2)
    
    const kinds = result.nodes.map(n => n.kind)
    expect(kinds).toContain('page')
    expect(kinds).toContain('module')
    
    const runtimes = result.nodes.map(n => n.attrs?.runtime).filter(Boolean)
    expect(runtimes).toContain('client')
  })
})
