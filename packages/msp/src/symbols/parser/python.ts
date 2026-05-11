/**
 * Python parser for the Symbol Graph layer using web-tree-sitter.
 */

import { relative as relativePath, join, dirname } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { Parser, Language, Node as SyntaxNode } from 'web-tree-sitter'
import type { ParseResult, Symbol, SymbolParser, SymbolKind, Edge, EdgeType } from '../types.js'

let parserInitialized = false
let pythonLanguage: Language | null = null

const KIND_SHORTHAND: Record<SymbolKind, string> = {
  function: 'func',
  method: 'meth',
  class: 'cls',
  interface: 'iface',
  type: 'type',
  enum: 'enum',
  const: 'const',
  module: 'mod',
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

async function ensureInitialized() {
  if (parserInitialized) return
  
  // Discover web-tree-sitter.wasm path
  const wtWasmPaths = [
    join(process.cwd(), 'node_modules/web-tree-sitter/web-tree-sitter.wasm'),
    join(process.cwd(), '../node_modules/web-tree-sitter/web-tree-sitter.wasm'),
    join(process.cwd(), '../../node_modules/web-tree-sitter/web-tree-sitter.wasm'),
  ]
  let wtWasmPath = ''
  for (const p of wtWasmPaths) {
    if (existsSync(p)) {
      wtWasmPath = p
      break
    }
  }

  if (!wtWasmPath) {
    throw new Error(`Could not find web-tree-sitter.wasm. Checked: ${wtWasmPaths.join(', ')}`)
  }

  await Parser.init({
    locateFile: () => wtWasmPath
  })
  
  // Discover python WASM path
  const possiblePaths = [
    join(process.cwd(), 'node_modules/tree-sitter-python/tree-sitter-python.wasm'),
    join(process.cwd(), '../node_modules/tree-sitter-python/tree-sitter-python.wasm'),
    join(process.cwd(), '../../node_modules/tree-sitter-python/tree-sitter-python.wasm'),
  ]
  
  let wasmPath = ''
  for (const p of possiblePaths) {
    if (existsSync(p)) {
      wasmPath = p
      break
    }
  }
  
  if (!wasmPath) {
    throw new Error(`Could not find tree-sitter-python.wasm. Checked: ${possiblePaths.join(', ')}`)
  }
  
  pythonLanguage = await Language.load(wasmPath)
  parserInitialized = true
}

interface Ctx {
  relFile: string
  moduleId: string
  symbols: Symbol[]
  edges: Edge[]
  edgeKeys: Set<string>
  createdAt: string
  nameMap: Map<string, string>
}

function emitSymbol(ctx: Ctx, sym: Symbol): void {
  ctx.symbols.push(sym)
  ctx.nameMap.set(sym.name, sym.id)
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

export const pythonParser: SymbolParser = {
  async parseFile(absolutePath: string, repoRoot: string): Promise<ParseResult> {
    await ensureInitialized()
    const parser = new Parser()
    parser.setLanguage(pythonLanguage!)
    
    const sourceCode = readFileSync(absolutePath, 'utf8')
    const tree = parser.parse(sourceCode)
    if (!tree) {
      // tree-sitter returned null — return empty result instead of throwing
      return { symbols: [], edges: [] }
    }
    // console.log(`[python-parser] parsing ${absolutePath}, root type: ${tree.rootNode.type}, children: ${tree.rootNode.childCount}`)
    const relFile = relPosix(absolutePath, repoRoot)
    const moduleId = makeId(relFile, relFile, 'module')
    const createdAt = new Date().toISOString()
    
    const ctx: Ctx = {
      relFile,
      moduleId,
      symbols: [],
      edges: [],
      edgeKeys: new Set(),
      createdAt,
      nameMap: new Map(),
    }
    
    // Module symbol
    emitSymbol(ctx, {
      id: moduleId,
      name: relFile,
      kind: 'module',
      file: relFile,
      start_line: 1,
      end_line: tree.rootNode.endPosition.row + 1,
      exported: true,
      parent_id: null,
      signature: null,
      community_id: null,
      created_at: createdAt,
    })
    
    walk(tree.rootNode, ctx, null)
    
    return { symbols: ctx.symbols, edges: ctx.edges }
  }
}

function walk(node: SyntaxNode, ctx: Ctx, parentId: string | null) {
  const type = node.type
  
  if (type === 'class_definition') {
    const nameNode = node.childForFieldName('name')
    if (nameNode) {
      const name = nameNode.text
      const id = makeId(ctx.relFile, name, 'class')
      emitSymbol(ctx, {
        id,
        name,
        kind: 'class',
        file: ctx.relFile,
        start_line: node.startPosition.row + 1,
        end_line: node.endPosition.row + 1,
        exported: true,
        parent_id: parentId,
        signature: null,
        community_id: null,
        created_at: ctx.createdAt,
      })
      pushEdge(ctx.edges, ctx.edgeKeys, parentId ?? ctx.moduleId, id, 'defines', true)
      
      // Check for inheritance
      const superclasses = node.childForFieldName('superclasses')
      if (superclasses) {
        for (const child of superclasses.children) {
          if (child.type === 'identifier') {
            pushEdge(ctx.edges, ctx.edgeKeys, id, `unresolved:${child.text}`, 'extends', false)
          }
        }
      }
      
      // Walk children with class as parent
      for (const child of node.children) {
        if (child.type === 'block') {
          for (const blockChild of child.children) {
            walk(blockChild, ctx, id)
          }
        }
      }
      return // handled children
    }
  }
  
  if (type === 'function_definition') {
    const nameNode = node.childForFieldName('name')
    if (nameNode) {
      const name = nameNode.text
      const kind: SymbolKind = parentId ? 'method' : 'function'
      const symbolId = makeId(ctx.relFile, parentId ? `${ctx.symbols.find(s => s.id === parentId)?.name}.${name}` : name, kind)
      
      emitSymbol(ctx, {
        id: symbolId,
        name: parentId ? `${ctx.symbols.find(s => s.id === parentId)?.name}.${name}` : name,
        kind,
        file: ctx.relFile,
        start_line: node.startPosition.row + 1,
        end_line: node.endPosition.row + 1,
        exported: true,
        parent_id: parentId,
        signature: buildSignature(node),
        community_id: null,
        created_at: ctx.createdAt,
      })
      pushEdge(ctx.edges, ctx.edgeKeys, parentId ?? ctx.moduleId, symbolId, 'defines', true)
      
      // Simple call detection in body
      const body = node.childForFieldName('body')
      if (body) {
        walkForCalls(body, ctx, symbolId)
      }
      return
    }
  }
  
  if (type === 'import_statement') {
    const findDottedNames = (n: SyntaxNode) => {
      if (n.type === 'dotted_name') {
        pushEdge(ctx.edges, ctx.edgeKeys, ctx.moduleId, `external:${n.text}:mod`, 'imports', false)
      } else {
        for (const c of n.children) findDottedNames(c)
      }
    }
    findDottedNames(node)
  }
  
  if (type === 'import_from_statement') {
    const moduleNameNode = node.childForFieldName('module_name')
    const moduleName = moduleNameNode?.text ?? ''
    if (moduleName) {
      pushEdge(ctx.edges, ctx.edgeKeys, ctx.moduleId, `external:${moduleName}:mod`, 'imports', false)
    }
    
    // Also track specific imports from this module
    const findAliased = (n: SyntaxNode) => {
      if (n.type === 'aliased_import') {
        const nameNode = n.childForFieldName('name')
        if (nameNode) {
          pushEdge(ctx.edges, ctx.edgeKeys, ctx.moduleId, `external:${moduleName}:${nameNode.text}`, 'imports', false)
        }
      } else {
        for (const c of n.children) findAliased(c)
      }
    }
    findAliased(node)
  }

  for (const child of node.children) {
    walk(child, ctx, parentId)
  }
}

function walkForCalls(node: SyntaxNode, ctx: Ctx, fromId: string) {
  if (node.type === 'call') {
    const functionNode = node.childForFieldName('function')
    if (functionNode) {
      if (functionNode.type === 'identifier') {
        pushEdge(ctx.edges, ctx.edgeKeys, fromId, `unresolved:${functionNode.text}`, 'calls', false)
      } else if (functionNode.type === 'attribute') {
        const attribute = functionNode.childForFieldName('attribute')
        if (attribute) {
          pushEdge(ctx.edges, ctx.edgeKeys, fromId, `unresolved:${attribute.text}`, 'calls', false)
        }
      }
    }
  }
  for (const child of node.children) {
    walkForCalls(child, ctx, fromId)
  }
}

function buildSignature(node: SyntaxNode): string | null {
  const parameters = node.childForFieldName('parameters')
  if (!parameters) return null
  return `def ${node.childForFieldName('name')?.text ?? ''}${parameters.text}`
}
