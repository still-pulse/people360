// O portal usa o padrão do IBGE ("Osasco - SP"); o doctype Municipios do ERPNext usa "São Paulo - Osasco".
const STATES: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará', DF: 'Distrito Federal',
  ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
}
const UF_BY_STATE = Object.fromEntries(Object.entries(STATES).map(([uf, state]) => [state, uf]))

/** "Osasco - SP" → "São Paulo - Osasco". Valores fora do padrão IBGE são devolvidos sem alteração. */
export function toErpnextMunicipio(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  const match = text.match(/^(.+) - ([A-Z]{2})$/)
  return match && STATES[match[2]] ? `${STATES[match[2]]} - ${match[1]}` : text
}

/** "São Paulo - Osasco" → "Osasco - SP". Valores fora do padrão do ERPNext são devolvidos sem alteração. */
export function fromErpnextMunicipio(value: string | null | undefined): string {
  const text = String(value ?? '').trim()
  const separator = text.indexOf(' - ')
  if (separator < 0) return text
  const uf = UF_BY_STATE[text.slice(0, separator)]
  return uf ? `${text.slice(separator + 3)} - ${uf}` : text
}
