/**
 * Cognitive Layer — 60-second quickstart.
 *
 * Run with:
 *   tsx packages/msp/examples/cognitive-layer-quickstart.ts
 *
 * What this does:
 *   1. Creates a MemoryStore + GenesisBlockBackend in a temp dir
 *   2. Remembers two facts
 *   3. Recalls them through the hybrid 4-layer pipeline (§13)
 *   4. Resolves an SSOT conflict via the §14.1 authority hierarchy
 *   5. Prints the count of registered MCP tools
 *
 * Pre-reqs:
 *   - Node ≥ 20
 *   - (Optional) `ollama pull qwen2.5-coder:7b` for real codegen (otherwise
 *     the runner falls back to the deterministic mock).
 */

import { mkdir, mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGenesisBlockBackend } from '@freshair129/gks'

import { createCognitiveLayer } from '../src/cognitive/index.js'
import { REGISTERED_TOOL_NAMES } from '../src/mcp/server.js'

async function main(): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'cognitive-quickstart-'))
  await mkdir(join(root, 'gks', '00_index'), { recursive: true })

  // 1. Bring up the cognitive layer with a Genesis Block graph backend.
  const layer = await createCognitiveLayer({
    root,
    graphBackend: () =>
      createGenesisBlockBackend({
        path: join(root, '.brain', 'msp', 'projects', 'evaAI', 'graph'),
      }),
    slm: { tier: 'T1' }, // default — local Ollama + qwen2.5-coder
  })

  // 2. Remember a couple of facts.
  const a = await layer.remember('Cortex handles planning in the Tri-Brain.', { tags: ['cortex'] })
  const b = await layer.remember('Motor uses Qwen 2.5-Coder for code generation.', {
    tags: ['motor'],
  })

  console.log(`✓ remembered: ${a.id}`)
  console.log(`✓ remembered: ${b.id}`)

  // 3. Recall via the hybrid pipeline.
  const hits = await layer.recall('how does cortex plan?', { topK: 3, scoreThreshold: -1 })
  console.log(`\nRecall returned ${hits.hits.length} hit(s):`)
  for (const h of hits.hits) {
    const tag = h.audit_only ? '[audit-only] ' : ''
    console.log(`  - ${tag}${h.source} ${h.score.toFixed(3)}  ${h.snippet.slice(0, 60)}…`)
  }

  // 4. SSOT conflict resolution.
  const winner = layer.resolveSSOT([
    { id: 'CONCEPT--FOO', type: 'concept', source: 'atom' },
    { id: 'PROTO--FOO', type: 'proto', source: 'atom' },
  ])
  console.log(`\n§14.1 winner: ${winner?.id}`)

  // 5. MCP tool surface.
  console.log(`\nMCP tools registered: ${REGISTERED_TOOL_NAMES.length}`)
  console.log(`  ${REGISTERED_TOOL_NAMES.join(', ')}`)

  // 6. Genesis Block cypher v0 smoke test.
  await layer.graph.addNode({ id: 'FEAT--A', labels: ['Atom'], props: { status: 'stable' } })
  await layer.graph.addNode({ id: 'ADR--A', labels: ['Atom'], props: { status: 'stable' } })
  await layer.graph.addEdge({ from: 'FEAT--A', to: 'ADR--A', rel: 'references' })
  const gb = layer.graph as { cypher?: (q: string) => Promise<Array<Record<string, unknown>>> }
  if (typeof gb.cypher === 'function') {
    const rows = await gb.cypher(
      `MATCH (a:Atom {id: 'FEAT--A'})-[r:references]->(b:Atom) RETURN b.id`,
    )
    console.log(`\nCypher rows: ${JSON.stringify(rows)}`)
  }

  console.log('\nQuickstart done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
