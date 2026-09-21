import { NextRequest, NextResponse } from 'next/server'
import { getAdmissionByPublicToken } from '@/lib/admission/service'
import { checkPublicDocLinkRateLimit } from '@/lib/rateLimit'
import { extractIp } from '@/lib/audit'

type ViaCepResponse = {
  erro?: boolean | 'true'
  logradouro?: string
  complemento?: string
  bairro?: string
  localidade?: string
  uf?: string
}

export async function GET(
  req: NextRequest,
  props: { params: Promise<{ token: string; cep: string }> }
) {
  const params = await props.params;
  const rateKey = `${extractIp(req.headers) || 'unknown'}:cep:${params.token.slice(-8)}`
  if (!checkPublicDocLinkRateLimit(rateKey).allowed) {
    return NextResponse.json({ error: 'Muitas consultas de CEP. Aguarde alguns minutos.' }, { status: 429 })
  }

  const admissionToken = await getAdmissionByPublicToken(params.token)
  if (!admissionToken) return NextResponse.json({ error: 'Link inválido ou expirado.' }, { status: 404 })

  const cep = params.cep.replace(/\D/g, '')
  if (!/^\d{8}$/.test(cep)) return NextResponse.json({ error: 'Informe um CEP válido.' }, { status: 400 })

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    })
    if (!response.ok) throw new Error(`VIACEP_HTTP_${response.status}`)
    const address = await response.json() as ViaCepResponse
    if (address.erro === true || address.erro === 'true') {
      return NextResponse.json({ error: 'CEP não encontrado.' }, { status: 404 })
    }

    return NextResponse.json({
      street: address.logradouro || '',
      complement: address.complemento || '',
      district: address.bairro || '',
      city: address.localidade || '',
      state: address.uf || '',
    })
  } catch {
    return NextResponse.json({ error: 'Não foi possível consultar o CEP agora. Preencha o endereço manualmente.' }, { status: 502 })
  }
}
