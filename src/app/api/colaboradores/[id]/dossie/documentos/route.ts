import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createDocumento, docFileName, DossieError, previewDocumento } from '@/lib/dossie/documentos'
import { isoDay } from '@/lib/dossie/format'
import { dossieRoute, pdfResponse, readJson } from '@/lib/dossie/http'
import { roleCan } from '@/lib/dossie/permissions'

const LIST_SELECT = {
  id: true, tipo: true, categoria: true, titulo: true, origem: true, status: true, versao: true, vigenciaInicio: true, vigenciaFim: true,
  geradoEm: true, createdAt: true, criadoPorNome: true, arquivoNome: true, arquivoTamanho: true, arquivoMime: true, arquivoPath: true,
  origemDocumentoId: true, assinaturas: true, observacao: true, canceladoEm: true, motivoCancelamento: true, templateVersion: true,
} satisfies Prisma.ColaboradorDocumentoSelect

/** Lista metadados (sem arquivos, snapshot ou dados sensíveis). Paginada. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const q = req.nextUrl.searchParams
    const where: Prisma.ColaboradorDocumentoWhereInput = { colaboradorId: colaborador.id }
    if (q.get('categoria')) where.categoria = q.get('categoria')!
    if (q.get('status')) where.status = q.get('status') as Prisma.EnumColaboradorDocumentoStatusFilter['equals']
    if (q.get('tipo')) where.tipo = q.get('tipo')!
    if (q.get('origem')) where.origem = q.get('origem') as 'GERADO' | 'ANEXADO'
    const take = Math.min(Math.max(Number(q.get('take')) || 50, 1), 100)
    const skip = Math.max(Number(q.get('skip')) || 0, 0)
    const [rows, total] = await Promise.all([
      prisma.colaboradorDocumento.findMany({ where, select: LIST_SELECT, orderBy: [{ createdAt: 'desc' }], skip, take }),
      prisma.colaboradorDocumento.count({ where }),
    ])
    return NextResponse.json({
      total,
      items: rows.map(({ arquivoPath, ...row }) => ({ ...row, temArquivo: !!arquivoPath })),
    })
  })
}

/** Cria rascunho, gera o documento definitivo ou devolve o preview em PDF. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.create', params.id, async ({ colaborador, actor, ip }) => {
    const body = await readJson(req)
    const tipo = String(body.tipo || '')
    const mode = String(body.mode || 'generate')
    if (tipo.startsWith('CONTRATO') && !roleCan(actor.role, 'employee.contracts.create')) {
      throw new DossieError('Sem permissão para gerar contratos.', 403)
    }
    if (mode === 'preview') {
      const preview = await previewDocumento(colaborador.id, tipo, body.dados, actor)
      return pdfResponse(preview.buffer, docFileName(preview.title, preview.snapshot.nome, { date: isoDay() }), true)
    }
    if (mode !== 'draft' && mode !== 'generate') throw new DossieError('Modo inválido.', 400)
    const document = await createDocumento({ colaboradorId: colaborador.id, tipo, dados: body.dados, mode, actor, ip })
    return NextResponse.json({ id: document.id, status: document.status, titulo: document.titulo }, { status: 201 })
  })
}
