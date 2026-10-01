import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { authorizeBadge } from '@/lib/badges/permissions'
import { employeeBadgeSnapshot, validateBadgeSnapshot } from '@/lib/badges/data'
import { generateBadge, BadgeError } from '@/lib/badges/service'
import { BADGE_TYPE, type BadgeIssueType, type BadgeOverrides, type BadgeSnapshot } from '@/lib/badges/types'
import { prisma } from '@/lib/prisma'
import { extractIp } from '@/lib/audit'

function readOverrides(value: unknown): BadgeOverrides {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const source = value as Record<string, unknown>
  const result: Record<string, string | number> = {}
  const strings = ['firstName', 'lastName', 'fullName', 'role', 'department', 'admissionDate', 'document', 'employeeId'] as const
  for (const key of strings) if (typeof source[key] === 'string') result[key] = String(source[key]).trim().slice(0, 160)
  if (source.photoFocusY !== undefined) result.photoFocusY = Math.min(100, Math.max(0, Number(source.photoFocusY) || 0))
  return result as BadgeOverrides
}
export async function GET(_: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await authorizeBadge('badges.view', id)
  if (!access.ok) return access.response
  const [snapshot, documents] = await Promise.all([
    employeeBadgeSnapshot(access.employee),
    prisma.colaboradorDocumento.findMany({
      where: { colaboradorId: access.employee.id, tipo: BADGE_TYPE }, orderBy: { versao: 'desc' },
      select: { id: true, versao: true, observacao: true, geradoEm: true, createdAt: true, criadoPorNome: true, arquivoNome: true, arquivoTamanho: true, snapshot: true, dados: true },
    }),
  ])
  return NextResponse.json({
    employee: { id: access.employee.id, name: access.employee.employeeName },
    preview: { ...snapshot, photoUrl: snapshot.photoId ? `/api/colaboradores/${access.employee.id}/crachas/foto` : null },
    missing: validateBadgeSnapshot(snapshot),
    current: documents[0] ?? null,
    history: documents.map((doc) => ({ ...doc, snapshot: doc.snapshot as BadgeSnapshot })),
  })
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const access = await authorizeBadge('badges.generate', id)
  if (!access.ok) return access.response
  try {
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const overrides = readOverrides(body.overrides)
    const issueType: BadgeIssueType = body.issueType === 'SECOND_COPY' ? 'SECOND_COPY' : 'INITIAL'
    const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 240) : null
    const document = await generateBadge({ employee: access.employee, overrides, issueType, reason, actor: access.actor, ip: extractIp(req.headers) })
    return NextResponse.json({
      id: document.id, version: document.versao, fileName: document.arquivoNome,
      downloadUrl: `/api/crachas/${document.id}/arquivo`, generatedAt: document.geradoEm,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof BadgeError) return NextResponse.json({ error: error.message }, { status: error.status })
    if (error instanceof Prisma.PrismaClientKnownRequestError) return NextResponse.json({ error: 'Não foi possível registrar a emissão do crachá.' }, { status: 409 })
    console.error('[crachas] generation failed', error)
    return NextResponse.json({ error: 'Não foi possível gerar o PDF do crachá.' }, { status: 500 })
  }
}
