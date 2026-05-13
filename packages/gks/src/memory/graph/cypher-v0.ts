/**
 * Cypher v0 parser + planner for GenesisGraphBackend.
 *
 * Grammar (BLUEPRINT--GENESIS-BLOCK-INTEGRATION §"Cypher v0 scope"):
 *
 *   MATCH (a:Label {id: 'literal'})-[r:rel1|rel2*N..M]->(b:Label)
 *   [WHERE b.prop = 'literal' [AND b.other = 'lit']]
 *   RETURN b.id [, length(r) AS hops]
 *
 * Anything else throws GenesisGraphUnsupportedCypher with the offending
 * fragment. The plan is small enough that we execute it against the
 * backend's `neighbors()` call and filter the rest in TS — no real
 * physical planner.
 */

import { GenesisGraphUnsupportedCypher } from './genesis-graph-errors.js'

export interface CypherV0Plan {
  /** Anchor node id (extracted from `(a:Label {id: '...'})` literal). */
  seedId: string
  /** Anchor node label. */
  seedLabel: string
  /** Target node label (after the `->`). */
  targetLabel: string
  /** Relationship type union (`r:a|b|c`). Empty array ⇒ all rels. */
  rels: string[]
  /** Minimum hop count (default 1). */
  minHops: number
  /** Maximum hop count (default 1). */
  maxHops: number
  /** WHERE-clause predicates (conjunction of equality only). */
  predicates: Array<{ alias: 'a' | 'b'; prop: string; equals: string }>
  /** Aliases used in RETURN (e.g. ['b.id', 'length(r) AS hops']). */
  returns: ReturnItem[]
}

export interface ReturnItem {
  kind: 'property' | 'length'
  /** For 'property' kind: the underlying name e.g. `b.id`. */
  source?: string
  /** Output column name. */
  as: string
}

export function parseCypherV0(input: string): CypherV0Plan {
  const src = input.trim()
  if (!src) {
    throw new GenesisGraphUnsupportedCypher('empty query')
  }

  const matchPart = consume(src, /^MATCH\s+/i, 'expected MATCH keyword at start')
  const pattern = readPattern(matchPart.rest)
  const afterPattern = pattern.rest

  let predicates: CypherV0Plan['predicates'] = []
  let rest = afterPattern

  const whereMatch = /^WHERE\s+/i.exec(rest)
  if (whereMatch) {
    rest = rest.slice(whereMatch[0].length)
    const whereResult = readWhere(rest)
    predicates = whereResult.predicates
    rest = whereResult.rest
  }

  const returnMatch = /^RETURN\s+/i.exec(rest)
  if (!returnMatch) {
    throw new GenesisGraphUnsupportedCypher('missing RETURN clause')
  }
  rest = rest.slice(returnMatch[0].length)
  const returns = readReturn(rest.trim())

  return {
    seedId: pattern.seedId,
    seedLabel: pattern.seedLabel,
    targetLabel: pattern.targetLabel,
    rels: pattern.rels,
    minHops: pattern.minHops,
    maxHops: pattern.maxHops,
    predicates,
    returns,
  }
}

function consume(input: string, re: RegExp, message: string): { rest: string } {
  const m = re.exec(input)
  if (!m) throw new GenesisGraphUnsupportedCypher(input.slice(0, 40), message)
  return { rest: input.slice(m[0].length) }
}

interface PatternResult {
  seedId: string
  seedLabel: string
  targetLabel: string
  rels: string[]
  minHops: number
  maxHops: number
  rest: string
}

function readPattern(input: string): PatternResult {
  // (a:Label {id: 'literal'})-[r:rel*1..6]->(b:Label)
  // The anchor `a` and result `b` aliases are required and fixed.
  const re =
    /^\(\s*a\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\{\s*id\s*:\s*(['"])([^'"]+)\2\s*\}\s*\)\s*-\s*\[\s*r\s*:\s*([A-Za-z_|][A-Za-z0-9_|]*)\s*(?:\*\s*(\d+)?\s*(?:\.\.\s*(\d+)?)?\s*)?\]\s*->\s*\(\s*b\s*:\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)\s*/
  const m = re.exec(input)
  if (!m) {
    throw new GenesisGraphUnsupportedCypher(
      input.slice(0, 80),
      'pattern must be (a:Label {id: "..."})-[r:rel*N..M]->(b:Label)',
    )
  }
  const [whole, seedLabel, , seedId, relUnion, minStr, maxStr, targetLabel] = m
  const rels = relUnion!.split('|').filter(Boolean)
  const minHops = minStr ? Number.parseInt(minStr, 10) : 1
  const maxHops = maxStr ? Number.parseInt(maxStr, 10) : minHops
  if (Number.isNaN(minHops) || Number.isNaN(maxHops) || minHops < 1 || maxHops < minHops) {
    throw new GenesisGraphUnsupportedCypher(`${minStr}..${maxStr}`, 'invalid hop range')
  }
  return {
    seedId: seedId!,
    seedLabel: seedLabel!,
    targetLabel: targetLabel!,
    rels,
    minHops,
    maxHops,
    rest: input.slice(whole.length),
  }
}

interface WhereResult {
  predicates: CypherV0Plan['predicates']
  rest: string
}

function readWhere(input: string): WhereResult {
  // Conjunction of equality: `b.prop = 'lit' [AND b.other = 'lit2']`
  const predicates: CypherV0Plan['predicates'] = []
  let remaining = input
  while (true) {
    const m = /^\s*([ab])\.([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(['"])([^'"]*)\3\s*/.exec(remaining)
    if (!m) {
      throw new GenesisGraphUnsupportedCypher(remaining.slice(0, 40), 'WHERE allows only `<a|b>.prop = "literal"`')
    }
    predicates.push({ alias: m[1] as 'a' | 'b', prop: m[2]!, equals: m[4]! })
    remaining = remaining.slice(m[0].length)
    const andMatch = /^AND\s+/i.exec(remaining)
    if (!andMatch) break
    remaining = remaining.slice(andMatch[0].length)
  }
  return { predicates, rest: remaining }
}

function readReturn(input: string): ReturnItem[] {
  if (!input) {
    throw new GenesisGraphUnsupportedCypher('empty RETURN list')
  }
  const items: ReturnItem[] = []
  const parts = splitTopLevelCommas(input)
  for (const part of parts) {
    const trimmed = part.trim()
    const lengthMatch = /^length\s*\(\s*r\s*\)(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_]*))?$/i.exec(trimmed)
    if (lengthMatch) {
      items.push({ kind: 'length', as: lengthMatch[1] ?? 'length_r' })
      continue
    }
    const propMatch = /^([ab])\.([A-Za-z_][A-Za-z0-9_]*)(?:\s+AS\s+([A-Za-z_][A-Za-z0-9_]*))?$/i.exec(trimmed)
    if (propMatch) {
      const source = `${propMatch[1]}.${propMatch[2]}`
      items.push({ kind: 'property', source, as: propMatch[3] ?? source })
      continue
    }
    throw new GenesisGraphUnsupportedCypher(trimmed, 'RETURN allows `a.prop | b.prop | length(r) [AS alias]` only')
  }
  return items
}

function splitTopLevelCommas(s: string): string[] {
  const out: string[] = []
  let depth = 0
  let last = 0
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (c === '(') depth++
    else if (c === ')') depth--
    else if (c === ',' && depth === 0) {
      out.push(s.slice(last, i))
      last = i + 1
    }
  }
  out.push(s.slice(last))
  return out.map((x) => x.trim()).filter((x) => x.length > 0)
}
