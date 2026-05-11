import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { pythonParser } from '../../src/symbols/parser/python.js'

let workDir: string

function writeFile(name: string, content: string): string {
  const path = join(workDir, name)
  writeFileSync(path, content, 'utf8')
  return path
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sg-parser-py-'))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('python parser', () => {
  it('returns module symbol for empty file', async () => {
    const path = writeFile('empty.py', '')
    const { symbols, edges } = await pythonParser.parseFile(path, workDir)
    expect(symbols).toHaveLength(1)
    expect(symbols[0].kind).toBe('module')
    expect(edges).toHaveLength(0)
  })

  it('extracts classes and functions', async () => {
    const path = writeFile('sample.py', `
class User:
    def __init__(self, name):
        self.name = name
    def greet(self):
        print(f"Hello, {self.name}")

def main():
    u = User("Alice")
    u.greet()
`)
    const { symbols, edges } = await pythonParser.parseFile(path, workDir)
    
    const userClass = symbols.find(s => s.name === 'User')
    const initMethod = symbols.find(s => s.name === 'User.__init__')
    const greetMethod = symbols.find(s => s.name === 'User.greet')
    const mainFunc = symbols.find(s => s.name === 'main')
    
    expect(userClass?.kind).toBe('class')
    expect(initMethod?.kind).toBe('method')
    expect(greetMethod?.kind).toBe('method')
    expect(mainFunc?.kind).toBe('function')
    
    // Check defines edges
    const defines = edges.filter(e => e.type === 'defines')
    expect(defines.some(e => e.dst_id === userClass?.id)).toBe(true)
    expect(defines.some(e => e.src_id === userClass?.id && e.dst_id === initMethod?.id)).toBe(true)
  })

  it('detects imports', async () => {
    const path = writeFile('imports.py', `
import os
from sys import path as sys_path
`)
    const { edges } = await pythonParser.parseFile(path, workDir)
    const imports = edges.filter(e => e.type === 'imports')
    expect(imports).toHaveLength(3)
    expect(imports.some(e => e.dst_id === 'external:os:mod')).toBe(true)
    expect(imports.some(e => e.dst_id === 'external:sys:mod')).toBe(true)
    expect(imports.some(e => e.dst_id === 'external:sys:path')).toBe(true)
  })
})
