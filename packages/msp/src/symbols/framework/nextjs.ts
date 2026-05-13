import { relative } from 'node:path'
import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'

export class NextJsRecognizer implements FrameworkRecognizer {
  readonly id = 'nextjs-app-router'

  matches(absolutePath: string): boolean {
    const posixPath = absolutePath.split('\\').join('/')
    return posixPath.includes('/app/') && (
      posixPath.endsWith('/page.tsx') ||
      posixPath.endsWith('/page.ts') ||
      posixPath.endsWith('/layout.tsx') ||
      posixPath.endsWith('/layout.ts') ||
      posixPath.endsWith('/loading.tsx') ||
      posixPath.endsWith('/loading.ts') ||
      posixPath.endsWith('/error.tsx') ||
      posixPath.endsWith('/error.ts') ||
      posixPath.endsWith('/template.tsx') ||
      posixPath.endsWith('/template.ts') ||
      posixPath.endsWith('/not-found.tsx') ||
      posixPath.endsWith('/not-found.ts') ||
      posixPath.endsWith('/route.ts') ||
      posixPath.endsWith('/route.js')
    )
  }

  async recognize(absolutePath: string, repoRoot: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const posixPath = absolutePath.split('\\').join('/')
    const relPath = relative(repoRoot, absolutePath).split('\\').join('/')
    
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []

    const filename = relPath.split('/').pop()!
    const kindMap: Record<string, any> = {
      'page.tsx': 'page',
      'page.ts': 'page',
      'layout.tsx': 'layout',
      'layout.ts': 'layout',
      'loading.tsx': 'loading',
      'loading.ts': 'loading',
      'error.tsx': 'error_boundary',
      'error.ts': 'error_boundary',
      'template.tsx': 'template',
      'template.ts': 'template',
      'not-found.tsx': 'not_found',
      'not-found.ts': 'not_found',
      'route.ts': 'route',
      'route.js': 'route',
    }

    const kind = kindMap[filename]
    if (!kind) return { nodes, edges }

    const url = this.deriveUrl(relPath)
    const nodeName = `${kind}:${url}`
    
    const node: FrameworkNode = {
      name: nodeName,
      kind: kind,
      file: relPath,
      start_line: 1,
      end_line: 1, // Will be refined or just marked as file-level
      exported: true,
      parent_id: null,
      signature: null,
      attrs: {
        framework: 'nextjs',
        url: url,
      }
    }
    nodes.push(node)

    if (kind === 'page') {
      edges.push({
        src_id: '', // Will be filled by registry/orchestrator with full ID
        dst_id: `url:${url}`,
        type: 'renders_at',
        weight: 1.0,
        resolved: true,
        attrs: { url }
      })
    }

    return { nodes, edges }
  }

  private deriveUrl(relPath: string): string {
    const parts = relPath.split('/')
    const appIdx = parts.indexOf('app')
    if (appIdx === -1) return '/'

    const routeParts = parts.slice(appIdx + 1, -1) // strip 'app' and filename
    const url = routeParts
      .filter(p => !p.startsWith('(') && !p.endsWith(')')) // strip (groups)
      .map(p => {
        if (p.startsWith('[...') && p.endsWith(']')) {
          return `:${p.slice(4, -1)}*`
        }
        if (p.startsWith('[') && p.endsWith(']')) {
          return `:${p.slice(1, -1)}`
        }
        return p
      })
      .join('/')

    return '/' + url
  }
}
