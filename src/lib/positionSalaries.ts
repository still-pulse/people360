import { prisma } from '@/lib/prisma'
import { ADMISSION_MONTHLY_HOURS_OPTIONS } from '@/lib/admission/positions'

export type SalaryInput = { unitId: string | null; cargaHorariaMensal: number | null; salario: number }

/** Chave de unicidade do salário: unidade + carga horária (nulos = padrão / qualquer carga). */
export const salaryKey = (s: { unitId: string | null; cargaHorariaMensal?: number | null }) => `${s.unitId ?? '*'}|${s.cargaHorariaMensal ?? '*'}`

/** Valida a lista de salários enviada pelo formulário de cargos. unitId nulo = padrão para todas as unidades. */
export function parseSalarios(value: unknown): { salarios?: SalaryInput[]; error?: string } {
  if (value === undefined) return {}
  if (!Array.isArray(value)) return { error: 'Lista de salários inválida.' }
  const salarios: SalaryInput[] = []
  const seen = new Set<string>()
  for (const item of value) {
    const unitId = item?.unitId ? String(item.unitId) : null
    const salario = Number(item?.salario)
    if (!Number.isFinite(salario) || salario <= 0) return { error: 'Informe um salário maior que zero.' }
    const hours = item?.cargaHorariaMensal === null || item?.cargaHorariaMensal === undefined || item?.cargaHorariaMensal === '' ? null : Number(item.cargaHorariaMensal)
    if (hours !== null && !(ADMISSION_MONTHLY_HOURS_OPTIONS as readonly number[]).includes(hours)) return { error: `Carga horária mensal inválida. Use ${ADMISSION_MONTHLY_HOURS_OPTIONS.join(', ')} horas.` }
    const key = salaryKey({ unitId, cargaHorariaMensal: hours })
    if (seen.has(key)) return { error: unitId ? 'A mesma unidade aparece mais de uma vez com a mesma carga horária.' : 'Só pode haver um salário padrão por carga horária.' }
    seen.add(key)
    salarios.push({ unitId, cargaHorariaMensal: hours, salario: Math.round(salario * 100) / 100 })
  }
  return { salarios }
}

/** Substitui todos os salários do cargo pela lista informada. */
export function replaceSalarios(positionId: string, salarios: SalaryInput[]) {
  return prisma.$transaction([
    prisma.positionSalary.deleteMany({ where: { positionId } }),
    prisma.positionSalary.createMany({ data: salarios.map((s) => ({ positionId, unitId: s.unitId, cargaHorariaMensal: s.cargaHorariaMensal, salario: s.salario })) }),
  ])
}

/** Acrescenta salários de novas unidades a um cargo existente. Quem chama garante que essas unidades ainda não têm salário. */
export function mergeSalarios(positionId: string, salarios: SalaryInput[]) {
  return prisma.positionSalary.createMany({ data: salarios.map((s) => ({ positionId, unitId: s.unitId, cargaHorariaMensal: s.cargaHorariaMensal, salario: s.salario })) })
}

/** Vagas do cargo agrupadas por unidade ('' = vaga sem unidade), para a lista de cargos. */
export async function vagasPorUnidade(): Promise<Map<string, Record<string, number>>> {
  const grupos = await prisma.vaga.groupBy({ by: ['cargoId', 'unidadeId'], where: { cargoId: { not: null } }, _count: { _all: true } })
  const result = new Map<string, Record<string, number>>()
  for (const g of grupos) {
    const porUnidade = result.get(g.cargoId!) ?? {}
    porUnidade[g.unidadeId ?? ''] = g._count._all
    result.set(g.cargoId!, porUnidade)
  }
  return result
}

export const positionInclude = {
  aliases: { orderBy: { alias: 'asc' as const } },
  salarios: { select: { id: true, unitId: true, cargaHorariaMensal: true, salario: true, unit: { select: { name: true } } } },
  _count: { select: { vagas: true } },
}
