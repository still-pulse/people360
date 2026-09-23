type Unit = { id: string; name: string }

function normalize(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim().replace(/\s+/g, ' ')
}

// Nomes equivalentes usados no cadastro de locais do ERPNext.
const aliases: Record<string, string> = {
  'sede - alphaville barueri': 'nucleo alphaville',
  'psi rene': 'psi rene aprigio',
}

export function resolveEmployeeUnit(units: Unit[], company?: string | null, branch?: string | null): Unit | null {
  const match = (raw: string): Unit | null => {
    const key = aliases[normalize(raw)] || normalize(raw)
    const matches = units.filter(unit => {
      const name = normalize(unit.name)
      const withoutCity = name.replace(/^[a-z]{2,3} - /, '')
      return name === key || withoutCity === key
    })
    return matches.length === 1 ? matches[0] : null
  }
  // Local de trabalho prevalece sobre a empresa empregadora.
  if (branch?.trim()) return match(branch)
  return company?.trim() ? match(company.split(' - ')[0]) : null
}
