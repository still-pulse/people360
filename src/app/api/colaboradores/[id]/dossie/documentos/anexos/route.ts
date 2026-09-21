import { NextRequest, NextResponse } from 'next/server'
import { createAnexo, DossieError } from '@/lib/dossie/documentos'
import { dossieRoute } from '@/lib/dossie/http'
import { DOSSIE_FILE_MAX_SIZE } from '@/lib/dossie/storage'

/** Upload de anexos: valida tamanho, formato real (PDF/JPG/PNG por magic bytes) e categoria. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  return dossieRoute(req, 'employee.documents.create', params.id, async ({ colaborador, actor, ip }) => {
    const form = await req.formData().catch(() => null)
    const file = form?.get('arquivo')
    if (!form || !(file instanceof File)) throw new DossieError('Selecione um arquivo.', 400)
    if (file.size <= 0) throw new DossieError('Arquivo vazio.', 422)
    if (file.size > DOSSIE_FILE_MAX_SIZE) throw new DossieError(`O arquivo excede o limite de ${Math.round(DOSSIE_FILE_MAX_SIZE / 1024 / 1024)} MB.`, 413)
    const document = await createAnexo({
      colaboradorId: colaborador.id, buffer: Buffer.from(await file.arrayBuffer()), originalName: file.name,
      categoria: String(form.get('categoria') || ''), titulo: String(form.get('titulo') || '') || undefined, observacao: String(form.get('observacao') || '') || undefined,
      actor, ip,
    })
    return NextResponse.json({ id: document.id, titulo: document.titulo }, { status: 201 })
  })
}
