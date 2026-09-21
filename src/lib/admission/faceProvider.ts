import { randomUUID } from 'crypto'
import {
  mockFaceProvider,
  type FaceProvider,
  type FaceVerificationDecision,
  type FaceVerificationInput,
  type FaceVerificationResult,
} from './providers'

type CompreFaceMatch = { similarity?: unknown }
type CompreFaceResult = { face_matches?: CompreFaceMatch[] }
type CompreFaceResponse = { result?: CompreFaceResult[] }

export class FaceProviderConfigurationError extends Error {}

export class FaceProviderRequestError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly retryable = true,
  ) {
    super(message)
  }
}

function envNumber(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name] ?? fallback)
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback
}

function booleanEnv(name: string, fallback = false) {
  const value = process.env[name]
  if (value == null || value === '') return fallback
  return value.toLowerCase() === 'true'
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function bestSimilarity(payload: CompreFaceResponse) {
  const similarities = (payload.result ?? []).flatMap((result) => result.face_matches ?? [])
    .map((match) => Number(match.similarity))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 1)
  return similarities.length ? Math.max(...similarities) : null
}

export function createCompreFaceProvider(options?: {
  baseUrl?: string
  apiKey?: string
  approveThreshold?: number
  reviewThreshold?: number
  detectionThreshold?: number
  timeoutMs?: number
  autoApprove?: boolean
  autoReject?: boolean
  fetchImpl?: typeof fetch
}): FaceProvider {
  const baseUrl = options?.baseUrl || process.env.COMPREFACE_URL || ''
  const apiKey = options?.apiKey || process.env.COMPREFACE_API_KEY || ''
  if (!baseUrl || !apiKey) throw new FaceProviderConfigurationError('CompreFace não configurado no servidor.')

  const approveThreshold = options?.approveThreshold ?? envNumber('COMPREFACE_APPROVE_THRESHOLD', 0.75, 0, 1)
  const reviewThreshold = options?.reviewThreshold ?? envNumber('COMPREFACE_REVIEW_THRESHOLD', 0.45, 0, 1)
  const detectionThreshold = options?.detectionThreshold ?? envNumber('COMPREFACE_DETECTION_THRESHOLD', 0.8, 0, 1)
  const timeoutMs = options?.timeoutMs ?? envNumber('COMPREFACE_TIMEOUT_MS', 55000, 1000, 120000)
  const autoApprove = options?.autoApprove ?? booleanEnv('COMPREFACE_AUTO_APPROVE', false)
  const autoReject = options?.autoReject ?? booleanEnv('COMPREFACE_AUTO_REJECT', false)
  const fetchImpl = options?.fetchImpl ?? fetch

  if (reviewThreshold > approveThreshold) {
    throw new FaceProviderConfigurationError('O limite de revisão do CompreFace não pode superar o de aprovação.')
  }

  return {
    name: 'compreface',
    async verify(input: FaceVerificationInput): Promise<FaceVerificationResult> {
      if (!['image/jpeg', 'image/png'].includes(input.selfie.mimeType) || !['image/jpeg', 'image/png'].includes(input.reference.mimeType)) {
        return {
          reference: `compreface_local_${randomUUID()}`,
          decision: 'MANUAL_REVIEW',
          reason: 'UNSUPPORTED_IMAGE_TYPE',
          metadata: { provider: 'compreface' },
        }
      }
      const maximumBytes = 5 * 1024 * 1024
      if (input.selfie.buffer.length > maximumBytes || input.reference.buffer.length > maximumBytes) {
        return {
          reference: `compreface_local_${randomUUID()}`,
          decision: 'MANUAL_REVIEW',
          reason: 'IMAGE_TOO_LARGE',
          metadata: { provider: 'compreface', maximumBytes },
        }
      }

      const form = new FormData()
      form.append('source_image', new Blob([new Uint8Array(input.selfie.buffer)], { type: input.selfie.mimeType }), input.selfie.filename)
      form.append('target_image', new Blob([new Uint8Array(input.reference.buffer)], { type: input.reference.mimeType }), input.reference.filename)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), timeoutMs)

      try {
        const url = `${trimTrailingSlash(baseUrl)}/api/v1/verification/verify?limit=1&prediction_count=1&det_prob_threshold=${detectionThreshold}&status=true`
        const response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'x-api-key': apiKey },
          body: form,
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new FaceProviderRequestError(
            'O serviço facial não conseguiu processar as imagens.',
            `COMPREFACE_HTTP_${response.status}`,
            response.status >= 500 || response.status === 429,
          )
        }

        const payload = await response.json() as CompreFaceResponse
        const similarity = bestSimilarity(payload)
        if (similarity == null) {
          return {
            reference: `compreface_${randomUUID()}`,
            decision: 'MANUAL_REVIEW',
            reason: 'FACE_NOT_DETECTED',
            metadata: { provider: 'compreface', detectionThreshold },
          }
        }

        let decision: FaceVerificationDecision = 'MANUAL_REVIEW'
        let reason = similarity < reviewThreshold ? 'LOW_SIMILARITY' : 'PILOT_REVIEW_REQUIRED'
        if (similarity >= approveThreshold && autoApprove) {
          decision = 'APPROVED'
          reason = 'THRESHOLD_APPROVED'
        } else if (similarity < reviewThreshold && autoReject) {
          decision = 'REJECTED'
          reason = 'THRESHOLD_REJECTED'
        } else if (similarity < approveThreshold && similarity >= reviewThreshold) {
          reason = 'INCONCLUSIVE_SIMILARITY'
        }

        return {
          reference: `compreface_${randomUUID()}`,
          decision,
          similarity,
          reason,
          metadata: {
            provider: 'compreface',
            similarity,
            approveThreshold,
            reviewThreshold,
            detectionThreshold,
            autoApprove,
            autoReject,
          },
        }
      } catch (error) {
        if (error instanceof FaceProviderRequestError) throw error
        if (error instanceof Error && error.name === 'AbortError') {
          throw new FaceProviderRequestError('O serviço facial excedeu o tempo de resposta.', 'COMPREFACE_TIMEOUT')
        }
        throw new FaceProviderRequestError('O serviço facial está temporariamente indisponível.', 'COMPREFACE_UNAVAILABLE')
      } finally {
        clearTimeout(timeout)
      }
    },
  }
}

export function getFaceProvider(): FaceProvider {
  const provider = (process.env.FACE_VERIFICATION_PROVIDER || 'mock').toLowerCase()
  if (provider === 'mock') return mockFaceProvider
  if (provider === 'compreface') return createCompreFaceProvider()
  throw new FaceProviderConfigurationError(`Provider facial não suportado: ${provider}`)
}
