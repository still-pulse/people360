import { NextRequest, NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { extractIp } from '@/lib/audit'
import { authorizeDossie, type DossieAccess, type DossiePermission } from './permissions'
import { DossieError } from './documentos'

type Granted = Extract<DossieAccess, { ok: true }> & { ip: string | null; req: NextRequest }

export function handleError(error: unknown) {
  if (error instanceof DossieError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status })
  if (error instanceof ZodError) {
    const details = error.issues.map((issue) => issue.message)
    return NextResponse.json({ error: details[0] || 'Dados inválidos.', details }, { status: 422 })
  }
  console.error('[dossie]', error)
  return NextResponse.json({ error: 'Não foi possível concluir a operação. Tente novamente.' }, { status: 500 })
}

/** Autoriza (papel + escopo de unidade) e executa o handler com tratamento uniforme de erros. */
export async function dossieRoute(req: NextRequest, permission: DossiePermission, id: string, handler: (ctx: Granted) => Promise<Response>) {
  const access = await authorizeDossie(permission, id)
  if (!access.ok) return access.response
  try {
    return await handler({ ...access, ip: extractIp(req.headers), req })
  } catch (error) {
    return handleError(error)
  }
}

export function pdfResponse(buffer: Buffer, fileName: string, inline: boolean) {
  const safeName = fileName.replace(/[^A-Za-z0-9._-]/g, '_')
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${safeName}"`,
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') throw new DossieError('Requisição inválida.', 400)
  return body as Record<string, unknown>
}

const hits = new Map<string, number[]>()

/** Limitador em memória por chave (protege a geração de PDFs grandes contra repetição acidental). */
export function allowRequest(key: string, max: number, windowMs: number): boolean {
  const now = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs)
  if (recent.length >= max) { hits.set(key, recent); return false }
  recent.push(now)
  hits.set(key, recent)
  return true
}
