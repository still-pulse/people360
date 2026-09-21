import { NextRequest, NextResponse } from 'next/server'
import { dossieRoute } from '@/lib/dossie/http'
import { loadColaboradorPhoto } from '@/lib/dossie/photo'

/** Foto do crachá do colaborador, servida por rota autenticada. 404 quando não houver (a tela mostra o placeholder). */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.view', params.id, async ({ colaborador }) => {
    const photo = await loadColaboradorPhoto(colaborador)
    if (!photo) return NextResponse.json({ error: 'Sem foto.' }, { status: 404 })
    return new NextResponse(new Uint8Array(photo.buffer), { headers: { 'Content-Type': photo.mime, 'Cache-Control': 'private, max-age=300', 'X-Content-Type-Options': 'nosniff' } })
  })
}
