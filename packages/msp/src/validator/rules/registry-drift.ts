import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { parse as yamlParse } from 'yaml'
import type { ParsedAtom, ValidationContext, ValidationError } from '../types.js'

let registry: any = null
let typeConfig: Record<string, { phase: number; folder: string; tier: string }> | null = null

function loadRegistry(root: string) {
  if (typeConfig) return typeConfig

  const registryPath = join(root, 'atom_registry.yaml')
  if (!existsSync(registryPath)) {
    return null
  }

  try {
    registry = yamlParse(readFileSync(registryPath, 'utf8'))
    const flat: Record<string, { phase: number; folder: string; tier: string }> = {}
    for (const cluster of Object.values(registry.taxonomy.clusters) as any[]) {
      for (const [id, config] of Object.entries(cluster.types) as [string, any][]) {
        flat[id.toLowerCase()] = config
      }
    }
    typeConfig = flat
    return typeConfig
  } catch (e) {
    return null
  }
}

export function registryDrift(
  atom: ParsedAtom,
  ctx: ValidationContext,
): ValidationError[] {
  const errors: ValidationError[] = []
  
  const root = ctx.root ?? process.cwd()
  const config = loadRegistry(root)

  if (!config) {
    // Cannot validate without registry
    return errors
  }

  const type = atom.fm['type']
  if (typeof type !== 'string') {
    return errors // caught by required-fields
  }

  const typeDef = config[type.toLowerCase()]
  if (!typeDef) {
    errors.push({
      rule: 'registry-drift',
      severity: 'error',
      message: `type '${type}' is not declared in atom_registry.yaml`,
      offending: type,
    })
    return errors
  }

  const phase = atom.fm['phase']
  if (typeof phase === 'number' && phase !== typeDef.phase) {
    errors.push({
      rule: 'registry-drift',
      severity: 'error',
      message: `atom phase (${phase}) drifts from registry phase (${typeDef.phase}) for type '${type}'`,
      offending: String(phase),
    })
  }

  const tier = atom.fm['tier']
  if (typeof tier === 'string' && tier !== typeDef.tier) {
    errors.push({
      rule: 'registry-drift',
      severity: 'warning',
      message: `atom tier ('${tier}') drifts from registry tier ('${typeDef.tier}') for type '${type}'`,
      offending: tier,
    })
  }

  return errors
}
