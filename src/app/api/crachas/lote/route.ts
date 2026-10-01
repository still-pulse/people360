import { NextRequest, NextResponse } from 'next/server'
import JSZip from 'jszip'
import { prisma } from '@/lib/prisma'
import { analystCanAccessUnit, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { canBadge } from '@/lib/badges/permissions'
import { employeeBadgeSnapshot, printableBadgeDocument, snapshotNeedsUpdate, validateBadgeSnapshot } from '@/lib/badges/data'
import { BadgeError, generateBadge } from '@/lib/badges/service'
import { BADGE_TYPE, type BadgeSnapshot } from '@/lib/badges/types'
import { badgeArchiveFolder, badgeBatchCsvRow, safeBadgeArchiveName, splitBadgePdf } from '@/lib/badges/batch'
import { readDossieFile } from '@/lib/dossie/storage'
import { allowRequest } from '@/lib/dossie/http'
import { extractIp, log } from '@/lib/audit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const role = session!.user.actualRole ?? session!.user.role
  if (!canBadge(role, 'badges.generate') || !canBadge(role, 'badges.download')) {
    return NextResponse.json({ error: 'Sem permissão para gerar crachás em lote.' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({})) as Record<string, unknown>
  const unitId = typeof body.unitId === 'string' ? body.unitId.trim() : ''
  if (!unitId) return NextResponse.json({ error: 'Selecione uma unidade para gerar o lote.' }, { status: 400 })
  if (!analystCanAccessUnit(session!, unitId)) return NextResponse.json({ error: 'Sem acesso a esta unidade.' }, { status: 403 })
  if (!allowRequest(`badges-batch:${session!.user.id}:${unitId}`, 2, 60_000)) {
    return NextResponse.json({ error: 'Aguarde um minuto antes de gerar outro lote desta unidade.' }, { status: 429 })
  }

  const unit = await prisma.unit.findFirst({ where: { id: unitId, active: true }, select: { id: true, name: true } })
  if (!unit) return NextResponse.json({ error: 'Unidade não encontrada.' }, { status: 404 })
  const employees = await prisma.colaborador.findMany({
    where: { status: 'Active', unitId },
    include: {
      unit: { select: { id: true, name: true, color: true } },
      perfil: true,
      documentos: { where: { tipo: BADGE_TYPE }, orderBy: { versao: 'desc' }, take: 1 },
    },
    orderBy: [{ employeeName: 'asc' }, { id: 'asc' }],
  })
  if (!employees.length) return NextResponse.json({ error: 'Nenhum colaborador ativo encontrado nesta unidade.' }, { status: 404 })

  const actor = { id: session!.user.id, name: session!.user.name || session!.user.email || 'Usuário', role }
  const zip = new JSZip()
  const day = new Date().toISOString().slice(0, 10)
  const rootName = `Crachas - ${safeBadgeArchiveName(unit.name, 'Unidade')} - ${day}`
  const root = zip.folder(rootName)!
  const report = [badgeBatchCsvRow(['Colaborador', 'Matrícula', 'Status', 'Detalhes'])]
  let generated = 0
  let reused = 0
  let skipped = 0

  for (const [index, row] of employees.entries()) {
    const { documentos, ...employee } = row
    const folder = root.folder(badgeArchiveFolder(index, employee.employeeName, employee.matricula || employee.erpnextId))!
    try {
      const snapshot = await employeeBadgeSnapshot(employee)
      const missing = validateBadgeSnapshot(snapshot)
      if (missing.length) {
        skipped++
        folder.file('PENDENCIA.txt', `Crachá não gerado. Verifique: ${missing.join(', ')}.`)
        report.push(badgeBatchCsvRow([employee.employeeName, snapshot.employeeId, 'PENDENTE', missing.join(', ')]))
        continue
      }

      const previous = documentos[0]
      const previousSnapshot = previous?.snapshot as BadgeSnapshot | null
      let pdf = previous?.arquivoPath && !snapshotNeedsUpdate(snapshot, previousSnapshot)
        ? await readDossieFile(previous.arquivoPath)
        : null
      let sides = null
      if (pdf) {
        try { sides = await splitBadgePdf(pdf) } catch { pdf = null }
      }
      let status = 'REUTILIZADO'
      if (!pdf) {
        const professionalRegistration = printableBadgeDocument(previousSnapshot?.document)
        const document = await generateBadge({
          employee,
          overrides: professionalRegistration ? { document: professionalRegistration } : {},
          issueType: previous ? 'SECOND_COPY' : 'INITIAL',
          reason: `Emissão em lote - ${unit.name}`,
          actor,
          ip: extractIp(req.headers),
        })
        pdf = document.arquivoPath ? await readDossieFile(document.arquivoPath) : null
        if (!pdf) throw new Error('O PDF gerado não pôde ser recuperado.')
        sides = await splitBadgePdf(pdf)
        generated++
        status = 'GERADO'
      } else reused++

      if (!sides) throw new Error('Não foi possível separar frente e verso.')
      folder.file('01-frente.pdf', sides.front)
      folder.file('02-verso.pdf', sides.back)
      report.push(badgeBatchCsvRow([employee.employeeName, snapshot.employeeId, status, 'Frente e verso incluídos']))
    } catch (batchError) {
      skipped++
      const message = batchError instanceof BadgeError ? batchError.message : 'Falha ao gerar ou recuperar o crachá'
      folder.file('PENDENCIA.txt', `${message}. Tente novamente ou gere o crachá individualmente.`)
      report.push(badgeBatchCsvRow([employee.employeeName, employee.matricula || employee.erpnextId, 'ERRO', message]))
    }
  }

  root.file('relatorio.csv', `\uFEFF${report.join('\r\n')}`)
  const archive = await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE', streamFiles: true })
  await log({
    userId: actor.id, userName: actor.name, userRole: actor.role, action: 'VIEW_FILE', entity: 'CrachaLote', entityId: unit.id,
    entityName: unit.name, details: { colaboradores: employees.length, gerados: generated, reutilizados: reused, pendentes: skipped }, ip: extractIp(req.headers),
  })
  const fileName = `${safeBadgeArchiveName(rootName).replace(/\s+/g, '_')}.zip`
  return new NextResponse(new Uint8Array(archive), { headers: {
    'Content-Type': 'application/zip',
    'Content-Disposition': `attachment; filename="${fileName}"`,
    'Content-Length': String(archive.length),
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Badges-Generated': String(generated),
    'X-Badges-Reused': String(reused),
    'X-Badges-Skipped': String(skipped),
  } })
}
