// Horários e carga FIXOS da contratação (definidos pelo RH, não digitados).
// Cargos, departamentos e salários vêm do cadastro de cargos (Administração → Cargos), com salário por unidade.
// Módulo sem dependências: usado pelo formulário (cliente) e pela validação da API (servidor).

export const ADMISSION_SCHEDULES = ['07h00 às 19h00', '19h00 às 07h00'] as const
export const ADMISSION_BREAKS = ['12h00 às 13h00', '20h00 às 21h00'] as const
export const ADMISSION_MONTHLY_HOURS_OPTIONS = [120, 150, 180, 200, 220] as const
export const ADMISSION_MONTHLY_HOURS = 180
export const ADMISSION_DEFAULT_HAZARD_PAY = 20

export type AdmissionPosition = { id: string; name: string; departamento: string | null; salarios: { unitId: string | null; salario: number }[] }

export const normalizeCargo = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function findPosition<T extends { name: string }>(positions: T[], cargo?: string | null): T | null {
  if (!cargo) return null
  const key = normalizeCargo(cargo)
  return positions.find((p) => normalizeCargo(p.name) === key) ?? null
}

/** Salário da unidade; se ela não tiver valor próprio, usa o padrão (unitId nulo). */
export function salaryForUnit(position: Pick<AdmissionPosition, 'salarios'> | null | undefined, unitId?: string | null): number | null {
  if (!position) return null
  const own = unitId ? position.salarios.find((s) => s.unitId === unitId) : undefined
  return (own ?? position.salarios.find((s) => s.unitId === null))?.salario ?? null
}

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
