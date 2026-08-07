import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { trainingApiConfigured, fetchTrainingSummary } from '@/lib/trainingApi'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!trainingApiConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const { searchParams } = new URL(req.url)
  const ano       = parseInt(searchParams.get('ano') ?? String(new Date().getFullYear()))
  const mes       = searchParams.get('mes') ? parseInt(searchParams.get('mes')!) : undefined
  const unidadeId = searchParams.get('unidadeId') ?? undefined

  const data = await fetchTrainingSummary(ano, mes, unidadeId)
  if (!data) {
    return NextResponse.json(
      { configured: true, error: 'Falha ao conectar com a API de treinamentos' },
      { status: 502 }
    )
  }

  return NextResponse.json({ configured: true, ...data })
}
