import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { log, extractIp } from '@/lib/audit'
import { mergeSalarios, parseSalarios, positionInclude, salaryKey, vagasPorUnidade } from '@/lib/positionSalaries'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const all = searchParams.get('all') === 'true'
  const withAliases = searchParams.get('aliases') === 'true'

  const positions = await prisma.position.findMany({
    where: all ? {} : { active: true },
    orderBy: { name: 'asc' },
    include: withAliases ? positionInclude : undefined,
  })
  if (!withAliases) return NextResponse.json(positions)
  const porUnidade = await vagasPorUnidade()
  return NextResponse.json(positions.map((p) => ({ ...p, vagasPorUnidade: porUnidade.get(p.id) ?? {} })))
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  if (!body.name?.trim()) return NextResponse.json({ error: 'Nome é obrigatório.' }, { status: 400 })

  const existing = await prisma.position.findFirst({
    where: { name: { equals: body.name.trim(), mode: 'insensitive' } },
  })
  const { salarios, error: salarioError } = parseSalarios(body.salarios)
  if (salarioError) return NextResponse.json({ error: salarioError }, { status: 400 })
  if (salarios && session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Apenas administradores definem salários.' }, { status: 403 })

  // Cargo já cadastrado: as unidades informadas são acrescentadas a ele (o nome continua único).
  if (existing) {
    if (!salarios?.length) return NextResponse.json({ error: 'Já existe um cargo com este nome. Marque as unidades e o salário para adicioná-las a ele.' }, { status: 400 })
    // Nunca sobrescreve: unidade que já tem salário neste cargo só muda pelo "Editar".
    const current = await prisma.positionSalary.findMany({ where: { positionId: existing.id }, select: { unitId: true, cargaHorariaMensal: true, unit: { select: { name: true } } } })
    const conflicts = current.filter((c) => salarios.some((s) => salaryKey(s) === salaryKey(c)))
    if (conflicts.length) {
      const nomes = conflicts.map((c) => `${c.unit?.name ?? 'Todas as unidades (padrão)'}${c.cargaHorariaMensal ? ` (${c.cargaHorariaMensal}h)` : ''}`).join(', ')
      return NextResponse.json({ error: `O cargo ${existing.name} já tem salário em: ${nomes}. Desmarque essas unidades; para alterar o salário delas, use Editar.` }, { status: 409 })
    }
    await mergeSalarios(existing.id, salarios)
    const position = await prisma.position.update({
      where: { id: existing.id },
      data: {
        ...(!existing.categoria && body.categoria ? { categoria: body.categoria } : {}),
        ...(!existing.departamento && body.departamento?.trim() ? { departamento: body.departamento.trim() } : {}),
      },
      include: positionInclude,
    })
    await log({
      userId: session.user.id, userName: session.user.name, userRole: session.user.role,
      action: 'UPDATE', entity: 'Cargo', entityId: existing.id, entityName: existing.name,
      details: { unidadesAdicionadas: salarios.map((s) => `${s.unitId ?? 'todas'}${s.cargaHorariaMensal ? `:${s.cargaHorariaMensal}h` : ''}`) },
      ip: extractIp(req.headers),
    })
    return NextResponse.json({ ...position, merged: true })
  }

  const position = await prisma.position.create({
    data: {
      name: body.name.trim(),
      codigoInterno: body.codigoInterno || null,
      categoria: body.categoria || null,
      departamento: body.departamento?.trim() || null,
      ...(salarios?.length ? { salarios: { create: salarios } } : {}),
    },
    include: positionInclude,
  })

  await log({
    userId: session.user.id, userName: session.user.name, userRole: session.user.role,
    action: 'CREATE', entity: 'Cargo', entityId: position.id, entityName: position.name,
    ip: extractIp(req.headers),
  })

  return NextResponse.json(position, { status: 201 })
}
