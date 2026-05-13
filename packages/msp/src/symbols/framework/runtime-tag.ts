import { relative } from 'node:path'
import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'

export class RuntimeTagRecognizer implements FrameworkRecognizer {
  readonly id = 'runtime-tag'

  matches(absolutePath: string): boolean {
    return absolutePath.endsWith('.ts') || absolutePath.endsWith('.tsx') || absolutePath.endsWith('.js') || absolutePath.endsWith('.jsx')
  }

  async recognize(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []

    const runtime = this.detectRuntime(sourceCode, absolutePath)
    if (runtime) {
      const relPath = relative(repoRoot, absolutePath).split('\\').join('/')
      nodes.push({
        name: 'file-runtime',
        kind: 'module',
        file: relPath,
        start_line: 1,
        end_line: 1,
        exported: false,
        parent_id: null,
        signature: null,
        attrs: { runtime }
      })
    }

    return { nodes, edges }
  }

  private detectRuntime(sourceCode: string, absolutePath: string): 'client' | 'server' | null {
    const firstLine = sourceCode.trim().split('\n')[0]?.trim()
    if (!firstLine) return null

    if (firstLine.startsWith("'use client'") || firstLine.startsWith('"use client"')) return 'client'
    if (firstLine.startsWith("'use server'") || firstLine.startsWith('"use server"')) return 'server'

    // Next.js App Router default
    if (absolutePath.split('\\').join('/').includes('/app/')) return 'server'
    
    return null
  }
}
