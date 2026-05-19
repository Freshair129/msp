/**
 * Local Cross-Encoder Reranker using @huggingface/transformers.
 *
 * Design decisions (ADR--CROSS-ENCODER-RERANKER):
 *   - Local-first: runs entirely in-process via ONNX Runtime (Transformers.js)
 *   - Lazy loading: model is downloaded/loaded on first rerank() call
 *   - Configurability: model name and dtype (precision) can be overridden
 *   - Error handling: catches model failures and logs via structured logger
 */

import { createLogger } from '../../lib/logger.js'
import { redactSecrets, truncate } from '../../lib/text.js'

const log = createLogger('vector:reranker:bge')

/**
 * Item to be reranked.
 * Matches BLUEPRINT--CROSS-ENCODER-RERANKER.
 */
export interface RerankItem {
  text: string
  id: string
}

/**
 * Generic Reranker interface.
 * Matches BLUEPRINT--CROSS-ENCODER-RERANKER.
 */
export interface Reranker {
  /**
   * Rerank a list of items against a query.
   * Returns items with their new scores, sorted by score descending.
   */
  rerank(query: string, items: RerankItem[]): Promise<Array<{ id: string; score: number }>>
  /** Model identifier (e.g. 'BAAI/bge-reranker-v2-m3'). */
  model: string
}

export interface BgeRerankerOptions {
  /**
   * Model name from HuggingFace.
   * Default: 'BAAI/bge-reranker-v2-m3'
   */
  model?: string
  /**
   * Quantization / data type. Default 'fp32'.
   * 'q8', 'fp16', 'fp32' are common options in transformers.js.
   */
  dtype?: 'fp32' | 'fp16' | 'q8'
}

/**
 * BGE Reranker implementation using @huggingface/transformers.
 */
export class BgeReranker implements Reranker {
  readonly model: string
  private readonly dtype: string
  private _pipeline: any = null
  private _loading: Promise<any> | null = null

  constructor(options: BgeRerankerOptions = {}) {
    this.model = options.model ?? 'BAAI/bge-reranker-v2-m3'
    this.dtype = options.dtype ?? 'fp32'
  }

  private async getPipeline() {
    if (this._pipeline) return this._pipeline
    if (this._loading) return this._loading

    this._loading = (async () => {
      log.info('bge: loading model (first call — may download)', {
        model: this.model,
        dtype: this.dtype,
      })

      const { pipeline, env } = await import('@huggingface/transformers')

      // Ensure we can load local models if they were already downloaded.
      env.allowLocalModels = true

      let lastPct = -1
      const originalConsoleLog = console.error

      // Intercept stderr to capture download progress from transformers.js
      console.error = (...args: unknown[]) => {
        const msg = args.join(' ')
        const match = msg.match(/(\d+(\.\d+)?)%/)
        if (match) {
          const pct = Math.floor(Number(match[1]) / 10) * 10
          if (pct !== lastPct) {
            lastPct = pct
            process.stderr.write(`[gks:bge-reranker] downloading ${this.model}: ${pct}%\n`)
          }
        } else {
          originalConsoleLog(...args)
        }
      }

      try {
        // Cross-Encoders are typically used via the 'text-classification' task in transformers.js
        const pipe = await pipeline('text-classification', this.model, {
          dtype: this.dtype as any,
        })
        this._pipeline = pipe
        log.info('bge: model ready', { model: this.model })
        return pipe
      } catch (err) {
        const message = (err as Error).message
        log.error('bge: failed to load model', {
          model: this.model,
          error: truncate(redactSecrets(message), 200),
        })
        throw err
      } finally {
        console.error = originalConsoleLog
      }
    })()

    return this._loading
  }

  /**
   * Reranks items using the BGE Cross-Encoder model.
   *
   * @param query The retrieval query.
   * @param items List of candidate items (text + id).
   * @returns List of { id, score } sorted by score DESC.
   */
  async rerank(query: string, items: RerankItem[]): Promise<Array<{ id: string; score: number }>> {
    if (items.length === 0) return []

    const pipe = await this.getPipeline()

    // Cross-encoder expects pairs of [query, document]
    const inputs = items.map((item) => [query, item.text])

    try {
      // transformers.js text-classification returns results for each pair.
      // For rerankers, this is typically an array of { label, score } objects.
      const outputs = await pipe(inputs)

      const results = items.map((item, i) => {
        const output = outputs[i]
        // If it's an array (multi-label), take the first one; otherwise take the score directly.
        const score = Array.isArray(output) ? output[0].score : output.score
        return { id: item.id, score }
      })

      // Sort DESC by score (higher is more relevant)
      return results.sort((a, b) => b.score - a.score)
    } catch (err) {
      const message = (err as Error).message
      log.error('bge: rerank failed', {
        model: this.model,
        error: truncate(redactSecrets(message), 200),
      })
      throw err
    }
  }
}
