import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'
import { NextJsRecognizer } from './nextjs.js'
import { RuntimeTagRecognizer } from './runtime-tag.js'
import { OrmRecognizer } from './orm.js'
import { McpToolRecognizer } from './mcp-tools.js'
import { RoutesRecognizer } from './routes.js'
import { DataFetchingRecognizer } from './data-fetching.js'

export class FrameworkRegistry {
  private recognizers: FrameworkRecognizer[] = []

  register(recognizer: FrameworkRecognizer) {
    this.recognizers.push(recognizer)
  }

  getRecognizers(): FrameworkRecognizer[] {
    return this.recognizers
  }

  async processFile(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const allNodes: FrameworkNode[] = []
    const allEdges: FrameworkEdge[] = []

    for (const recognizer of this.recognizers) {
      if (recognizer.matches(absolutePath, sourceCode)) {
        const { nodes, edges } = await recognizer.recognize(absolutePath, repoRoot, sourceCode)
        allNodes.push(...nodes)
        allEdges.push(...edges)
      }
    }

    return { nodes: allNodes, edges: allEdges }
  }
}

export const frameworkRegistry = new FrameworkRegistry()

// Register default recognizers
frameworkRegistry.register(new NextJsRecognizer())
frameworkRegistry.register(new RuntimeTagRecognizer())
frameworkRegistry.register(new OrmRecognizer())
frameworkRegistry.register(new McpToolRecognizer())
frameworkRegistry.register(new RoutesRecognizer())
frameworkRegistry.register(new DataFetchingRecognizer())
