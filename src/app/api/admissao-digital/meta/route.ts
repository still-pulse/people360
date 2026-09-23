import { erpnextConfigured, listEmployeesPage, type EmployeeDoc } from '@/lib/erpnextClient'
import { resolveEmployeeUnit } from '@/lib/erpnextEmployeeUnit'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enforceUnitFilter, getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { ensureAdmissionDocumentTypes } from '@/lib/admission/service'
import { ADMISSION_MONTHLY_HOURS, ADMISSION_POSITIONS, ADMISSION_SCHEDULES, ADMISSION_DEFAULT_HAZARD_PAY } from '@/lib/admission/positions'

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  const unitWhere: Record<string, any> = { active: true }; enforceUnitFilter(unitWhere, session!, null, 'id')
  const [units, candidates, vacancies, users, documentTypes, collaborators] = await Promise.all([
    prisma.unit.findMany({ where: unitWhere, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.candidato.findMany({ where: { status: { in: ['APROVADO', 'AGUARDANDO_ADMISSAO'] } }, select: { id: true, nome: true, email: true, telefone: true, vagaId: true, vaga: { select: { cargo: true, unidadeId: true } } }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.vaga.findMany({ where: { status: { in: ['APROVADA_CONTRATACAO', 'ADMISSAO_EM_ANDAMENTO'] } }, select: { id: true, titulo: true, cargo: true, setor: true, unidadeId: true, salarioMin: true, salarioMax: true, horarioTrabalho: true, cargaHoraria: true, tipoContrato: true }, orderBy: { updatedAt: 'desc' }, take: 100 }),
    prisma.user.findMany({ where: { active: true, role: { in: ['ADMIN', 'ANALYST'] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ensureAdmissionDocumentTypes(),
    prisma.colaborador.findMany({ where: { status: 'Active', ...(!erpnextConfigured() && unitWhere.id ? { unitId: unitWhere.id } : {}) }, select: { id: true, erpnextId: true, employeeName: true, personalEmail: true, cellNumber: true, designation: true, department: true, dateOfJoining: true, dateOfBirth: true, gender: true, cpf: true, rg: true, etnia: true, naturalidade: true, unitId: true, unit: { select: { name: true } } }, orderBy: { employeeName: 'asc' } }),
  ])
  let resolvedCollaborators = collaborators
  if (erpnextConfigured()) {
    try {
      const remote = new Map<string, EmployeeDoc>()
      for (let start = 0; ; start += 500) {
        const page = await listEmployeesPage({ limit: 500, start, status: 'Active' })
        for (const employee of page) remote.set(employee.name, employee)
        if (page.length < 500) break
      }
      resolvedCollaborators = collaborators.flatMap(collaborator => {
        const employee = remote.get(collaborator.erpnextId)
        if (!employee) return []
        const unit = resolveEmployeeUnit(units, employee.company, employee.branch)
        if (unitWhere.id && !unit) return []
        return [{ ...collaborator, unitId: unit?.id ?? null, unit: unit ? { name: unit.name } : null }]
      })
    } catch {
      return NextResponse.json({ error: 'Não foi possível consultar as unidades no ERPNext. Tente novamente.' }, { status: 502 })
    }
  }
  const positions = ADMISSION_POSITIONS.map((p) => ({ cargo: p.cargo, departamento: p.departamento, salario: p.salario }))
  return NextResponse.json({ units, candidates, vacancies, users, documentTypes, collaborators: resolvedCollaborators, positions, schedules: ADMISSION_SCHEDULES, monthlyHours: ADMISSION_MONTHLY_HOURS, hazardPay: ADMISSION_DEFAULT_HAZARD_PAY })
}
