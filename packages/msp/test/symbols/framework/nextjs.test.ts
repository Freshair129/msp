import { describe, expect, it } from 'vitest'
import { NextJsRecognizer } from '../../../src/symbols/framework/nextjs.js'
import { join } from 'node:path'

describe('NextJsRecognizer', () => {
  const recognizer = new NextJsRecognizer()
  const root = 'C:/repo'

  it('matches valid app router files', () => {
    expect(recognizer.matches('C:/repo/app/page.tsx')).toBe(true)
    expect(recognizer.matches('C:/repo/app/users/layout.ts')).toBe(true)
    expect(recognizer.matches('C:/repo/app/api/route.ts')).toBe(true)
    expect(recognizer.matches('C:/repo/src/app/page.tsx')).toBe(true)
    expect(recognizer.matches('C:/repo/components/button.tsx')).toBe(false)
  })

  it('recognizes a page and derives URL', async () => {
    const path = 'C:/repo/app/users/[id]/page.tsx'
    const result = await recognizer.recognize(path, root)
    
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].kind).toBe('page')
    expect(result.nodes[0].attrs?.url).toBe('/users/:id')
    
    expect(result.edges).toHaveLength(1)
    expect(result.edges[0].type).toBe('renders_at')
    expect(result.edges[0].attrs?.url).toBe('/users/:id')
  })

  it('handles route groups and catch-all segments', async () => {
    const path = 'C:/repo/app/(auth)/login/page.tsx'
    const result = await recognizer.recognize(path, root)
    expect(result.nodes[0].attrs?.url).toBe('/login')

    const catchAllPath = 'C:/repo/app/blog/[...slug]/page.tsx'
    const catchAllResult = await recognizer.recognize(catchAllPath, root)
    expect(catchAllResult.nodes[0].attrs?.url).toBe('/blog/:slug*')
  })
})
