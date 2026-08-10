import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { employeeImageUrl, refreshColaboradorFromErpnext } from '@/lib/erpnextEmployees'
import { erpnextConfigured } from '@/lib/erpnextClient'

const ALLOWED = ['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE']

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!ALLOWED.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const refresh = req.nextUrl.searchParams.get('refresh') === '1'

  let row = await prisma.colaborador.findUnique({
    where: { id: params.id },
    include: { unit: { select: { id: true, name: true, color: true } } },
  })

  // Também aceita lookup por erpnextId
  if (!row) {
    row = await prisma.colaborador.findUnique({
      where: { erpnextId: params.id },
      include: { unit: { select: { id: true, name: true, color: true } } },
    })
  }

  if (!row) return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })

  if (refresh && erpnextConfigured()) {
    try {
      const updated = await refreshColaboradorFromErpnext(row.erpnextId)
      row = await prisma.colaborador.findUnique({
        where: { id: updated.id },
        include: { unit: { select: { id: true, name: true, color: true } } },
      })
    } catch (e) {
      console.error('[colaboradores] refresh ERPNext falhou:', e)
    }
  }

  if (!row) return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })

  const canSeeSensitive = ['ADMIN', 'SUPERINTENDENT', 'GERENTE'].includes(session!.user.role)

  return NextResponse.json({
    ...row,
    cpf: canSeeSensitive ? row.cpf : row.cpf ? `***.***.***-${String(row.cpf).slice(-2)}` : null,
    imageUrl: employeeImageUrl(row.imagePath),
    erpnextUrl: process.env.ERPNEXT_BASE_URL
      ? `${process.env.ERPNEXT_BASE_URL.replace(/\/$/, '')}/app/employee/${encodeURIComponent(row.erpnextId)}`
      : null,
  })
}
