// Valor por extenso em reais, no formato dos relatórios admissionais: "QUATRO MIL REAIS".

const UNIDADES = ['', 'UM', 'DOIS', 'TRÊS', 'QUATRO', 'CINCO', 'SEIS', 'SETE', 'OITO', 'NOVE', 'DEZ', 'ONZE', 'DOZE', 'TREZE', 'QUATORZE', 'QUINZE', 'DEZESSEIS', 'DEZESSETE', 'DEZOITO', 'DEZENOVE']
const DEZENAS = ['', '', 'VINTE', 'TRINTA', 'QUARENTA', 'CINQUENTA', 'SESSENTA', 'SETENTA', 'OITENTA', 'NOVENTA']
const CENTENAS = ['', 'CENTO', 'DUZENTOS', 'TREZENTOS', 'QUATROCENTOS', 'QUINHENTOS', 'SEISCENTOS', 'SETECENTOS', 'OITOCENTOS', 'NOVECENTOS']

/** 0 a 999 por extenso. */
function ate999(n: number): string {
  if (n === 0) return ''
  if (n === 100) return 'CEM'
  const c = Math.floor(n / 100), resto = n % 100
  const partes: string[] = []
  if (c) partes.push(CENTENAS[c])
  if (resto < 20) { if (resto) partes.push(UNIDADES[resto]) }
  else {
    const d = Math.floor(resto / 10), u = resto % 10
    partes.push(u ? `${DEZENAS[d]} E ${UNIDADES[u]}` : DEZENAS[d])
  }
  return partes.join(' E ')
}

function inteiroPorExtenso(n: number): string {
  if (n === 0) return 'ZERO'
  const milhoes = Math.floor(n / 1_000_000), milhares = Math.floor((n % 1_000_000) / 1000), resto = n % 1000
  const grupos: string[] = []
  if (milhoes) grupos.push(milhoes === 1 ? 'UM MILHÃO' : `${ate999(milhoes)} MILHÕES`)
  if (milhares) grupos.push(milhares === 1 ? 'MIL' : `${ate999(milhares)} MIL`)
  if (resto) grupos.push(ate999(resto))
  if (grupos.length === 1) return grupos[0]
  // "E" só antes do último grupo quando ele é menor que 100 ou uma centena exata (ex.: MIL E DUZENTOS).
  const ultimo = grupos.pop()!
  const usaE = resto > 0 && (resto < 100 || resto % 100 === 0)
  return `${grupos.join(' ')}${usaE ? ' E ' : ' '}${ultimo}`
}

export function reaisPorExtenso(valor: number): string {
  const centavosTotais = Math.round(valor * 100)
  const reais = Math.floor(centavosTotais / 100), centavos = centavosTotais % 100
  const partes: string[] = []
  if (reais) {
    const texto = inteiroPorExtenso(reais)
    const de = reais % 1_000_000 === 0 ? ' DE' : ''
    partes.push(`${texto}${de} ${reais === 1 ? 'REAL' : 'REAIS'}`)
  }
  if (centavos) partes.push(`${ate999(centavos)} ${centavos === 1 ? 'CENTAVO' : 'CENTAVOS'}`)
  return partes.join(' E ') || 'ZERO REAIS'
}
