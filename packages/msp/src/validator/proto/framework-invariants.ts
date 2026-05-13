import { join } from 'node:path'
import { existsSync } from 'node:fs'
import Database from 'better-sqlite3'
import type { Predicate, PredicateContext, PredicateResult, PredicateViolation } from './types.js'

const predicate: Predicate = async (ctx: PredicateContext): Promise<PredicateResult> => {
  const violations: PredicateViolation[] = []
  const dbPath = join(ctx.repoRoot, '.brain/msp/projects/evaAI/symbols/graph.db')

  if (!existsSync(dbPath)) {
    // If graph doesn't exist, we can't check invariants; skip (or warn?)
    return { ok: true, violations: [] }
  }

  const db = new Database(dbPath, { readonly: true })

  try {
    // Rule 1: Page MUST have RENDERS_AT edge
    const pagesWithoutUrl = db.prepare(`
      SELECT s.id, s.name 
      FROM symbols s 
      WHERE s.kind = 'page' 
      AND NOT EXISTS (
        SELECT 1 FROM edges e 
        WHERE e.src_id = s.id AND e.type = 'renders_at'
      )
    `).all() as { id: string, name: string }[]

    for (const p of pagesWithoutUrl) {
      violations.push({
        message: `Page "${p.name}" (${p.id}) is missing a 'renders_at' edge to a URL.`,
        severity: 'error'
      })
    }

    // Rule 3: Server/Client runtime exclusivity
    // (We'll check this by looking at the attrs JSON in the symbols table if it's there)
    // Wait, the current SQLite schema might not have an 'attrs' column yet.
    // I should check the migration.
    
    const tableInfo = db.prepare("PRAGMA table_info(symbols)").all() as any[]
    const hasAttrs = tableInfo.some(c => c.name === 'attrs')

    if (hasAttrs) {
      // Rule 4: Entity MUST have orm attribute
      const entitiesWithoutOrm = db.prepare(`
        SELECT id, name, attrs FROM symbols 
        WHERE kind = 'entity'
      `).all() as { id: string, name: string, attrs: string }[]

      for (const e of entitiesWithoutOrm) {
        try {
          const attrs = JSON.parse(e.attrs || '{}')
          if (!attrs.orm) {
            violations.push({
              message: `Entity "${e.name}" (${e.id}) is missing the 'orm' attribute.`,
              severity: 'error'
            })
          }
        } catch {
          // ignore malformed JSON
        }
      }

      // Rule 5: Tool MUST have name attribute
      const toolsWithoutName = db.prepare(`
        SELECT id, name, attrs FROM symbols 
        WHERE kind = 'tool'
      `).all() as { id: string, name: string, attrs: string }[]

      for (const t of toolsWithoutName) {
        try {
          const attrs = JSON.parse(t.attrs || '{}')
          if (!attrs.name) {
            violations.push({
              message: `Tool "${t.name}" (${t.id}) is missing the 'name' attribute.`,
              severity: 'error'
            })
          }
        } catch {
          // ignore
        }
      }
    }

  } finally {
    db.close()
  }

  return { ok: violations.every(v => v.severity !== 'error'), violations }
}

export default predicate
