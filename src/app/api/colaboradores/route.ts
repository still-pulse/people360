import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

const ALLOWED = ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE']

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!ALLOWED.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
  const limit = Math.min(100, Math.max(10, parseInt(searchParams.get('limit') || '30', 10)))
  const search = (searchParams.get('search') || '').trim()
  const status = searchParams.get('status') || ''
  const company = searchParams.get('company') || ''
  const designation = searchParams.get('designation') || ''
  const unitId = searchParams.get('unitId') || ''
  const pcd = searchParams.get('pcd')

  const where: any = {}
  if (status) where.status = status
  if (company) where.company = { contains: company, mode: 'insensitive' }
  if (designation) where.designation = { contains: designation, mode: 'insensitive' }
  if (unitId) where.unitId = unitId
  if (pcd === '1' || pcd === 'true') where.pcd = true
  if (pcd === '0' || pcd === 'false') where.pcd = false

  if (search) {
    where.OR = [
      { employeeName: { contains: search, mode: 'insensitive' } },
      { erpnextId: { contains: search, mode: 'insensitive' } },
      { matricula: { contains: search, mode: 'insensitive' } },
      { department: { contains: search, mode: 'insensitive' } },
      { designation: { contains: search, mode: 'insensitive' } },
      { cellNumber: { contains: search, mode: 'insensitive' } },
      { personalEmail: { contains: search, mode: 'insensitive' } },
      { cpf: { contains: search, mode: 'insensitive' } },
    ]
  }

  const [total, rows] = await Promise.all([
    prisma.colaborador.count({ where }),
    prisma.colaborador.findMany({
      where,
      include: { unit: { select: { id: true, name: true, color: true } } },
      orderBy: [{ employeeName: 'asc' }],
      skip: (page - 1) * limit,
      take: limit,
    }),
  ])

  // CPF só para perfis de gestão (não ANALYST na lista — ainda vê no detalhe? hide in list for all non-admin)
  const canSeeSensitive = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session!.user.role)
  const data = rows.map((r) => ({
    ...r,
    cpf: canSeeSensitive ? r.cpf : r.cpf ? `***.***.***-${r.cpf.slice(-2)}` : null,
  }))

  return NextResponse.json({
    data,
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
  })
}
