import type { SlmClient, SlmCall } from '../../codegen/slm/types.js'

export type { SlmCall }

/** A single user/agent turn, read from a session JSONL log. */
export interface Turn {
  sessionId: string
  episodicId: string
  turnId: number
  msgId: string
  speakerId: string
  content: string
  learnId?: string
}

/** A sequence of turns forming a logical unit of conversation. */
export type Chunk = Turn[]

export type Verdict = 'keep' | 'drop' | 'borderline'

/** Discriminant for which scoring tier produced an episode. */
export type ScoreSource = 'tier1' | 'tier2' | 'tier2-default'

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

/** Result of tier-1 deterministic scoring. */
export interface Tier1Result {
  score: number
  verdict: Verdict
  breakdown: Record<string, number>
}

/** Result of tier-2 LLM scoring. */
export interface Tier2Result {
  score: number
  summary: string
  tags: string[]
  source: 'tier2' | 'tier2-default'
}

/** Callable LLM client (alias for SlmClient). */
export type LlmClient = SlmClient

/** Options for the main `consolidate()` orchestrator. */
export interface ConsolidateOptions {
  sessionId: string
  root?: string
  namespace?: string
  llm?: LlmClient
  thresholds?: Partial<Thresholds>
  maxLlmCallsPerSession?: number
  llmCallTimeoutMs?: number
  /** Override the current-time factory (useful for deterministic tests). */
  now?: () => Date
}

/** The final output of consolidation for one contiguous chunk. */
export interface Episode {
  sessionId: string
  turnRange: [number, number]
  summary: string
  score: number
  scoreSource?: ScoreSource
  tags?: string[]
  createdAt?: string
}
