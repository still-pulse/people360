import { NextRequest, NextResponse } from 'next/server'
import { dossieRoute } from '@/lib/dossie/http'
import { employeeDocumentHistory } from '@/lib/dossie/documentHistory'
import { auditDossie } from '@/lib/dossie/history'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return dossieRoute(req, 'employee.documents.export', id, async ({ colaborador, actor, ip }) => {
    const files = await employeeDocumentHistory(colaborador)
    const file = files.find(item => item.id === req.nextUrl.searchParams.get('documento'))
    if (!file) return NextResponse.json({ error: 'Documento não encontrado para este colaborador.' }, { status: 404 })
    const bytes = await file.read()
    if (!bytes) return NextResponse.json({ error: 'Arquivo indisponível.' }, { status: 404 })
    const inline = req.nextUrl.searchParams.get('inline') === '1'
    await auditDossie({ actor, action: 'VIEW_FILE', entity: 'DocumentoHistorico', entityId: file.id, colaboradorId: colaborador.id, ip, details: { modo: inline ? 'visualizar' : 'baixar' } })
    const mime = ['application/pdf', 'image/jpeg', 'image/png'].includes(file.mimeType) ? file.mimeType : 'application/octet-stream'
    return new NextResponse(new Uint8Array(bytes), { headers: {
      'Content-Type': mime,
      'Content-Disposition': `${inline && mime !== 'application/octet-stream' ? 'inline' : 'attachment'}; filename="${file.fileName.replace(/[^A-Za-z0-9._-]/g, '_')}"`,
      'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
    } })
  })
}
