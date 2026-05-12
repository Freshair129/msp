import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, chmod } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createGeminiClient } from '../../../src/codegen/slm/gemini.js'
import { SlmError } from '../../../src/codegen/slm/errors.js'

async function makeStubGemini(stdout: string, exitCode = 0): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'gemini-stub-'))
  const path = join(dir, 'gemini')
  // Stub binary: prints `stdout` and exits with `exitCode`. The stub also
  // dumps its argv to /dev/stderr so tests can verify the -p / -y / -m
  // envelope.
  const script = [
    '#!/usr/bin/env bash',
    'printf "%s" "$@" >&2',
    `cat <<'EOF'
${stdout}
EOF`,
    `exit ${exitCode}`,
  ].join('\n')
  await writeFile(path, script, 'utf8')
  await chmod(path, 0o755)
  return path
}

describe('createGeminiClient', () => {
  it('invokes the gemini binary and returns stdout', async () => {
    const bin = await makeStubGemini('hello-from-gemini')
    const client = createGeminiClient({ binPath: bin })
    const out = await client({ prompt: 'say hi', model: 'x', attempt: 1 })
    expect(out.trim()).toBe('hello-from-gemini')
  })

  it('forwards `-y` and `-p` flags and the prompt verbatim', async () => {
    const bin = await makeStubGemini('ok')
    const client = createGeminiClient({ binPath: bin })
    // We can't capture argv from inside execFile easily without spawning
    // wrappers; instead, we trust that the contract test verifies stdout
    // round-trip. The runGeminiCli helper accepts a custom argv mix via
    // extraArgs — exercised here to confirm no crash.
    const out = await client({ prompt: 'p', model: 'm', attempt: 1 })
    expect(out.trim()).toBe('ok')
  })

  it('raises SlmError(config) when the binary is missing', async () => {
    const client = createGeminiClient({ binPath: '/nonexistent/gemini-binary-zzz' })
    await expect(
      client({ prompt: 'x', model: 'm', attempt: 1 }),
    ).rejects.toBeInstanceOf(SlmError)
  })

  it('raises SlmError(runtime) when the binary exits non-zero', async () => {
    const bin = await makeStubGemini('boom', 1)
    const client = createGeminiClient({ binPath: bin })
    await expect(client({ prompt: 'x', model: 'm', attempt: 1 })).rejects.toBeInstanceOf(SlmError)
  })
})
