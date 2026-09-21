import { describe, expect, it, vi } from 'vitest'
import { createCompreFaceProvider } from './faceProvider'

const input = {
  admissionId: 'admission-test',
  selfie: { buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' as const, filename: 'selfie.jpg' },
  reference: { buffer: Buffer.from([0xff, 0xd8, 0xff]), mimeType: 'image/jpeg' as const, filename: 'documento.jpg' },
}

describe('CompreFace provider', () => {
  it('mantém resultado compatível em revisão durante o piloto', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      result: [{ face_matches: [{ similarity: 0.91 }] }],
    }), { status: 200, headers: { 'Content-Type': 'application/json' } })) as unknown as typeof fetch
    const provider = createCompreFaceProvider({ baseUrl: 'http://compreface', apiKey: 'test-key', fetchImpl, autoApprove: false })

    const result = await provider.verify(input)

    expect(result.decision).toBe('MANUAL_REVIEW')
    expect(result.similarity).toBe(0.91)
    expect(result.reason).toBe('PILOT_REVIEW_REQUIRED')
    expect(fetchImpl).toHaveBeenCalledOnce()
    const [, request] = (fetchImpl as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect((request as RequestInit).headers).toEqual({ 'x-api-key': 'test-key' })
  })

  it('aprova automaticamente somente quando habilitado e acima do limite', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      result: [{ face_matches: [{ similarity: 0.82 }] }],
    }), { status: 200 })) as unknown as typeof fetch
    const provider = createCompreFaceProvider({
      baseUrl: 'http://compreface/', apiKey: 'test-key', fetchImpl,
      approveThreshold: 0.8, reviewThreshold: 0.5, autoApprove: true,
    })

    await expect(provider.verify(input)).resolves.toMatchObject({ decision: 'APPROVED', similarity: 0.82 })
  })

  it('solicita uma nova captura quando a reprovação automática está habilitada e abaixo do limite', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      result: [{ face_matches: [{ similarity: 0.31 }] }],
    }), { status: 200 })) as unknown as typeof fetch
    const provider = createCompreFaceProvider({
      baseUrl: 'http://compreface', apiKey: 'test-key', fetchImpl,
      approveThreshold: 0.8, reviewThreshold: 0.5, autoReject: true,
    })

    await expect(provider.verify(input)).resolves.toMatchObject({
      decision: 'REJECTED', similarity: 0.31, reason: 'THRESHOLD_REJECTED',
    })
  })

  it('mantém pontuação baixa em revisão manual quando a reprovação automática está desligada', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      result: [{ face_matches: [{ similarity: 0.31 }] }],
    }), { status: 200 })) as unknown as typeof fetch
    const provider = createCompreFaceProvider({
      baseUrl: 'http://compreface', apiKey: 'test-key', fetchImpl,
      approveThreshold: 0.8, reviewThreshold: 0.5, autoReject: false,
    })

    await expect(provider.verify(input)).resolves.toMatchObject({
      decision: 'MANUAL_REVIEW', similarity: 0.31, reason: 'LOW_SIMILARITY',
    })
  })

  it('encaminha ausência de rosto para revisão manual', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ result: [] }), { status: 200 })) as unknown as typeof fetch
    const provider = createCompreFaceProvider({ baseUrl: 'http://compreface', apiKey: 'test-key', fetchImpl })

    await expect(provider.verify(input)).resolves.toMatchObject({ decision: 'MANUAL_REVIEW', reason: 'FACE_NOT_DETECTED' })
  })

  it('traduz falha HTTP sem expor a resposta do serviço', async () => {
    const fetchImpl = vi.fn(async () => new Response('internal details', { status: 503 })) as unknown as typeof fetch
    const provider = createCompreFaceProvider({ baseUrl: 'http://compreface', apiKey: 'test-key', fetchImpl })

    await expect(provider.verify(input)).rejects.toMatchObject({ code: 'COMPREFACE_HTTP_503', retryable: true })
  })
})
