import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { trainingApiConfigured, fetchTrainingHistorico } from '@/lib/trainingApi'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!trainingApiConfigured()) {
    return NextResponse.json({ configured: false })
  }

  const { searchParams } = new URL(req.url)
  const meses     = parseInt(searchParams.get('meses') ?? '6')
  const unidadeId = searchParams.get('unidadeId') ?? undefined

  const data = await fetchTrainingHistorico(meses, unidadeId)
  if (!data) {
    return NextResponse.json(
      { configured: true, error: 'Falha ao conectar com a API de treinamentos' },
      { status: 502 }
    )
  }

  return NextResponse.json({ configured: true, ...data })
}
