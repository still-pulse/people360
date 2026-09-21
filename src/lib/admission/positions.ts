// Cargos, salários e horários FIXOS da contratação (definidos pelo RH, não digitados).
// Módulo sem dependências: usado pelo formulário (cliente) e pela validação da API (servidor).
// Para incluir um novo cargo, basta acrescentar uma linha em ADMISSION_POSITIONS.

export const ADMISSION_POSITIONS = [
  { cargo: 'Enfermeiro', departamento: 'Enfermagem', salario: 3886.36 },
  { cargo: 'Técnico de Enfermagem', departamento: 'Enfermagem', salario: 2720.45 },
] as const

export const ADMISSION_DEPARTMENTS: string[] = Array.from(new Set(ADMISSION_POSITIONS.map((p) => p.departamento as string)))
export const ADMISSION_SCHEDULES = ['07h00 às 19h00', '19h00 às 07h00'] as const
export const ADMISSION_MONTHLY_HOURS = 180
export const ADMISSION_DEFAULT_HAZARD_PAY = 20

const normalize = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

export function findPosition(cargo?: string | null) {
  if (!cargo) return null
  return ADMISSION_POSITIONS.find((p) => normalize(p.cargo) === normalize(cargo)) ?? null
}

export function formatBRL(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
