/**
 * Regex-based COBOL parser for the Symbol Graph layer.
 * 
 * Target: high-level structure (PROGRAM-ID, SECTION, DIVISION) and calls.
 */

import { relative as relativePath } from 'node:path'
import { readFileSync } from 'node:fs'
import type { ParseResult, Symbol, SymbolParser, SymbolKind, Edge, EdgeType } from '../types.js'

const KIND_SHORTHAND: Record<SymbolKind, string> = {
  function: 'func',
  method: 'meth',
  class: 'cls',
  interface: 'iface',
  type: 'type',
  enum: 'enum',
  const: 'const',
  module: 'mod',
  // Framework-aware kinds (Phase 2) — COBOL parser doesn't emit these,
  // but the shorthand map must be exhaustive to satisfy Record<SymbolKind>.
  page: 'page',
  layout: 'layt',
  loading: 'load',
  error_boundary: 'errb',
  route: 'route',
  template: 'tmpl',
  middleware: 'mwre',
  not_found: 'nf',
  entity: 'ent',
  tool: 'tool',
  data_loader: 'dload',
  metadata_loader: 'mload',
}

function toPosix(p: string): string {
  return p.split('\\').join('/')
}

function relPosix(absolutePath: string, repoRoot: string): string {
  return toPosix(relativePath(repoRoot, absolutePath))
}

function makeId(file: string, name: string, kind: SymbolKind): string {
  return `${file}:${name}:${KIND_SHORTHAND[kind]}`
}

function pushEdge(
  edges: Edge[],
  seen: Set<string>,
  src_id: string,
  dst_id: string,
  type: EdgeType,
  resolved: boolean,
): void {
  const key = `${src_id} ${dst_id} ${type}`
  if (seen.has(key)) return
  seen.add(key)
  edges.push({ src_id, dst_id, type, weight: 1.0, resolved })
}

export const cobolParser: SymbolParser = {
  async parseFile(absolutePath: string, repoRoot: string): Promise<ParseResult> {
    try {
      const sourceCode = readFileSync(absolutePath, 'utf8')
      const lines = sourceCode.split(/\r?\n/)
      const relFile = relPosix(absolutePath, repoRoot)
      const createdAt = new Date().toISOString()
      
      const symbols: Symbol[] = []
      const edges: Edge[] = []
      const edgeKeys = new Set<string>()
      
      let moduleId = makeId(relFile, relFile, 'module')
      let currentProgramName = relFile
      
      // Pass 1: Identify Program ID (Module)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim()
        const match = line.match(/PROGRAM-ID\.\s+([\w-]+)\./i)
        if (match) {
          currentProgramName = match[1]!
          moduleId = makeId(relFile, currentProgramName, 'module')
          break
        }
      }
      
      // Emit Module symbol
      symbols.push({
        id: moduleId,
        name: currentProgramName,
        kind: 'module',
        file: relFile,
        start_line: 1,
        end_line: lines.length,
        exported: true,
        parent_id: null,
        signature: null,
        community_id: null,
        created_at: createdAt,
      })
      
      let currentSectionId: string | null = null
      
      // Pass 2: Identify Sections, Divisions, and Calls
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!.trim()
        const lineNum = i + 1
        
        // Sections
        const sectionMatch = line.match(/^\s*([\w-]+)\s+SECTION\./i)
        if (sectionMatch) {
          const name = sectionMatch[1]!
          currentSectionId = makeId(relFile, name, 'function')
          symbols.push({
            id: currentSectionId,
            name,
            kind: 'function',
            file: relFile,
            start_line: lineNum,
            end_line: lineNum, // simple line-based for now
            exported: true,
            parent_id: null,
            signature: `SECTION ${name}`,
            community_id: null,
            created_at: createdAt,
          })
          pushEdge(edges, edgeKeys, moduleId, currentSectionId, 'defines', true)
          continue
        }
        
        // Divisions
        const divisionMatch = line.match(/^\s*([\w-]+)\s+DIVISION\./i)
        if (divisionMatch) {
           // Treat divisions as functional blocks too
           const name = divisionMatch[1]!
           const id = makeId(relFile, name, 'function')
           symbols.push({
             id,
             name,
             kind: 'function',
             file: relFile,
             start_line: lineNum,
             end_line: lineNum,
             exported: true,
             parent_id: null,
             signature: `DIVISION ${name}`,
             community_id: null,
             created_at: createdAt,
           })
           pushEdge(edges, edgeKeys, moduleId, id, 'defines', true)
           currentSectionId = id
           continue
        }
        
        // Calls
        const callMatch = line.match(/CALL\s+"([\w-]+)"/i)
        if (callMatch) {
          const target = callMatch[1]!
          pushEdge(edges, edgeKeys, currentSectionId ?? moduleId, `external:${target}:mod`, 'calls', false)
        }
        
        // Performs
        const performMatch = line.match(/PERFORM\s+([\w-]+)/i)
        if (performMatch) {
          const target = performMatch[1]!
          pushEdge(edges, edgeKeys, currentSectionId ?? moduleId, makeId(relFile, target, 'function'), 'calls', false)
        }
      }
      
      return { symbols, edges }
    } catch (err) {
      console.error(`[cobol-parser] error parsing ${absolutePath}:`, err)
      return { symbols: [], edges: [] }
    }
  }
}
