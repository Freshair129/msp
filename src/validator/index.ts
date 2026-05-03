import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

import { parseFile } from './parse.js'
import { adrMonotonic } from './rules/adr-monotonic.js'
import { danglingWikilinks } from './rules/dangling-wikilinks.js'
import { forbiddenFields } from './rules/forbidden-fields.js'
import { futureDate } from './rules/future-date.js'
import { idFilenameMatch } from './rules/id-filename-match.js'
import { idFormat } from './rules/id-format.js'
import { phaseStatus } from './rules/phase-status.js'
import { summaryMin } from './rules/summary-min.js'
import {
  ValidatorIOError,
  type Rule,
  type ValidationContext,
  type ValidationResult,
} from './types.js'

export const HARD_RULES: Rule[] = [
  forbiddenFields,
  idFormat,
  idFilenameMatch,
  adrMonotonic,
  danglingWikilinks,
  futureDate,
  summaryMin,
  phaseStatus,
]

const MAX_ERRORS_PER_FILE = 50

export async function validate(
  filepath: string,
  ctx: ValidationContext,
): Promise<ValidationResult> {
  const result: ValidationResult = { filepath, errors: [], warnings: [] }
  let atom
  try {
    atom = await parseFile(filepath)
  } catch (err) {
    if (err instanceof ValidatorIOError) {
      result.errors.push({
        rule: 'parse',
        severity: 'error',
        message: err.message,
      })
      return result
    }
    throw err
  }

  for (const rule of HARD_RULES) {
    if (result.errors.length >= MAX_ERRORS_PER_FILE) break
    for (const e of rule(atom, ctx)) {
      if (e.severity === 'error') {
        if (result.errors.length < MAX_ERRORS_PER_FILE) result.errors.push(e)
      } else {
        result.warnings.push(e)
      }
    }
  }
  return result
}

async function* walkMd(dir: string): AsyncGenerator<string> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') return
    throw err
  }
  for (const entry of entries) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '00_index') continue
      yield* walkMd(p)
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      yield p
    }
  }
}

export async function validateAll(
  rootDirs: string[],
  ctx: ValidationContext,
): Promise<ValidationResult[]> {
  const out: ValidationResult[] = []
  for (const dir of rootDirs) {
    for await (const file of walkMd(dir)) {
      out.push(await validate(file, ctx))
    }
  }
  return out
}

export { loadAtomicIndex } from './atomic-index.js'
export type {
  AtomicIndexEntry,
  ParsedAtom,
  Severity,
  ValidationContext,
  ValidationError,
  ValidationResult,
  Wikilink,
} from './types.js'
