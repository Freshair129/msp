/**
 * Identity layer types — the "soul" half of the MSP passport.
 *
 * Per CONCEPT--IDENTITY-LAYER, identity has three sub-fields:
 *   - profile:     stable identifying facts (name, role, tier, originStory)
 *   - voice:       how the agent communicates (tone, formality, language, cadence)
 *   - preferences: per-key user/runtime overrides with optional TTL
 *
 * Per ADR--IDENTITY-STORAGE-SHAPE, the on-disk shape is a single JSON file
 * at `.brain/msp/projects/<namespace>/identity.json` with `schemaVersion: 1`.
 *
 * All types are plain data; constructors below produce defaults so callers
 * never have to null-check after `getIdentity`.
 */

/** Three tiers of agent maturity / role weight. T3 is the default. */
export type Tier = 'T1' | 'T2' | 'T3'

/** Formality is enum-bounded (small fixed vocabulary). */
export type Formality = 'casual' | 'neutral' | 'formal'

/** Cadence describes overall reply length / pacing. */
export type ResponseCadence = 'terse' | 'normal' | 'verbose'

/**
 * Stable identifying facts. `createdAt` is set on first write and preserved
 * thereafter. `name`, `role`, `tier`, `originStory` are conventionally
 * append-mostly but the API does not enforce immutability — see CONCEPT.
 */
export interface Profile {
  name: string
  role: string
  tier: Tier
  originStory: string
  /** ISO 8601 timestamp. Empty string = not yet initialised. */
  createdAt: string
}

/**
 * Voice / style descriptors. `tone` is an ordered list (earlier dominates).
 * `languagePreference` is intentionally free-form (e.g. `"en"`, `"thai+english"`,
 * `"auto"`) — no enum validation per ADR / BLUEPRINT.
 */
export interface Voice {
  tone: string[]
  formality: Formality
  /** Free-form language tag — implementation does NOT validate against enum. */
  languagePreference: string
  responseCadence: ResponseCadence
}

/**
 * A single preference entry. `value` is JSON-serialisable (any shape).
 * `expiresAt` is ISO 8601 or null (never expires).
 */
export interface Preference {
  value: unknown
  expiresAt: string | null
}

/**
 * Top-level identity record. `schemaVersion` is currently locked to 1; the
 * loader refuses to read files with a higher version (per ADR forward-compat
 * safety).
 */
export interface Identity {
  schemaVersion: 1
  profile: Profile
  voice: Voice
  preferences: Record<string, Preference>
}

/**
 * Options passed to every public function. `root` defaults to `process.cwd()`,
 * `namespace` defaults to `'evaAI'` (matching sessions / consolidator default).
 */
export interface IdentityOptions {
  root?: string
  namespace?: string
}

/** Default namespace — matches the sessions / consolidator convention. */
export const DEFAULT_NAMESPACE = 'evaAI'

/** Current on-disk schema version. */
export const CURRENT_SCHEMA_VERSION = 1 as const

/**
 * Default profile — empty strings + T3 + empty `createdAt`.
 *
 * `createdAt` is intentionally empty so callers (specifically `setProfile`)
 * can detect first-write and stamp the actual creation time then. Once set
 * via `setProfile`, `createdAt` is preserved on every subsequent write.
 */
export function defaultProfile(): Profile {
  return {
    name: '',
    role: '',
    tier: 'T3',
    originStory: '',
    createdAt: '',
  }
}

/** Default voice — neutral, auto-language, normal cadence, no tone descriptors. */
export function defaultVoice(): Voice {
  return {
    tone: [],
    formality: 'neutral',
    languagePreference: 'auto',
    responseCadence: 'normal',
  }
}

/** Default-constructed identity. Used when the on-disk file is missing. */
export function defaultIdentity(): Identity {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    profile: defaultProfile(),
    voice: defaultVoice(),
    preferences: {},
  }
}
