import { relative } from 'node:path'
import type { FrameworkRecognizer, FrameworkNode, FrameworkEdge } from './types.js'

export class DataFetchingRecognizer implements FrameworkRecognizer {
  readonly id = 'data-fetching'

  matches(absolutePath: string): boolean {
    return (
      absolutePath.endsWith('.tsx') || 
      absolutePath.endsWith('.ts') || 
      absolutePath.endsWith('.js') || 
      absolutePath.endsWith('.jsx')
    )
  }

  async recognize(absolutePath: string, repoRoot: string, sourceCode: string): Promise<{
    nodes: FrameworkNode[]
    edges: FrameworkEdge[]
  }> {
    const nodes: FrameworkNode[] = []
    const edges: FrameworkEdge[] = []
    const relPath = relative(repoRoot, absolutePath).split('\\').join('/')

    // App Router exports
    if (sourceCode.includes('export function generateStaticParams') || sourceCode.includes('export const generateStaticParams')) {
      nodes.push({
        name: 'generateStaticParams',
        kind: 'data_loader',
        file: relPath,
        start_line: 1,
        end_line: 1,
        exported: true,
        parent_id: null,
        signature: null,
        attrs: { framework: 'nextjs', type: 'generateStaticParams' }
      })
    }

    if (sourceCode.includes('export function generateMetadata') || sourceCode.includes('export const generateMetadata')) {
      nodes.push({
        name: 'generateMetadata',
        kind: 'metadata_loader',
        file: relPath,
        start_line: 1,
        end_line: 1,
        exported: true,
        parent_id: null,
        signature: null,
        attrs: { framework: 'nextjs', type: 'generateMetadata' }
      })
    }

    // Pages Router exports
    const legacyLoaders = ['getServerSideProps', 'getStaticProps', 'getStaticPaths']
    for (const loader of legacyLoaders) {
      if (sourceCode.includes(`export function ${loader}`) || 
          sourceCode.includes(`export async function ${loader}`) ||
          sourceCode.includes(`export const ${loader}`)) {
        nodes.push({
          name: loader,
          kind: 'data_loader',
          file: relPath,
          start_line: 1,
          end_line: 1,
          exported: true,
          parent_id: null,
          signature: null,
          attrs: { framework: 'nextjs', type: loader }
        })
      }
    }

    return { nodes, edges }
  }
}
