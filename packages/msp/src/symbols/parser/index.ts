/**
 * Parser Registry — dispatches source files to the appropriate language parser.
 */

import { extname } from 'node:path'
import type { SymbolParser, ParseResult } from '../types.js'
import { typescriptParser } from './typescript.js'
import { pythonParser } from './python.js'
import { cobolParser } from './cobol.js'

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
 */
export async function parseFile(absolutePath: string, repoRoot: string): Promise<ParseResult> {
  const parser = getParserForFile(absolutePath)
  return parser.parseFile(absolutePath, repoRoot)
}
