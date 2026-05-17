import type { ClassifiableResource, ClassificationResult, Classifier } from './types.js'

/**
 * deep content inspection classifier for Secrets and Security.
 * detects: API keys, tokens, high-entropy strings.
 *
 * Implements FEAT--SECURITY-SECRET-PACK.
 */
export class SecurityClassifier implements Classifier {
  readonly id = 'domain/security'
  readonly description = 'Deep scanner for secrets and credentials'
  readonly outputs = ['has_secret', 'secret_type', 'encryption_level', 'leak_risk']

  private secretPatterns = [
    { type: 'openai', regex: /\bsk-[a-zA-Z0-9]{32,}\b/ },
    { type: 'anthropic', regex: /\bsk-ant-03-[a-zA-Z0-9-]{60,}\b/ },
    { type: 'aws_key', regex: /\bAKIA[0-9A-Z]{16}\b/ },
    { type: 'aws_secret', regex: /\b[a-zA-Z0-9+/]{40}\b/ }, // Caution: high false positives, entropy needed
    { type: 'github_token', regex: /\b(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36,}\b/ },
    { type: 'stripe', regex: /\b(?:sk|pk)_(?:test|live)_[0-9a-zA-Z]{24,}\b/ },
    { type: 'generic_secret', regex: /\b(?:password|passwd|secret|api_key|private_key)\s*[:=]\s*["'][^"']{8,}["']/i },
  ]

  async classify(resource: ClassifiableResource): Promise<ClassificationResult> {
    const attributes: Record<string, any> = {}
    const provenance: Record<string, any> = {}
    const timestamp = new Date().toISOString()

    let foundSecret = false
    let detectedType: string | null = null

    // 1. Pattern Matching
    for (const p of this.secretPatterns) {
      if (p.regex.test(resource.body)) {
        foundSecret = true
        detectedType = p.type
        break
      }
    }

    // 2. High-Entropy Heuristic (Basic)
    // Look for random-looking strings > 30 chars that aren't base64 blobs or paths
    if (!foundSecret) {
      const longWords = resource.body.match(/\b[A-Za-z0-9+/=_-]{32,}\b/g) || []
      for (const word of longWords) {
        // Very basic entropy check: distinct character count
        const distinct = new Set(word).size
        if (distinct > 15) {
          foundSecret = true
          detectedType = 'high_entropy_string'
          break
        }
      }
    }

    if (foundSecret) {
      attributes.has_secret = true
      attributes.secret_type = detectedType
      attributes.leak_risk = 'high'
      provenance.has_secret = { classifier_id: this.id, timestamp, confidence: 0.9, context: { type: detectedType } }
    } else {
      attributes.has_secret = false
      attributes.leak_risk = 'low'
      provenance.has_secret = { classifier_id: this.id, timestamp, confidence: 0.8 }
    }

    // 3. Encryption Level detection (Keyword based)
    if (resource.body.includes('-----BEGIN PGP MESSAGE-----')) {
      attributes.encryption_level = 'pgp'
      provenance.encryption_level = { classifier_id: this.id, timestamp, confidence: 1.0 }
    } else if (resource.body.includes('vault: v1:')) {
      attributes.encryption_level = 'vault'
      provenance.encryption_level = { classifier_id: this.id, timestamp, confidence: 1.0 }
    } else {
      attributes.encryption_level = 'none'
    }

    return { attributes, provenance }
  }
}
