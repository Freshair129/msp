import { relative } from 'node:path'
import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'

export class McpToolRecognizer implements FrameworkRecognizer {
  readonly id = 'mcp-tools'

  matches(absolutePath: string): boolean {
    return absolutePath.endsWith('.ts') || absolutePath.endsWith('.js')
  }

  async recognize(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []
    const relPath = relative(repoRoot, absolutePath).split('\\').join('/')

    // Simple regex for registerTool({ name: "..." })
    const toolRegex = /\.registerTool\(\s*{\s*name:\s*['"]([^'"]+)['"]/g
    let match
    while ((match = toolRegex.exec(sourceCode)) !== null) {
      const toolName = match[1]
      nodes.push({
        name: toolName,
        kind: 'tool',
        file: relPath,
        start_line: 1,
        end_line: 1,
        exported: false,
        parent_id: null,
        signature: null,
        attrs: { mcp: true, name: toolName }
      })
    }

    return { nodes, edges }
  }
}
