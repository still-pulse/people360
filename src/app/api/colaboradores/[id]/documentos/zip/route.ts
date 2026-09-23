import { NextRequest, NextResponse } from 'next/server'
import { allowRequest, dossieRoute } from '@/lib/dossie/http'
import { employeeDocumentHistory } from '@/lib/dossie/documentHistory'
import { archiveResponseBody, createEmployeeArchive } from '@/lib/dossie/documentArchive'
import { auditDossie } from '@/lib/dossie/history'

export const runtime = 'nodejs'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return dossieRoute(req, 'employee.documents.export', id, async ({ colaborador, actor, ip }) => {
    if (!allowRequest(`documents-zip:${actor.id}:${colaborador.id}`, 3, 60_000)) return NextResponse.json({ error: 'Aguarde um minuto antes de exportar novamente.' }, { status: 429 })
    const files = await employeeDocumentHistory(colaborador)
    if (!files.length) return NextResponse.json({ error: 'Este colaborador ainda não possui documentos.' }, { status: 404 })
    const archive = await createEmployeeArchive(colaborador.employeeName, files)
    try {
      await auditDossie({ actor, action: 'VIEW_FILE', entity: 'DocumentosZIP', colaboradorId: colaborador.id, ip, details: { quantidade: files.length } })
      return new NextResponse(archiveResponseBody(archive), { headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${archive.fileName.replace(/[^A-Za-z0-9._ -]/g, '_')}"`,
        'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
      } })
    } catch (error) { await archive.cleanup(); throw error }
  })
}
