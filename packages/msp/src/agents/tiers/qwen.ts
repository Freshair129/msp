import type { RunOpts, RunResult, TierAdapter } from './types.js'

export const qwenAdapter: TierAdapter = {
  name: 'T1',
  async healthcheck(): Promise<boolean> {
    return false
  },
  async run(_prompt: string, _opts: RunOpts): Promise<RunResult> {
    return {
      ok: false,
      output: 'qwen adapter not implemented (P3)',
      exit_code: -1,
    }
  },
}
