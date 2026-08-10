import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { notifyUsers } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'
import { erpnextConfigured } from '@/lib/erpnextClient'
import { openVagaInRecruitmentList, writeBackApproval } from '@/lib/erpnextJobRequisition'
import { notifyAdmins } from '@/lib/notify'

// GET — retorna thread de comentários da aprovação
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const comentarios = await prisma.vagaAprovacaoComentario.findMany({
    where: { vagaId: params.id },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(comentarios)
}

// POST — ação do admin (APROVAR | REJEITAR | SOLICITAR_INFO) ou resposta da analista (RESPOSTA)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const body = await req.json()
  const { acao, mensagem } = body as { acao: string; mensagem: string }

  const vaga = await prisma.vaga.findUnique({
    where: { id: params.id },
    include: { analistas: { select: { id: true, name: true } }, unit: { select: { name: true } } },
  })
  if (!vaga) return NextResponse.json({ error: 'Vaga não encontrada' }, { status: 404 })

  const isAdmin = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session!.user.role)
  const isAnalista = session!.user.role === 'ANALYST'

  // Ações do admin
  if (acao === 'APROVAR') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Write-back ERPNext ANTES de alterar o People (evita desync)
    let erpnext: { status?: string; workflowState?: string } | null = null
    let resolvedRpName: string | null = null
    if (vaga.requisicaoNextId && erpnextConfigured()) {
      const wb = await writeBackApproval(vaga.requisicaoNextId, 'Approve')
      if (!wb.ok) {
        return NextResponse.json(
          { error: `Falha ao aprovar no ERPNext: ${wb.error}`, erpnext: true },
          { status: wb.status && wb.status >= 400 && wb.status < 600 ? wb.status : 502 },
        )
      }
      erpnext = { status: wb.erpnextStatus, workflowState: wb.workflowState }
      resolvedRpName = wb.resolvedName || null
      // Corrige ID sem prefixo RP- (ex.: 2026-00194 → RP-2026-00194), se não houver outra vaga com o mesmo ID
      if (resolvedRpName && resolvedRpName !== vaga.requisicaoNextId) {
        try {
          const clash = await prisma.vaga.findFirst({
            where: { requisicaoNextId: resolvedRpName, NOT: { id: params.id } },
            select: { id: true },
          })
          if (!clash) {
            await prisma.vaga.update({
              where: { id: params.id },
              data: { requisicaoNextId: resolvedRpName },
            })
          }
        } catch (e) {
          console.error('[aprovacao] não foi possível normalizar requisicaoNextId:', e)
        }
      }
    }

    // Abre na lista/kanban de recrutamento (status ABERTA + position na coluna)
    const rpLabel = resolvedRpName || vaga.requisicaoNextId
    await openVagaInRecruitmentList(params.id, {
      erpnextStatus: erpnext?.status || (rpLabel ? 'Open & Approved' : null),
      historicoUserId: session!.user.id,
      fromStatus: 'PENDENTE_APROVACAO',
      historicoDescricao: rpLabel
        ? `RP ${rpLabel} aprovada — vaga aberta na lista de recrutamento`
        : 'Vaga aprovada e aberta na lista de recrutamento',
    })
    await prisma.vagaAprovacaoComentario.create({
      data: {
        vagaId: params.id,
        userId: session!.user.id,
        tipo: 'APROVACAO',
        mensagem: mensagem || 'Vaga aprovada e liberada na lista de vagas.',
      },
    })
    const analistaIds49 = vaga.analistas.map((a) => a.id)
    if (analistaIds49.length) {
      await notifyUsers(analistaIds49, {
        type: 'VAGA',
        title: `Vaga aberta: ${vaga.cargo}`,
        body: mensagem || 'A RP foi aprovada e a vaga está na lista de recrutamento.',
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    } else {
      await notifyAdmins({
        type: 'VAGA',
        title: `Vaga aberta na lista: ${vaga.cargo}`,
        body: vaga.requisicaoNextId
          ? `${vaga.requisicaoNextId}${vaga.unit ? ` — ${vaga.unit.name}` : ''}`
          : (mensagem || 'Disponível em Vagas → Lista / Kanban'),
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    }
    await log({
      userId: session!.user.id,
      userName: session!.user.name,
      userRole: session!.user.role,
      action: 'UPDATE',
      entity: 'Vaga',
      entityId: params.id,
      entityName: vaga.titulo,
      details: { acao: 'APROVACAO', abertaNaLista: true, requisicaoNextId: vaga.requisicaoNextId, erpnext },
      ip: extractIp(req.headers),
    })
    return NextResponse.json({
      ok: true,
      newStatus: 'ABERTA',
      abertaNaLista: true,
      href: `/vagas/${params.id}`,
      erpnext,
    })
  }

  if (acao === 'REJEITAR') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem obrigatória para rejeição' }, { status: 400 })

    let erpnext: { status?: string; workflowState?: string } | null = null
    let resolvedRpName: string | null = null
    if (vaga.requisicaoNextId && erpnextConfigured()) {
      const wb = await writeBackApproval(vaga.requisicaoNextId, 'Reject', mensagem)
      if (!wb.ok) {
        return NextResponse.json(
          { error: `Falha ao rejeitar no ERPNext: ${wb.error}`, erpnext: true },
          { status: wb.status && wb.status >= 400 && wb.status < 600 ? wb.status : 502 },
        )
      }
      erpnext = { status: wb.erpnextStatus, workflowState: wb.workflowState }
      resolvedRpName = wb.resolvedName || null
    }

    const rpLabel = resolvedRpName || vaga.requisicaoNextId
    await prisma.vaga.update({
      where: { id: params.id },
      data: {
        status: 'REJEITADA' as any,
        ...(resolvedRpName && resolvedRpName !== vaga.requisicaoNextId
          ? { requisicaoNextId: resolvedRpName }
          : {}),
        ...(erpnext
          ? { erpnextStatus: erpnext.status || 'Rejected', erpnextSyncedAt: new Date() }
          : {}),
      },
    })
    await prisma.vagaHistorico.create({
      data: {
        vagaId: params.id,
        userId: session!.user.id,
        fromStatus: 'PENDENTE_APROVACAO' as any,
        toStatus: 'REJEITADA' as any,
        descricao: rpLabel
          ? `Vaga rejeitada (ERPNext ${rpLabel})`
          : 'Vaga rejeitada',
      },
    })
    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'REJEICAO', mensagem },
    })
    const analistaIds72 = vaga.analistas.map((a) => a.id)
    if (analistaIds72.length) {
      await notifyUsers(analistaIds72, {
        type: 'VAGA',
        title: `Vaga rejeitada: ${vaga.cargo}`,
        body: mensagem,
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    }
    await log({
      userId: session!.user.id,
      userName: session!.user.name,
      userRole: session!.user.role,
      action: 'UPDATE',
      entity: 'Vaga',
      entityId: params.id,
      entityName: vaga.titulo,
      details: { acao: 'REJEICAO', motivo: mensagem, requisicaoNextId: vaga.requisicaoNextId, erpnext },
      ip: extractIp(req.headers),
    })
    return NextResponse.json({ ok: true, newStatus: 'REJEITADA', erpnext })
  }

  if (acao === 'SOLICITAR_INFO') {
    if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'SOLICITACAO_INFO', mensagem },
    })
    const analistaIds91 = vaga.analistas.map((a) => a.id)
    if (analistaIds91.length) {
      await notifyUsers(analistaIds91, {
        type: 'VAGA',
        title: `Informações solicitadas: ${vaga.cargo}`,
        body: mensagem,
        href: `/vagas/${params.id}`,
      }, session!.user.id)
    }
    return NextResponse.json({ ok: true })
  }

  if (acao === 'RESPOSTA') {
    if (!isAnalista && !isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (!mensagem?.trim()) return NextResponse.json({ error: 'Mensagem obrigatória' }, { status: 400 })

    await prisma.vagaAprovacaoComentario.create({
      data: { vagaId: params.id, userId: session!.user.id, tipo: 'RESPOSTA', mensagem },
    })
    // Notifica admins sobre a resposta
    const admins = await prisma.user.findMany({ where: { role: 'ADMIN' }, select: { id: true } })
    const adminIds = admins.map((a) => a.id).filter((id) => id !== session!.user.id)
    if (adminIds.length) {
      await notifyUsers(adminIds, {
        type: 'VAGA',
        title: `Resposta recebida: ${vaga.cargo}`,
        body: `${session!.user.name}: ${mensagem}`,
        href: `/vagas/pendentes`,
      }, session!.user.id)
    }
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 })
}
