import { prisma } from '@/lib/prisma'

export type SalaryInput = { unitId: string | null; salario: number }

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
    const key = unitId ?? '*'
    if (seen.has(key)) return { error: unitId ? 'A mesma unidade aparece mais de uma vez.' : 'Só pode haver um salário padrão.' }
    seen.add(key)
    salarios.push({ unitId, salario: Math.round(salario * 100) / 100 })
  }
  return { salarios }
}

/** Substitui todos os salários do cargo pela lista informada. */
export function replaceSalarios(positionId: string, salarios: SalaryInput[]) {
  return prisma.$transaction([
    prisma.positionSalary.deleteMany({ where: { positionId } }),
    prisma.positionSalary.createMany({ data: salarios.map((s) => ({ positionId, unitId: s.unitId, salario: s.salario })) }),
  ])
}

/** Acrescenta salários de novas unidades a um cargo existente. Quem chama garante que essas unidades ainda não têm salário. */
export function mergeSalarios(positionId: string, salarios: SalaryInput[]) {
  return prisma.positionSalary.createMany({ data: salarios.map((s) => ({ positionId, unitId: s.unitId, salario: s.salario })) })
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
  salarios: { select: { id: true, unitId: true, salario: true, unit: { select: { name: true } } } },
  _count: { select: { vagas: true } },
}
