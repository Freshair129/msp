import { relative } from 'node:path'
import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'

export class OrmRecognizer implements FrameworkRecognizer {
  readonly id = 'orm-recognizer'

  matches(absolutePath: string): boolean {
    const posixPath = absolutePath.split('\\').join('/')
    return posixPath.endsWith('.prisma') || 
           posixPath.endsWith('.schema.ts') || 
           posixPath.endsWith('.schema.js') ||
           posixPath.includes('/db/schema') // common drizzle pattern
  }

  async recognize(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const relPath = relative(repoRoot, absolutePath).split('\\').join('/')
    if (absolutePath.endsWith('.prisma')) {
      return this.parsePrisma(relPath, sourceCode)
    }
    return this.parseDrizzle(relPath, sourceCode)
  }

  private parsePrisma(relPath: string, sourceCode: string): { nodes: FrameworkNode[], edges: FrameworkEdge[] } {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []

    const modelRegex = /model\s+(\w+)\s+{/g
    let match
    while ((match = modelRegex.exec(sourceCode)) !== null) {
      const modelName = match[1]
      nodes.push({
        name: modelName,
        kind: 'entity',
        file: relPath,
        start_line: 1, // should find line
        end_line: 1,
        exported: true,
        parent_id: null,
        signature: null,
        attrs: { orm: 'prisma' }
      })
    }

    return { nodes, edges }
  }

  private parseDrizzle(relPath: string, sourceCode: string): { nodes: FrameworkNode[], edges: FrameworkEdge[] } {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []

    const tableRegex = /export\s+const\s+(\w+)\s+=\s+(pgTable|mysqlTable|sqliteTable)\(/g
    let match
    while ((match = tableRegex.exec(sourceCode)) !== null) {
      const tableName = match[1]
      nodes.push({
        name: tableName,
        kind: 'entity',
        file: relPath,
        start_line: 1,
        end_line: 1,
        exported: true,
        parent_id: null,
        signature: null,
        attrs: { orm: 'drizzle' }
      })
    }

    return { nodes, edges }
  }
}
