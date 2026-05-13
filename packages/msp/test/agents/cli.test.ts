import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { DispatchResult, DispatchTask } from '../../src/agents/types.js'

// Mock dispatch() so the CLI can be driven in-process without spawning real
// tier adapters. vi.hoisted() lets us reach the mock from the test body.
const mocks = vi.hoisted(() => ({
  dispatchMock: vi.fn(),
}))

vi.mock('../../src/agents/dispatch.js', () => ({
  dispatch: (task: DispatchTask) => mocks.dispatchMock(task),
}))

// Import AFTER vi.mock so the mocked dep is resolved.
import { main } from '../../src/agents/cli.js'

interface Streams {
  stdout: string
  stderr: string
}

function captureIO(argv: string[]): {
  streams: Streams
  restore: () => void
} {
  const streams: Streams = { stdout: '', stderr: '' }
  const origArgv = process.argv
  const origStdoutWrite = process.stdout.write.bind(process.stdout)
  const origStderrWrite = process.stderr.write.bind(process.stderr)

  process.argv = ['node', '/fake/cli.js', ...argv]
  process.stdout.write = ((chunk: string | Uint8Array) => {
    streams.stdout += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stdout.write
  process.stderr.write = ((chunk: string | Uint8Array) => {
    streams.stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8')
    return true
  }) as typeof process.stderr.write

  return {
    streams,
    restore: () => {
      process.argv = origArgv
      process.stdout.write = origStdoutWrite
      process.stderr.write = origStderrWrite
    },
  }
}

function okResult(overrides: Partial<DispatchResult> = {}): DispatchResult {
  return {
    tier_used: 'T1',
    output: 'mock-output',
    duration_ms: 12,
    ...overrides,
  }
}

let captured: { streams: Streams; restore: () => void } | undefined

beforeEach(() => {
  mocks.dispatchMock.mockReset()
})

afterEach(() => {
  captured?.restore()
  captured = undefined
})

describe('msp-dispatch CLI', () => {
  it('--help prints usage and returns 0', async () => {
    captured = captureIO(['--help'])
    const code = await main()
    expect(code).toBe(0)
    expect(captured.streams.stdout).toMatch(/msp-dispatch/)
    expect(captured.streams.stdout).toMatch(/Usage:/)
    expect(mocks.dispatchMock).not.toHaveBeenCalled()
  })

  it('returns 2 when no prompt is given', async () => {
    captured = captureIO([])
    const code = await main()
    expect(code).toBe(2)
    expect(captured.streams.stderr).toMatch(/no prompt given/)
    expect(mocks.dispatchMock).not.toHaveBeenCalled()
  })

  it('returns 2 when --tier is an invalid value', async () => {
    captured = captureIO(['--tier=T4', 'hello'])
    const code = await main()
    expect(code).toBe(2)
    expect(captured.streams.stderr).toMatch(/--tier must be one of/)
    expect(mocks.dispatchMock).not.toHaveBeenCalled()
  })

  it('returns 2 when --type is an invalid value', async () => {
    captured = captureIO(['--type=bogus', 'hello'])
    const code = await main()
    expect(code).toBe(2)
    expect(captured.streams.stderr).toMatch(/--type must be one of/)
    expect(mocks.dispatchMock).not.toHaveBeenCalled()
  })

  it('returns 2 when --severity is an invalid value', async () => {
    captured = captureIO(['--severity=urgent', 'hello'])
    const code = await main()
    expect(code).toBe(2)
    expect(captured.streams.stderr).toMatch(/--severity must be one of/)
    expect(mocks.dispatchMock).not.toHaveBeenCalled()
  })

  it('returns 2 when --context-size is not a non-negative integer', async () => {
    captured = captureIO(['--context-size=abc', 'hello'])
    const code = await main()
    expect(code).toBe(2)
    expect(captured.streams.stderr).toMatch(/--context-size/)
    expect(mocks.dispatchMock).not.toHaveBeenCalled()
  })

  it('happy path: calls dispatch() with the expected DispatchTask and prints result.output', async () => {
    mocks.dispatchMock.mockResolvedValueOnce(okResult({ output: 'hello world' }))
    captured = captureIO([
      '--tier=T2',
      '--type=codegen',
      '--severity=critical',
      '--context-size=1024',
      '--deadline-ms=5000',
      'do',
      'a',
      'thing',
    ])
    const code = await main()
    expect(code).toBe(0)
    expect(mocks.dispatchMock).toHaveBeenCalledOnce()
    const [received] = mocks.dispatchMock.mock.calls[0]!
    expect(received).toEqual({
      type: 'codegen',
      severity: 'critical',
      prompt: 'do a thing',
      context_size_tokens: 1024,
      budget_hint: 'T2',
      deadline_ms: 5000,
    })
    expect(captured.streams.stdout).toMatch(/hello world/)
  })

  it('defaults: --type=other, --severity=regular, no budget_hint when omitted', async () => {
    mocks.dispatchMock.mockResolvedValueOnce(okResult())
    captured = captureIO(['just a prompt'])
    const code = await main()
    expect(code).toBe(0)
    const [received] = mocks.dispatchMock.mock.calls[0]!
    expect(received).toEqual({
      type: 'other',
      severity: 'regular',
      prompt: 'just a prompt',
    })
  })

  it('--json emits a valid DispatchResult JSON document', async () => {
    const result = okResult({ tier_used: 'T2', output: 'x', escalated_from: 'T1' })
    mocks.dispatchMock.mockResolvedValueOnce(result)
    captured = captureIO(['--json', 'hello'])
    const code = await main()
    expect(code).toBe(0)
    const parsed = JSON.parse(captured.streams.stdout) as DispatchResult
    expect(parsed.tier_used).toBe('T2')
    expect(parsed.output).toBe('x')
    expect(parsed.escalated_from).toBe('T1')
  })

  it('returns 1 when dispatch() resolves with ok:false', async () => {
    mocks.dispatchMock.mockResolvedValueOnce({
      ...okResult({ output: 'failed' }),
      ok: false,
    } as DispatchResult & { ok: boolean })
    captured = captureIO(['hello'])
    const code = await main()
    expect(code).toBe(1)
    expect(captured.streams.stdout).toMatch(/failed/)
  })

  it('returns 1 when dispatch() throws', async () => {
    mocks.dispatchMock.mockRejectedValueOnce(new Error('budget_hint denied'))
    captured = captureIO(['--tier=T3', 'hello'])
    const code = await main()
    expect(code).toBe(1)
    expect(captured.streams.stderr).toMatch(/dispatch error/)
    expect(captured.streams.stderr).toMatch(/budget_hint denied/)
  })
})
