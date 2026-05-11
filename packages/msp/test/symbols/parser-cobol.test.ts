import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { cobolParser } from '../../src/symbols/parser/cobol.js'

let workDir: string

function writeFile(name: string, content: string): string {
  const path = join(workDir, name)
  writeFileSync(path, content, 'utf8')
  return path
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sg-parser-cbl-'))
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('cobol parser', () => {
  it('extracts PROGRAM-ID as module', async () => {
    const path = writeFile('hello.cbl', `
       IDENTIFICATION DIVISION.
       PROGRAM-ID. HELLO-WORLD.
       PROCEDURE DIVISION.
           DISPLAY "Hello, World".
           STOP RUN.
`)
    const { symbols } = await cobolParser.parseFile(path, workDir)
    const module = symbols.find(s => s.kind === 'module')
    expect(module?.name).toBe('HELLO-WORLD')
  })

  it('extracts SECTIONS and DIVISIONS', async () => {
    const path = writeFile('complex.cbl', `
       IDENTIFICATION DIVISION.
       PROGRAM-ID. COMPLEX.
       DATA DIVISION.
       PROCEDURE DIVISION.
       MAIN-SECTION SECTION.
           PERFORM SUB-ROUTINE.
           STOP RUN.
       SUB-ROUTINE SECTION.
           CALL "EXT-PROG".
`)
    const { symbols, edges } = await cobolParser.parseFile(path, workDir)
    
    const sections = symbols.filter(s => s.kind === 'function')
    expect(sections.some(s => s.name === 'MAIN-SECTION')).toBe(true)
    expect(sections.some(s => s.name === 'SUB-ROUTINE')).toBe(true)
    
    const calls = edges.filter(e => e.type === 'calls')
    expect(calls.some(e => e.dst_id.includes('SUB-ROUTINE'))).toBe(true)
    expect(calls.some(e => e.dst_id === 'external:EXT-PROG:mod')).toBe(true)
  })
})
