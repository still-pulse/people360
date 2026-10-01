import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { enforceUnitFilter, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { canBadge } from '@/lib/badges/permissions'
import { employeeBadgeSnapshot, snapshotNeedsUpdate } from '@/lib/badges/data'
import { BADGE_TYPE, type BadgeSnapshot } from '@/lib/badges/types'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  const actualRole = session!.user.actualRole ?? session!.user.role
  if (!canBadge(actualRole, 'badges.view')) return NextResponse.json({ error: 'Sem permissão para visualizar crachás.' }, { status: 403 })
  const q = req.nextUrl.searchParams
  const page = Math.max(1, Number(q.get('page')) || 1)
  const take = Math.min(100, Math.max(10, Number(q.get('limit')) || 25))
  const search = (q.get('search') || '').trim()
  const where: Prisma.ColaboradorWhereInput = { status: 'Active' }
  if (search) where.OR = [
    { employeeName: { contains: search, mode: 'insensitive' } }, { matricula: { contains: search, mode: 'insensitive' } },
    { erpnextId: { contains: search, mode: 'insensitive' } }, { designation: { contains: search, mode: 'insensitive' } },
    { department: { contains: search, mode: 'insensitive' } },
  ]
  if (q.get('unitId')) where.unitId = q.get('unitId')!
  if (q.get('department')) where.department = { contains: q.get('department')!, mode: 'insensitive' }
  if (q.get('role')) where.designation = { contains: q.get('role')!, mode: 'insensitive' }
  enforceUnitFilter(where as Record<string, unknown>, session!, q.get('unitId'))

  const [total, rows, units] = await Promise.all([
    prisma.colaborador.count({ where }),
    prisma.colaborador.findMany({
      where, include: {
        unit: { select: { id: true, name: true, color: true } }, perfil: true,
        documentos: { where: { tipo: BADGE_TYPE }, orderBy: { versao: 'desc' }, take: 1 },
      }, orderBy: { employeeName: 'asc' }, skip: (page - 1) * take, take,
    }),
    prisma.unit.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ])
  const data = await Promise.all(rows.map(async ({ documentos, ...employee }) => {
    const current = await employeeBadgeSnapshot(employee)
    const last = documentos[0]
    const previous = last?.snapshot as BadgeSnapshot | null
    return {
      id: employee.id, employeeName: employee.employeeName, matricula: employee.matricula,
      designation: employee.designation, department: employee.department, unit: employee.unit,
      photoUrl: current.photoId ? `/api/colaboradores/${employee.id}/crachas/foto` : null,
      badgeStatus: !last ? 'NOT_GENERATED' : snapshotNeedsUpdate(current, previous) ? 'UPDATE_REQUIRED' : 'GENERATED',
      lastBadge: last ? { id: last.id, version: last.versao, generatedAt: last.geradoEm ?? last.createdAt } : null,
    }
  }))
  return NextResponse.json({ data, total, page, pages: Math.max(1, Math.ceil(total / take)), units })
}
