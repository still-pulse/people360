// Horários e carga FIXOS da contratação (definidos pelo RH, não digitados).
// Cargos, departamentos e salários vêm do cadastro de cargos (Administração → Cargos), com salário por unidade.
// Módulo sem dependências: usado pelo formulário (cliente) e pela validação da API (servidor).

export const ADMISSION_SCHEDULES = ['07h00 às 19h00', '19h00 às 07h00'] as const
export const ADMISSION_BREAKS = ['12h00 às 13h00', '20h00 às 21h00'] as const
export const ADMISSION_MONTHLY_HOURS_OPTIONS = [120, 150, 180, 200, 220] as const
export const ADMISSION_MONTHLY_HOURS = 180
export const ADMISSION_DEFAULT_HAZARD_PAY = 20

export type AdmissionPosition = { id: string; name: string; departamento: string | null; salarios: { unitId: string | null; cargaHorariaMensal?: number | null; salario: number }[] }

export const normalizeCargo = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function findPosition<T extends { name: string }>(positions: T[], cargo?: string | null): T | null {
  if (!cargo) return null
  const key = normalizeCargo(cargo)
  return positions.find((p) => normalizeCargo(p.name) === key) ?? null
}

/**
 * Salário do cargo para a unidade e a carga horária mensal. Ordem de preferência:
 * unidade + carga exata → unidade (qualquer carga) → padrão + carga exata → padrão (qualquer carga).
 * Sem carga informada, só valem os salários de "qualquer carga".
 */
export function salaryForUnit(position: Pick<AdmissionPosition, 'salarios'> | null | undefined, unitId?: string | null, monthlyHours?: number | null): number | null {
  if (!position) return null
  const find = (unit: string | null, hours: number | null) => position.salarios.find((s) => s.unitId === unit && (s.cargaHorariaMensal ?? null) === hours)
  const hours = monthlyHours ?? null
  const candidates = [
    unitId && hours !== null ? find(unitId, hours) : undefined,
    unitId ? find(unitId, null) : undefined,
    hours !== null ? find(null, hours) : undefined,
    find(null, null),
  ]
  return candidates.find(Boolean)?.salario ?? null
}

/** Cargo tem algum salário (de qualquer carga) que atende a unidade: usado para listar os cargos da unidade. */
export function hasSalaryForUnit(position: Pick<AdmissionPosition, 'salarios'>, unitId?: string | null) {
  return position.salarios.some((s) => s.unitId === null || s.unitId === unitId)
}

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
