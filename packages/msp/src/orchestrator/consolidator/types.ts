import type { SlmClient } from '../../codegen/slm/types.js'
import type { Embedder } from '@freshair129/gks'

/** A single user/agent turn, read from a session log. */
export interface Turn {
  id: string // sequential, e.g. turn_001
  turnId: number // numeric version of id for sorting
  timestamp: string // ISO 8601
  speaker: 'user' | 'agent'
  text: string
  // Aliases and extra fields used in some parts of the codebase
  speakerId?: string
  content?: string
  sessionId?: string
}

/**
 * A sequence of turns forming a logical unit of conversation, to be
 * scored and potentially summarised.
 */
export type Chunk = Turn[]

export type Verdict = 'keep' | 'drop' | 'borderline'

export interface SessionStats {
  turnCount: number
  meanTurnBytes: number
  stddevTurnBytes: number
}

export interface Thresholds {
  low: number
  high: number
  boundary: number
}

/** Alias for SlmClient used across the orchestrator. */
export type LlmClient = SlmClient

/** Options for the main `consolidate()` orchestrator. */
export interface ConsolidateOptions {
  sessionId: string
  namespace?: string
  root?: string
  llm?: SlmClient
  embedder?: Embedder
  thresholds?: Partial<Thresholds>
  maxLlmCallsPerSession?: number
  llmCallTimeoutMs?: number
  now?: () => Date
}

export type ScoreSource = 'tier1' | 'tier2' | 'tier2-default'

export interface Tier1Result {
  score: number
  verdict: Verdict
  breakdown: Record<string, number>
}

export interface Tier2Result {
  score: number
  summary: string
  tags: string[]
  source: 'tier2' | 'tier2-default'
}

/** The final output of consolidation for one contiguous chunk. */
export interface Episode {
  sessionId: string
  turnRange: [number, number] // [startTurnIndex, endTurnIndex]
  summary: string
  tags: string[]
  score: number
  scoreSource: ScoreSource
  createdAt: string // ISO 8601
}

export const DEFAULT_LLM_TIMEOUT_MS = 8000
export const DEFAULT_MAX_LLM_CALLS = 20
export const DEFAULT_THRESHOLDS: Thresholds = {
  low: 0.3,
  high: 0.65,
  boundary: 0.25,
}
