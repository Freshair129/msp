import { extname } from 'node:path'
import { readFile } from 'node:fs/promises'
import type { SymbolParser, ParseResult, Symbol, Edge, SymbolKind } from '../types.js'
import { typescriptParser } from './typescript.js'
import { pythonParser } from './python.js'
import { cobolParser } from './cobol.js'
import { frameworkRegistry } from '../framework/index.js'

const PARSERS: Record<string, SymbolParser> = {
  // TypeScript / JavaScript
  '.ts': typescriptParser,
  '.tsx': typescriptParser,
  '.js': typescriptParser,
  '.jsx': typescriptParser,
  
  // Python
  '.py': pythonParser,
  
  // COBOL
  '.cbl': cobolParser,
  '.cob': cobolParser,
  '.ccp': cobolParser,
}

const FRAMEWORK_KIND_SHORTHAND: Record<string, string> = {
  page: 'page',
  layout: 'lay',
  loading: 'load',
  error_boundary: 'err',
  route: 'route',
  template: 'templ',
  middleware: 'mid',
  not_found: '404',
  entity: 'ent',
  tool: 'tool',
  data_loader: 'dl',
  metadata_loader: 'ml',
}

function makeFrameworkId(file: string, name: string, kind: SymbolKind): string {
  const shorthand = FRAMEWORK_KIND_SHORTHAND[kind] || 'fw'
  return `${file}:${name}:${shorthand}`
}

export const nullParser: SymbolParser = {
  parseFile: async () => ({ symbols: [], edges: [] })
}

/**
 * Returns the appropriate parser for a given file based on its extension.
 */
export function getParserForFile(filePath: string): SymbolParser {
  const ext = extname(filePath).toLowerCase()
  return PARSERS[ext] ?? nullParser
}

/**
 * Convenience wrapper that dispatches to the right parser and returns the result.
 * Now also includes framework-aware recognition.
 */
export async function parseFile(absolutePath: string, repoRoot: string): Promise<ParseResult> {
  const parser = getParserForFile(absolutePath)
  const result = await parser.parseFile(absolutePath, repoRoot)

  try {
    const sourceCode = await readFile(absolutePath, 'utf-8')
    const fwResult = await frameworkRegistry.processFile(absolutePath, repoRoot, sourceCode)
    
    if (fwResult.nodes.length > 0 || fwResult.edges.length > 0) {
      const now = new Date().toISOString()
      
      // Merge framework nodes
      for (const fwNode of fwResult.nodes) {
        // Assign full ID if missing
        const id = fwNode.id || makeFrameworkId(fwNode.file, fwNode.name, fwNode.kind)
        
        const symbol: Symbol = {
          ...fwNode,
          id,
          community_id: null,
          created_at: now
        }
        result.symbols.push(symbol)
      }

      // Merge framework edges
      for (const fwEdge of fwResult.edges) {
        // If edge has empty src_id, try to link it to the first framework node emitted from this file
        if (fwEdge.src_id === '' && fwResult.nodes.length > 0) {
          const firstNode = fwResult.nodes[0]
          fwEdge.src_id = firstNode.id || makeFrameworkId(firstNode.file, firstNode.name, firstNode.kind)
        }
        result.edges.push(fwEdge)
      }
    }
  } catch (err) {
    // If framework recognition fails, we still return the syntactic results
    console.error(`[framework] recognition failed for ${absolutePath}:`, err)
  }

  return result
}
