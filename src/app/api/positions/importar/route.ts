import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'
import { planImport, readSheet } from '@/lib/positionSheet'
import { loadSheetData } from '@/lib/positionSheetServer'

export const dynamic = 'force-dynamic'
const MAX_FILE_SIZE = 5 * 1024 * 1024

// POST multipart: file (.xlsx) + apply ("true" grava; sem ele, só devolve a prévia).
// A importação só cria e atualiza: nunca exclui cargos, salários ou aliases.
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores importam cargos e salários.' }, { status: 403 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) return NextResponse.json({ error: 'Envie a planilha .xlsx.' }, { status: 400 })
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: 'A planilha deve ter no máximo 5 MB.' }, { status: 400 })
  const apply = form?.get('apply') === 'true'

  const sheet = await readSheet(await file.arrayBuffer())
  const { positions, units } = await loadSheetData()
  const plan = planImport(sheet.rows, positions, units)
  const errors = [...sheet.errors, ...plan.errors].sort((a, b) => a.line - b.line)
  const unitName = new Map(units.map((unit) => [unit.id, unit.name]))
  const preview = {
    sheetName: sheet.sheetName, summary: plan.summary, errors: errors.slice(0, 200), totalErrors: errors.length,
    changes: plan.positions.map((position) => ({
      name: position.name, isNew: !position.existingId, fields: Object.keys(position.data), aliases: position.aliases,
      salaries: position.salaries.map((salary) => ({
        unit: salary.unitId ? unitName.get(salary.unitId) ?? '' : 'Todas as unidades', salario: salary.salario, previous: salary.previous,
      })),
    })),
  }
  if (!apply) return NextResponse.json(preview)
  if (errors.length) return NextResponse.json({ ...preview, error: 'Corrija os erros da planilha antes de importar.' }, { status: 422 })
  if (!plan.positions.length) return NextResponse.json({ ...preview, applied: true })

  try {
    await prisma.$transaction(async (tx) => {
      for (const position of plan.positions) {
        if (!position.existingId) {
          await tx.position.create({
            data: {
              name: position.name.trim(),
              categoria: position.data.categoria ?? null, departamento: position.data.departamento ?? null,
              codigoInterno: position.data.codigoInterno ?? null, active: position.data.active ?? true,
              salarios: { create: position.salaries.map((salary) => ({ unitId: salary.unitId, salario: salary.salario })) },
              aliases: { create: position.aliases.map((alias) => ({ alias })) },
            },
          })
          continue
        }
        const positionId = position.existingId
        if (Object.keys(position.data).length) await tx.position.update({ where: { id: positionId }, data: position.data })
        for (const salary of position.salaries) {
          if (salary.existingSalaryId) await tx.positionSalary.update({ where: { id: salary.existingSalaryId }, data: { salario: salary.salario } })
          else await tx.positionSalary.create({ data: { positionId, unitId: salary.unitId, salario: salary.salario } })
        }
        if (position.aliases.length) await tx.cargoAlias.createMany({ data: position.aliases.map((alias) => ({ positionId, alias })) })
      }
    }, { timeout: 60000 })
  } catch (err) {
    console.error('[positions/importar]', err)
    return NextResponse.json({ ...preview, error: 'Não foi possível gravar a importação. Nenhuma alteração foi feita.' }, { status: 500 })
  }

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'UPLOAD', entity: 'Cargo', entityName: `Importação de cargos (${file.name})`,
    details: { ...plan.summary, cargos: plan.positions.map((position) => position.name) }, ip: extractIp(req.headers),
  })
  return NextResponse.json({ ...preview, applied: true })
}
