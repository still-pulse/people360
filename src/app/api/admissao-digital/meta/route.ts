import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceUnitFilter, getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const unitWhere: Record<string, any> = { active: true }; enforceUnitFilter(unitWhere, session!, null, 'id')
  const [units, candidates, vacancies, users, documentTypes] = await Promise.all([
    prisma.unit.findMany({ where: unitWhere, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.candidato.findMany({ where: { status: { in: ['APROVADO', 'AGUARDANDO_ADMISSAO'] } }, select: { id: true, nome: true, email: true, telefone: true, vagaId: true, vaga: { select: { cargo: true, unidadeId: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.vaga.findMany({ where: { status: { in: ['APROVADA_CONTRATACAO', 'ADMISSAO_EM_ANDAMENTO'] } }, select: { id: true, titulo: true, cargo: true, setor: true, unidadeId: true, salarioMin: true, salarioMax: true, horarioTrabalho: true, cargaHoraria: true, tipoContrato: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.user.findMany({ where: { active: true, role: { in: ['ADMIN', 'ANALYST'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.admissionDocumentType.findMany({ where: { active: true }, orderBy: { position: 'asc' } }),
  ])
  return NextResponse.json({ units, candidates, vacancies, users, documentTypes })
}
