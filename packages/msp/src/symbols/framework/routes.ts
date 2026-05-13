import { relative } from 'node:path'
import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'

export class RoutesRecognizer implements FrameworkRecognizer {
  readonly id = 'generic-routes'

  matches(absolutePath: string): boolean {
    const posixPath = absolutePath.split('\\').join('/')
    return (
      posixPath.includes('/api/') || 
      posixPath.endsWith('/route.ts') || 
      posixPath.endsWith('/route.js') ||
      posixPath.endsWith('.py') // for FastAPI
    )
  }

  async recognize(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []
    const relPath = relative(repoRoot, absolutePath).split('\\').join('/')

    if (absolutePath.endsWith('.py')) {
      return this.parseFastApi(relPath, sourceCode)
    }

    // Next.js API routes (Pages Router)
    if (relPath.includes('pages/api/')) {
      const url = '/api/' + relPath.split('pages/api/')[1].split('.')[0]
      nodes.push({
        name: `route:${url}`,
        kind: 'route',
        file: relPath,
        start_line: 1,
        end_line: 1,
        exported: true,
        parent_id: null,
        signature: null,
        attrs: { framework: 'nextjs', router: 'pages', url }
      })
    }

    return { nodes, edges }
  }

  private parseFastApi(relPath: string, sourceCode: string): { nodes: FrameworkNode[], edges: FrameworkEdge[] } {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []

    // Regex for FastAPI decorators: @app.get("/path")
    const routeRegex = /@\w+\.(get|post|put|delete|patch|options|head)\s*\(\s*['"]([^'"]+)['"]/g
    let match
    while ((match = routeRegex.exec(sourceCode)) !== null) {
      const verb = match[1].toUpperCase()
      const path = match[2]
      nodes.push({
        name: `route:${verb}:${path}`,
        kind: 'route',
        file: relPath,
        start_line: 1, // should find line
        end_line: 1,
        exported: true,
        parent_id: null,
        signature: null,
        attrs: { framework: 'fastapi', url: path, method: verb }
      })
    }

    return { nodes, edges }
  }
}
