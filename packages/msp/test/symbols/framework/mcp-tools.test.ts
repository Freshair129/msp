import { describe, expect, it } from 'vitest'
import { McpToolRecognizer } from '../../../src/symbols/framework/mcp-tools.js'

describe('McpToolRecognizer', () => {
  const recognizer = new McpToolRecognizer()
  const root = 'C:/repo'

  it('detects registerTool calls', async () => {
    const source = `
      server.registerTool({
        name: "get_weather",
        description: "Get weather",
        handler: async (args) => ({})
      });
    `
    const result = await recognizer.recognize('C:/repo/tools.ts', root, source)
    expect(result.nodes).toHaveLength(1)
    expect(result.nodes[0].kind).toBe('tool')
    expect(result.nodes[0].name).toBe('get_weather')
    expect(result.nodes[0].attrs?.mcp).toBe(true)
  })
})
