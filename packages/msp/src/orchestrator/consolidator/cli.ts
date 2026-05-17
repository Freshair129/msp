#!/usr/bin/env node
/**
 * msp-consolidate — CLI for the Consolidator orchestrator.
 *
 * Usage:
 *   msp-consolidate --session-id <id> [--root <path>] [--namespace <ns>]
 *                   [--llm-provider ollama|qwen|gemini|mock]
 *                   [--llm-model <name>]
 */
import { parseArgs } from 'node:util'
import { createSlmClient } from '../../codegen/slm/factory.js'
import { consolidate } from './index.js'

const { values } = parseArgs({
  options: {
    'session-id': { type: 'string' },
    root: { type: 'string' },
    namespace: { type: 'string' },
    'llm-provider': { type: 'string', default: 'ollama' },
    'llm-model': { type: 'string' },
    'max-llm-calls': { type: 'string' },
    'llm-timeout-ms': { type: 'string' },
    help: { type: 'boolean', short: 'h' },
  },
  strict: true,
})

if (values.help || !values['session-id']) {
  console.log(`Usage: msp-consolidate --session-id <id> [options]

Options:
  --session-id <id>           Session ID to consolidate (required)
  --root <path>               Workspace root (default: cwd)
  --namespace <ns>            Project namespace (default: evaAI)
  --llm-provider <provider>   LLM backend: ollama|qwen|gemini|mock (default: ollama)
  --llm-model <name>          Model name forwarded to the provider
  --max-llm-calls <n>         Max tier-2 LLM calls per session (default: 20)
  --llm-timeout-ms <ms>       Tier-2 LLM call timeout (default: 8000)
  -h, --help                  Show this help
`)
  process.exit(values.help ? 0 : 1)
}

const providerArg = values['llm-provider'] as string
if (!['ollama', 'qwen', 'gemini', 'mock'].includes(providerArg)) {
  console.error(`Unknown --llm-provider "${providerArg}". Valid: ollama, qwen, gemini, mock`)
  process.exit(1)
}
const provider = providerArg as 'ollama' | 'qwen' | 'gemini' | 'mock'

const llm = createSlmClient({ provider })

const episodes = await consolidate({
  sessionId: values['session-id']!,
  root: values.root,
  namespace: values.namespace,
  llm,
  maxLlmCallsPerSession: values['max-llm-calls'] !== undefined
    ? parseInt(values['max-llm-calls'], 10)
    : undefined,
  llmCallTimeoutMs: values['llm-timeout-ms'] !== undefined
    ? parseInt(values['llm-timeout-ms'], 10)
    : undefined,
})

console.log(JSON.stringify(episodes, null, 2))
