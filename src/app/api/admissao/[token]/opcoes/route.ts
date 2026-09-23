import { NextRequest, NextResponse } from 'next/server'
import { getAdmissionByPublicToken } from '@/lib/admission/service'

type IbgeMunicipality = {
  nome?: string
  microrregiao?: { mesorregiao?: { UF?: { sigla?: string } } }
  'regiao-imediata'?: { 'regiao-intermediaria'?: { UF?: { sigla?: string } } }
}
type BrasilApiBank = { code?: number | null; ispb?: string; name?: string; fullName?: string }

const fallbackBanks = [
  '001 - Banco do Brasil S.A.', '033 - Banco Santander (Brasil) S.A.', '077 - Banco Inter S.A.',
  '104 - Caixa Econômica Federal', '212 - Banco Original S.A.', '237 - Banco Bradesco S.A.',
  '260 - Nu Pagamentos S.A. (Nubank)', '290 - PagSeguro Internet Instituição de Pagamento S.A.',
  '323 - Mercado Pago Instituição de Pagamento Ltda.', '336 - Banco C6 S.A.', '341 - Itaú Unibanco S.A.',
  '422 - Banco Safra S.A.', '655 - Banco Votorantim S.A.', '756 - Banco Cooperativo Sicoob S.A.',
]

async function municipalities() {
  const response = await fetch('https://servicodados.ibge.gov.br/api/v1/localidades/municipios?orderBy=nome', {
    signal: AbortSignal.timeout(12000), next: { revalidate: 604800 },
  })
  if (!response.ok) throw new Error('IBGE indisponível')
  const items = await response.json() as IbgeMunicipality[]
  return items.flatMap((item) => {
    const state = item.microrregiao?.mesorregiao?.UF?.sigla || item['regiao-imediata']?.['regiao-intermediaria']?.UF?.sigla
    return item.nome && state ? [`${item.nome} - ${state}`] : []
  })
}

async function banks() {
  const response = await fetch('https://brasilapi.com.br/api/banks/v1', {
    signal: AbortSignal.timeout(12000), next: { revalidate: 86400 },
  })
  if (!response.ok) throw new Error('Catálogo bancário indisponível')
  const items = await response.json() as BrasilApiBank[]
  return items.flatMap((item) => {
    const name = item.fullName || item.name
    if (!name) return []
    const identifier = item.code != null ? String(item.code).padStart(3, '0') : item.ispb
    return [identifier ? `${identifier} - ${name}` : name]
  }).sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export async function GET(_: NextRequest, props: { params: Promise<{ token: string }> }) {
  const params = await props.params
  if (!await getAdmissionByPublicToken(params.token)) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })
  const [cityResult, bankResult] = await Promise.allSettled([municipalities(), banks()])
  return NextResponse.json({
    municipalities: cityResult.status === 'fulfilled' ? cityResult.value : [],
    banks: bankResult.status === 'fulfilled' ? bankResult.value : fallbackBanks,
  }, { headers: { 'Cache-Control': 'private, max-age=3600' } })
}
