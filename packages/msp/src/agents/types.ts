export type Tier = 'T1' | 'T2' | 'T3'

export type TaskType =
  | 'summarize'
  | 'classify'
  | 'format'
  | 'codegen'
  | 'review'
  | 'other'

export type Severity = 'critical' | 'regular' | 'low'

export interface DispatchTask {
  type: TaskType
  severity: Severity
  prompt: string
  context_size_tokens?: number
  budget_hint?: Tier
  deadline_ms?: number
}

export interface DispatchResult {
  tier_used: Tier
  output: string
  cost_usd?: number
  duration_ms: number
  escalated_from?: 'T1' | 'T2'
}
