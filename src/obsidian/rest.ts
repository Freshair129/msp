import { createRestObsidianAdapter } from '@freshair129/gks/memory'

import { isLoopback } from './env.js'
import type { ObsidianClient, SearchHit } from './types.js'

interface RestOpts {
  url: string
  apiKey: string
  timeoutMs: number
  fetchImpl: typeof fetch
}

function smartViewDeepLink(atomId: string): string {
  return `obsidian://advanced-uri?vault=&filename=${encodeURIComponent(atomId)}`
}

export function makeRestClient(opts: RestOpts): ObsidianClient {
  const adapter = createRestObsidianAdapter({
    baseUrl: opts.url.replace(/\/+$/, ''),
    apiKey: opts.apiKey,
    timeoutMs: opts.timeoutMs,
  })
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${opts.apiKey}`,
  }
  return {
    mode: 'rest',
    async search(query, { limit = 10 } = {}) {
      const hits = await adapter.search(query, { limit })
      return hits.map<SearchHit>((h) => ({
        path: h.path,
        title: h.title,
        snippet: h.snippet,
        score: h.score,
      }))
    },
    async readFile(relPath: string) {
      const note = await adapter.resolveWikilink(relPath.replace(/\.md$/i, ''))
      if (!note) throw new Error(`obsidian rest: file not found: ${relPath}`)
      return note.body
    },
    async activeFile() {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
      try {
        const res = await opts.fetchImpl(`${opts.url.replace(/\/+$/, '')}/active/`, {
          headers,
          signal: ctrl.signal,
        })
        if (!res.ok) return null
        const body = (await res.json().catch(() => null)) as { path?: string } | null
        return body?.path ?? null
      } catch {
        return null
      } finally {
        clearTimeout(t)
      }
    },
    smartViewDeepLink,
  }
}

export async function probe(opts: {
  url: string
  apiKey: string
  timeoutMs: number
  fetchImpl: typeof fetch
}): Promise<boolean> {
  if (!isLoopback(opts.url) && opts.url.startsWith('https://')) {
    if (process.env.OBSIDIAN_INSECURE !== 'true') {
      // Non-loopback HTTPS without explicit override is rejected per ADR.
    }
  }
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs)
  try {
    const res = await opts.fetchImpl(`${opts.url.replace(/\/+$/, '')}/`, {
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${opts.apiKey}`,
      },
      signal: ctrl.signal,
    })
    return res.ok || res.status === 401
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}
