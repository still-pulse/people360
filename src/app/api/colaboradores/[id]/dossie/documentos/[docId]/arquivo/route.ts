import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { docFileName, readDocumentoFile } from '@/lib/dossie/documentos'
import { auditDossie } from '@/lib/dossie/history'
import { dossieRoute } from '@/lib/dossie/http'

/** Entrega o arquivo por rota autenticada (nunca por URL pública). `?inline=1` abre no navegador. */
export async function GET(
  req: NextRequest,
  props: { params: Promise<{ id: string; docId: string }> }
) {
  const params = await props.params;
  return dossieRoute(req, 'employee.documents.export', params.id, async ({ colaborador, actor, ip }) => {
    const document = await prisma.colaboradorDocumento.findFirst({ where: { id: params.docId, colaboradorId: colaborador.id } })
    if (!document) return NextResponse.json({ error: 'Documento não encontrado.' }, { status: 404 })
    const buffer = await readDocumentoFile(document)
    if (!buffer) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 })
    const inline = req.nextUrl.searchParams.get('inline') === '1'
    await auditDossie({ actor, action: 'VIEW_FILE', entity: 'Documento', entityId: document.id, colaboradorId: colaborador.id, ip, details: { modo: inline ? 'visualizar' : 'baixar', tipo: document.tipo } })
    const mime = document.arquivoMime || 'application/pdf'
    if (mime !== 'application/pdf') {
      // Imagens anexadas: entrega com o tipo real (validado no upload) e download forçado quando não for inline.
      const name = (document.arquivoNome || 'anexo').replace(/[^A-Za-z0-9._-]/g, '_')
      return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': mime, 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${name}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } })
    }
    const fileName = document.origem === 'ANEXADO' ? (document.arquivoNome || 'anexo.pdf') : docFileName(document.titulo, colaborador.employeeName, { date: (document.geradoEm ?? document.createdAt).toISOString().slice(0, 10) })
    return new NextResponse(new Uint8Array(buffer), { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  });
}
