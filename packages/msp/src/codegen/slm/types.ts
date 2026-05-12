export type { SlmClient, SlmCall } from '../types.js'
export { SlmError, type SlmErrorKind } from './errors.js'

export interface OllamaOpts {
  host?: string
  model?: string
  fetchImpl?: typeof fetch
  timeoutMs?: number
  temperature?: number
}

export interface QwenOpts {
  path?: string
  model?: string
  temperature?: number
}

export interface GeminiOpts {
  /** Path / name of the gemini binary. Default: `gemini` (resolved via PATH). */
  binPath?: string
  /** Extra args appended to the call. Default: `['-y']` (auto-accept). */
  extraArgs?: string[]
  /** Model id passed via `-m`. If omitted, Gemini CLI uses its own default. */
  model?: string
  /** Subprocess timeout in ms. Default 600_000 (10 min). */
  timeoutMs?: number
  /** stdout/stderr buffer cap. Default 20 MB. */
  maxBuffer?: number
}

export interface SlmFactoryOpts {
  provider?: 'ollama' | 'mock' | 'qwen' | 'gemini'
  ollama?: OllamaOpts
  qwen?: QwenOpts
  gemini?: GeminiOpts
}
