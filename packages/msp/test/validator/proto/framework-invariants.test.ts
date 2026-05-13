import { describe, expect, it, vi } from 'vitest'
import predicate from '../../../src/validator/proto/framework-invariants.js'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

// Mock better-sqlite3
vi.mock('better-sqlite3', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        prepare: vi.fn().mockReturnValue({
          all: vi.fn().mockReturnValue([]) // default empty
        }),
        close: vi.fn()
      }
    })
  }
})

// Mock existsSync to return true for the DB path
vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs') as any
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true)
  }
})

describe('framework-invariants predicate', () => {
  const repoRoot = 'C:/repo'
  
  it('passes when no violations are found', async () => {
    const result = await predicate({ atomicIndex: [], repoRoot })
    expect(result.ok).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('flags pages without renders_at edges', async () => {
    const Database = (await import('better-sqlite3')).default
    const mockDb = {
      prepare: vi.fn().mockImplementation((query) => {
        if (query.includes('kind = \'page\'')) {
          return { all: () => [{ id: 'page:1', name: 'Home' }] }
        }
        return { all: () => [] }
      }),
      close: vi.fn()
    }
    vi.mocked(Database).mockReturnValue(mockDb as any)

    const result = await predicate({ atomicIndex: [], repoRoot })
    expect(result.ok).toBe(false)
    expect(result.violations[0].message).toContain('missing a \'renders_at\' edge')
  })

  it('flags entities without orm attribute', async () => {
    const Database = (await import('better-sqlite3')).default
    const mockDb = {
      prepare: vi.fn().mockImplementation((query) => {
        if (query.includes('table_info(symbols)')) {
          return { all: () => [{ name: 'attrs' }] }
        }
        if (query.includes('kind = \'entity\'')) {
          return { all: () => [{ id: 'ent:1', name: 'User', attrs: '{}' }] }
        }
        return { all: () => [] }
      }),
      close: vi.fn()
    }
    vi.mocked(Database).mockReturnValue(mockDb as any)

    const result = await predicate({ atomicIndex: [], repoRoot })
    expect(result.ok).toBe(false)
    expect(result.violations.find(v => v.message.includes('missing the \'orm\' attribute'))).toBeDefined()
  })
})
