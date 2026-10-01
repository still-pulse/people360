const PARTICLES = new Set(['da', 'das', 'de', 'do', 'dos', 'e'])

function nameParts(value: string) {
  return value.trim().replace(/\s+/g, ' ').split(' ').filter(Boolean)
}

export function splitBadgeName(value: string) {
  const parts = nameParts(value)
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: '' }
  const lastIndex = [...parts].map((part) => part.toLocaleLowerCase('pt-BR')).findLastIndex((part) => !PARTICLES.has(part))
  const lastName = parts[lastIndex] || parts[parts.length - 1]
  const meaningfulBefore = parts.slice(0, Math.max(1, lastIndex)).filter((part) => !PARTICLES.has(part.toLocaleLowerCase('pt-BR')))
  const firstName = meaningfulBefore.length >= 2 && parts.length >= 4
    ? `${meaningfulBefore[0]} ${meaningfulBefore[1]}`
    : meaningfulBefore[0] || parts[0]
  return { firstName, lastName }
}

/** No verso, minimiza o nome para primeiro + último sobrenome. */
export function badgeBackName(value: string) {
  const parts = nameParts(value)
  if (parts.length <= 1) return parts[0] || ''
  const last = [...parts].reverse().find((part) => !PARTICLES.has(part.toLocaleLowerCase('pt-BR'))) || parts[parts.length - 1]
  return last === parts[0] ? parts[0] : `${parts[0]} ${last}`
}

/** Separa setor e unidade em até duas linhas semanticamente estáveis. */
export function badgeDepartmentLines(value: string) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  if (!normalized) return []
  const segments = normalized.split(/\s+-\s+/).filter(Boolean)
  if (segments.length >= 3) return [segments.slice(0, 2).join(' - '), segments.slice(2).join(' - ')]
  if (segments.length === 2) return segments
  if (normalized.length <= 30) return [normalized]
  const words = normalized.split(' ')
  let best = 1
  let difference = Number.POSITIVE_INFINITY
  for (let index = 1; index < words.length; index++) {
    const current = Math.abs(words.slice(0, index).join(' ').length - words.slice(index).join(' ').length)
    if (current < difference) { difference = current; best = index }
  }
  return [words.slice(0, best).join(' '), words.slice(best).join(' ')]
}

/** CPF e RG são dados pessoais desnecessários no crachá; somente registros profissionais permanecem. */
export function printableBadgeDocument(value: string | null | undefined) {
  const normalized = String(value || '').trim()
  if (/^(CPF|RG)(?:\b|\s|[:/-])/i.test(normalized)) return ''
  return /[A-Za-zÀ-ÖØ-öø-ÿ]/.test(normalized) ? normalized : ''
}
