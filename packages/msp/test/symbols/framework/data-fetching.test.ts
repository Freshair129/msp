import { describe, expect, it } from 'vitest'
import { DataFetchingRecognizer } from '../../../src/symbols/framework/data-fetching.js'

describe('DataFetchingRecognizer', () => {
  const recognizer = new DataFetchingRecognizer()
  const root = 'C:/repo'

  it('detects generateStaticParams', async () => {
    const source = 'export function generateStaticParams() { return [] }'
    const result = await recognizer.recognize('C:/repo/app/blog/[slug]/page.tsx', root, source)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].kind).toBe('data_loader')
    expect(result.nodes[0].name).toBe('generateStaticParams')
  })

  it('detects generateMetadata', async () => {
    const source = 'export const generateMetadata = () => ({ title: "Hello" })'
    const result = await recognizer.recognize('C:/repo/app/page.tsx', root, source)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].kind).toBe('metadata_loader')
  })

  it('detects legacy loaders (getServerSideProps)', async () => {
    const source = 'export async function getServerSideProps() { return { props: {} } }'
    const result = await recognizer.recognize('C:/repo/pages/index.tsx', root, source)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].attrs?.type).toBe('getServerSideProps')
  })
})
