import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { decryptAdmissionText } from '@/lib/admission/security'
import { amendmentValueLabel } from '@/lib/dossie/catalog'
import { createAditivo, docFileName, previewAditivo } from '@/lib/dossie/documentos'
import { isoDay } from '@/lib/dossie/format'
import { dossieRoute, pdfResponse, readJson } from '@/lib/dossie/http'

const aditivoSchema = z.object({
  tipoAlteracao: z.string().min(1, 'Selecione o tipo de alteração.'),
  valorNovo: z.string().trim().min(1, 'Informe a nova informação (o que está sendo alterado).').max(300),
  valorAnterior: z.string().trim().max(300).optional(),
  descricao: z.string().trim().max(300).optional(),
  vigencia: z.string().min(8, 'Informe a data de vigência do aditivo.'),
  motivo: z.string().trim().min(3, 'Informe o motivo da alteração.').max(500),
  clausulas: z.string().trim().max(4000).optional(),
  mode: z.enum(['preview', 'generate']).default('generate'),
})

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const rows = await prisma.colaboradorAditivo.findMany({
      where: { colaboradorId: colaborador.id }, orderBy: [{ vigencia: 'desc' }, { numero: 'desc' }],
      include: { documento: { select: { id: true, status: true } } },
    })
    return NextResponse.json({
      items: rows.map((row) => ({
        id: row.id, numero: row.numero, tipoAlteracao: row.tipoAlteracao, campoAlterado: decryptAdmissionText(row.campoAlterado), vigencia: row.vigencia, motivo: decryptAdmissionText(row.motivo),
        anterior: amendmentValueLabel(row.tipoAlteracao, decryptAdmissionText(row.valorAnterior)), novo: amendmentValueLabel(row.tipoAlteracao, decryptAdmissionText(row.valorNovo)),
        documentoId: row.documento?.id ?? null, status: row.documento?.status ?? null, criadoPorNome: row.criadoPorNome, createdAt: row.createdAt,
      })),
    })
  })
}

/** Cria um novo aditivo (insert-only) ou devolve o preview em PDF. Não altera nem apaga aditivos anteriores. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  return dossieRoute(req, 'employee.amendments.create', params.id, async ({ colaborador, actor, ip }) => {
    const { mode, ...input } = aditivoSchema.parse(await readJson(req))
    if (mode === 'preview') {
      const buffer = await previewAditivo(colaborador.id, input, actor)
      return pdfResponse(buffer, docFileName('Aditivo Contratual', colaborador.employeeName, { date: isoDay() }), true)
    }
    const { document, aditivo } = await createAditivo({ colaboradorId: colaborador.id, input, actor, ip })
    return NextResponse.json({ id: aditivo.id, documentoId: document.id, numero: aditivo.numero }, { status: 201 })
  })
}
