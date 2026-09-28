import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { log, extractIp } from '@/lib/audit'
import { buildExportWorkbook, buildTemplateWorkbook } from '@/lib/positionSheet'
import { loadSheetData, loadSheetMeta } from '@/lib/positionSheetServer'

export const dynamic = 'force-dynamic'

// GET ?tipo=exportar (padrão) → cargos, salários e unidades; ?tipo=modelo → planilha modelo de importação.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = req.nextUrl.searchParams.get('tipo') === 'modelo'
  const [{ positions, units }, meta] = await Promise.all([loadSheetData(), loadSheetMeta(session.user.name ?? 'Usuário')])
  const workbook = template
    ? await buildTemplateWorkbook(units.filter((unit) => unit.active), meta)
    : await buildExportWorkbook(positions, units, meta)
  const buffer = await workbook.xlsx.writeBuffer()

  if (!template) {
    await log({
      userId: session.user.id, userName: session.user.name, userRole: session.user.role,
      action: 'VIEW_FILE', entity: 'Cargo', entityName: 'Exportação de cargos e salários',
      details: { cargos: positions.length }, ip: extractIp(req.headers),
    })
  }
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' })
  const fileName = template ? 'modelo-importacao-cargos.xlsx' : `cargos-salarios-unidades-${date}.xlsx`
  return new NextResponse(new Uint8Array(buffer as ArrayBuffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  })
}
