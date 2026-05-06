#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

import { createMspMcpServer } from './server.js'

async function main(): Promise<void> {
  const server = createMspMcpServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  process.stderr.write(`✗ msp-mcp-server: ${(err as Error).message}\n`)
  process.exit(1)
})
