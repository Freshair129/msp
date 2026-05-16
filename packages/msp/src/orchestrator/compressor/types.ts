import type { Turn, Episode } from '../consolidator/types.js'
import type { SlmClient } from '../../codegen/slm/types.js'

export type LlmClient = SlmClient

/**
 * An episode within the Compressor. This represents a logical chunk of a
 * conversation that has been scored and summarised by the Consolidator.
 */
export interface CompressorEpisode extends Episode {
  /** The full turns making up this episode. */
  turns: Turn[]
  /** An optional atomId if this episode is derived from an atom (e.g. episodic). */
  atomId?: string
}

/** Options for the main `compress()` orchestrator. */
export interface CompressOptions {
  /** Episodes to compress, sorted importance-descending. */
  episodes: CompressorEpisode[]
  /** Target token budget for the entire context window. */
  budgetTokens: number
  /** LLM client for Tier-3 resummarisation. */
  llm?: SlmClient
  /** Model name for LLM calls (e.g. 'compressor'). */
  llmModel?: string
  /** Timeout for LLM calls in ms. */
  llmTimeoutMs?: number
  /** Custom tokeniser for estimating text length. */
  tokeniser?: Tokeniser
  /** If true, preserves the original order of episodes in the output. */
  preserveOrder?: boolean
}

/** Result of the `compress()` orchestrator. */
export interface CompressResult {
  compressed: CompressedEpisode[]
  totalTokensUsed: number
  tierCounts: TierCounts
}

/** Represents a single episode after compression. */
export interface CompressedEpisode {
  episodeRef: EpisodeRef
  text: string
  originalTokens: number
  compressedTokens: number
  compressedBy: CompressionTier
  droppedTurnIndices: number[]
  score: number
}

/** A reference to an original episode, for re-ordering or lookup. */
export interface EpisodeRef {
  sessionId: string
  turnRange?: [number, number]
  atomId?: string
}

/** The tiers of compression applied. */
export type CompressionTier = 'keep' | 'trim' | 'resummarise' | 'truncated'

/** Counts of episodes by compression tier. */
export interface TierCounts {
  keep: number
  trim: number
  resummarise: number
  truncated: number
  dropped: number
}

/** Function signature for a tokeniser. */
export type Tokeniser = (s: string) => number

// --- Tunable Parameters (from ADR--COMPRESSOR-THREE-TIER and ADR--COMPRESSOR) ---

/** Target ratio for LLM resummarisation (e.6. 0.6 means 60% of original). */
export const RESUMMARISE_RATIO = 0.6

/** Minimum fraction of turns that must be droppable for trim to be used. */
export const TRIM_DROP_FRACTION = 0.3

/** Score threshold below which a turn is eligible for dropping by `trimEpisode`. */
export const TRIM_THRESHOLD = 0.3

/** Default LLM timeout for resummarisation. */
export const DEFAULT_LLM_TIMEOUT_MS = 15_000
