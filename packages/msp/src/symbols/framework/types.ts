import type { Symbol, Edge } from '../types.js'

export interface FrameworkNode extends Omit<Symbol, 'created_at' | 'community_id' | 'id'> {
  /** Optional temporary ID during recognition; will be resolved to full symbol ID. */
  id?: string
}

export interface FrameworkEdge extends Edge {}

export interface FrameworkRecognizer {
  /** Stable identifier (e.g. 'nextjs-app-router', 'prisma', 'mcp-tools'). */
  readonly id: string

  /** Predicate — should this recognizer process this file? */
  matches(absolutePath: string, sourceCode?: string): boolean

  /** Emit framework-typed nodes + edges. */
  recognize(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }>
}
