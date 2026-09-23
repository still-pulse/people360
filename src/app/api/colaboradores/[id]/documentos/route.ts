import { NextRequest, NextResponse } from 'next/server'
import { dossieRoute } from '@/lib/dossie/http'
import { employeeDocumentHistory, historyMetadata } from '@/lib/dossie/documentHistory'

export async function GET(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params
  return dossieRoute(req, 'employee.documents.view', id, async ({ colaborador }) => {
    const items = historyMetadata(await employeeDocumentHistory(colaborador))
    return NextResponse.json({ items, total: items.length }, { headers: { 'Cache-Control': 'private, no-store' } })
  })
}
