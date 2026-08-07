import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { log } from '@/lib/audit'

// RH aprova/rejeita um documento enviado pelo candidato
export async function PATCH(req: NextRequest, { params }: { params: { itemId: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro
  if (session!.user.role === 'JURIDICO') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const item = await prisma.documentoLinkItem.findUnique({
    where: { id: params.itemId },
    include: { link: { include: { candidato: true, vaga: true } }, tipo: true },
  })
  if (!item) return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })

  if (session!.user.role === 'ANALYST') {
    const units: string[] = session!.user.unitIds?.length ? session!.user.unitIds : (session!.user.unitId ? [session!.user.unitId] : [])
    if (!units.includes(item.link.vaga.unidadeId ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const body = await req.json().catch(() => ({}))
  const acao = body.acao as 'APROVAR' | 'REJEITAR'

  if (acao !== 'APROVAR' && acao !== 'REJEITAR') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
  }
  if (acao === 'REJEITAR' && !body.motivo?.trim()) {
    return NextResponse.json({ error: 'Motivo da rejeição é obrigatório' }, { status: 400 })
  }
  if (item.status !== 'ENVIADO') {
    return NextResponse.json({ error: 'Só é possível revisar itens enviados pelo candidato' }, { status: 400 })
  }

  const updated = await prisma.documentoLinkItem.update({
    where: { id: item.id },
    data: {
      status: acao === 'APROVAR' ? 'APROVADO' : 'REJEITADO',
      motivoRejeicao: acao === 'REJEITAR' ? body.motivo.trim() : null,
      revisadoPorId: session!.user.id,
      revisadoAt: new Date(),
    },
  })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: acao === 'APROVAR' ? 'APPROVE' : 'REJECT',
    entity: 'CandidatoDocumento', entityId: item.link.candidatoId, entityName: item.link.candidato.nome,
    details: { linkId: item.linkId, itemId: item.id, tipo: item.tipo.nome, motivo: acao === 'REJEITAR' ? body.motivo.trim() : undefined },
  })

  // Se todos os itens do link estiverem aprovados, marca o link como concluído
  const pendentes = await prisma.documentoLinkItem.count({
    where: { linkId: item.linkId, status: { not: 'APROVADO' } },
  })
  if (pendentes === 0) {
    await prisma.documentoLink.update({
      where: { id: item.linkId },
      data: { status: 'CONCLUIDO', concluidoAt: new Date() },
    })
  }

  return NextResponse.json(updated)
}
