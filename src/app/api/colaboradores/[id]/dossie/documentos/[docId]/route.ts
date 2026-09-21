import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { changeStatus, DossieError, duplicateDocumento, generateDraft, updateDraft } from '@/lib/dossie/documentos'
import { dossieRoute, readJson } from '@/lib/dossie/http'
import { roleCan } from '@/lib/dossie/permissions'
import { HISTORY_TYPES } from '@/lib/dossie/history'

/** Detalhe: dados informados, assinaturas, cadeia de versões e eventos relacionados. */
export async function GET(req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const document = await prisma.colaboradorDocumento.findFirst({
      where: { id: params.docId, colaboradorId: colaborador.id },
      select: {
        id: true, tipo: true, categoria: true, titulo: true, origem: true, status: true, versao: true, dados: true, assinaturas: true, observacao: true,
        vigenciaInicio: true, vigenciaFim: true, geradoEm: true, createdAt: true, criadoPorNome: true, arquivoNome: true, arquivoMime: true, arquivoTamanho: true,
        arquivoPath: true, hash: true, templateKey: true, templateVersion: true, origemDocumentoId: true, canceladoEm: true, canceladoPorNome: true, motivoCancelamento: true,
      },
    })
    if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    const sameType = await prisma.colaboradorDocumento.findMany({
      where: { colaboradorId: colaborador.id, tipo: document.tipo, origem: 'GERADO' },
      select: { id: true, versao: true, status: true, createdAt: true, origemDocumentoId: true }, orderBy: { versao: 'asc' },
    })
    // Cadeia de versões: sobe até a raiz e desce pelos derivados.
    const byId = new Map(sameType.map((d) => [d.id, d]))
    let root = document.id
    while (byId.get(root)?.origemDocumentoId && byId.has(byId.get(root)!.origemDocumentoId!)) root = byId.get(root)!.origemDocumentoId!
    const chain = new Set([root])
    let grew = true
    while (grew) { grew = false; for (const d of sameType) if (d.origemDocumentoId && chain.has(d.origemDocumentoId) && !chain.has(d.id)) { chain.add(d.id); grew = true } }
    const events = await prisma.colaboradorHistorico.findMany({ where: { colaboradorId: colaborador.id, documentoId: document.id }, orderBy: { createdAt: 'desc' }, take: 30 })
    const { arquivoPath, ...rest } = document
    return NextResponse.json({
      ...rest, temArquivo: !!arquivoPath,
      versoes: sameType.filter((d) => chain.has(d.id)),
      eventos: events.map((e) => ({ id: e.id, tipo: HISTORY_TYPES[e.tipo] ?? e.tipo, titulo: e.titulo, motivo: e.motivo, em: e.createdAt, por: e.responsavelNome })),
    })
  })
}

/** Ações: editar rascunho, gerar, duplicar, mudar status (inclui cancelar). Nunca há exclusão física. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string; docId: string } }) {
  return dossieRoute(req, 'employee.documents.edit', params.id, async ({ colaborador, actor, ip }) => {
    const body = await readJson(req)
    const action = String(body.action || '')
    const base = { colaboradorId: colaborador.id, documentoId: params.docId, actor, ip }
    if (action === 'editar') return NextResponse.json(await updateDraft({ ...base, dados: body.dados }).then((d) => ({ id: d.id, status: d.status })))
    if (action === 'gerar') return NextResponse.json(await generateDraft({ ...base, dados: body.dados }).then((d) => ({ id: d.id, status: d.status })))
    if (action === 'duplicar') {
      if (!roleCan(actor.role, 'employee.documents.create')) throw new DossieError('Sem permissão.', 403)
      return NextResponse.json(await duplicateDocumento(base).then((d) => ({ id: d.id, status: d.status })), { status: 201 })
    }
    if (action === 'status') {
      const status = String(body.status || '')
      if (status === 'CANCELADO' && !roleCan(actor.role, 'employee.documents.cancel')) throw new DossieError('Sem permissão para cancelar documentos.', 403)
      return NextResponse.json(await changeStatus({ ...base, status, motivo: typeof body.motivo === 'string' ? body.motivo : undefined }).then((d) => ({ id: d.id, status: d.status })))
    }
    throw new DossieError('Ação inválida.', 400)
  })
}
