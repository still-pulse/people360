import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authorizeBadge } from '@/lib/badges/permissions'
import { readDossieFile } from '@/lib/dossie/storage'
import { BADGE_TYPE } from '@/lib/badges/types'
import { log, extractIp } from '@/lib/audit'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  const badge = await prisma.colaboradorDocumento.findFirst({ where: { id, tipo: BADGE_TYPE } })
  if (!badge) return NextResponse.json({ error: 'Crachá não encontrado.' }, { status: 404 })
  const access = await authorizeBadge('badges.download', badge.colaboradorId)
  if (!access.ok) return access.response
  if (!badge.arquivoPath) return NextResponse.json({ error: 'Arquivo do crachá indisponível.' }, { status: 404 })
  const file = await readDossieFile(badge.arquivoPath)
  if (!file) return NextResponse.json({ error: 'Arquivo do crachá indisponível.' }, { status: 404 })
  const inline = req.nextUrl.searchParams.get('inline') === '1'
  void log({ userId: access.actor.id, userName: access.actor.name, userRole: access.actor.role, action: 'VIEW_FILE', entity: 'Cracha', entityId: badge.id, entityName: badge.titulo, details: { modo: inline ? 'visualizar' : 'baixar', versao: badge.versao }, ip: extractIp(req.headers) })
  const fileName = (badge.arquivoNome || 'Cracha.pdf').replace(/[^A-Za-z0-9._-]/g, '_')
  return new NextResponse(new Uint8Array(file), { headers: {
    'Content-Type': 'application/pdf', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fileName}"`,
    'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  } })
}
