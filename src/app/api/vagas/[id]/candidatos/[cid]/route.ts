import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, forbidIfReadOnly } from '@/lib/apiHelpers'
import { unlink } from 'fs/promises'
import path from 'path'
import { CANDIDATO_STATUS_APROVADO, devePromoverParaAdmissao } from '@/lib/vagaStatus'

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string; cid: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const vaga = await prisma.vaga.findUnique({ where: { id: params.id } })
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const _u: string[] = (session!.user as any).unitIds?.length ? (session!.user as any).unitIds : (session!.user.unitId ? [session!.user.unitId] : []);if (session!.user.role === 'ANALYST' && !_u.includes(vaga.unidadeId ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

  const body = await req.json()
  const candidato = await prisma.candidato.update({
    where: { id: params.cid },
    data: {
      nome: body.nome,
      telefone: body.telefone || null,
      email: body.email || null,
      dataAprovacao: body.dataAprovacao ? new Date(body.dataAprovacao) : null,
      status: body.status,
      observacoes: body.observacoes || null,
      cvFileName: body.cvFileName !== undefined ? (body.cvFileName || null) : undefined,
      cvOriginalName: body.cvOriginalName !== undefined ? (body.cvOriginalName || null) : undefined,
    },
  })

  await prisma.vagaHistorico.create({
    data: { vagaId: params.id, userId: session!.user.id, descricao: `Candidato atualizado: ${candidato.nome} → ${body.status}` },
  })

  if ((CANDIDATO_STATUS_APROVADO as readonly string[]).includes(body.status) && devePromoverParaAdmissao(vaga.status)) {
    await prisma.vaga.update({
      where: { id: params.id },
      data: { status: 'ADMISSAO_EM_ANDAMENTO' },
    })
    await prisma.vagaHistorico.create({
      data: {
        vagaId: params.id,
        userId: session!.user.id,
        fromStatus: vaga.status,
        toStatus: 'ADMISSAO_EM_ANDAMENTO',
        descricao: `Status atualizado automaticamente: candidato aprovado (${candidato.nome}) — admissão em andamento`,
      },
    })
  }

  return NextResponse.json(candidato)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string; cid: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const ro = forbidIfReadOnly(session!.user.role)
  if (ro) return ro

  const vaga = await prisma.vaga.findUnique({ where: { id: params.id } })
  if (!vaga) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const _u: string[] = (session!.user as any).unitIds?.length ? (session!.user as any).unitIds : (session!.user.unitId ? [session!.user.unitId] : []);if (session!.user.role === 'ANALYST' && !_u.includes(vaga.unidadeId ?? '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

  const c = await prisma.candidato.findUnique({ where: { id: params.cid } })

  // Remove o arquivo físico se existir
  if (c?.cvFileName) {
    try {
      await unlink(path.join(process.cwd(), 'public', 'uploads', 'cvs', c.cvFileName))
    } catch { /* arquivo pode não existir */ }
  }

  await prisma.candidato.delete({ where: { id: params.cid } })

  if (c) {
    await prisma.vagaHistorico.create({
      data: { vagaId: params.id, userId: session!.user.id, descricao: `Candidato removido: ${c.nome}` },
    })
  }

  return NextResponse.json({ success: true })
}
