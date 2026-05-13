import type { RunOpts, RunResult, TierAdapter } from './types.js'

export const claudeAdapter: TierAdapter = {
  name: 'T3',
  async healthcheck(): Promise<boolean> {
    return false
  },
  async run(_prompt: string, _opts: RunOpts): Promise<RunResult> {
    return {
      ok: false,
      output: 'claude adapter not implemented (P3)',
      exit_code: -1,
    }
  },
}
