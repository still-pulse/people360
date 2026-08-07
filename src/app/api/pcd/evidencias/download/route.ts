import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'
import JSZip from 'jszip'

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

// Abreviações curtas para manter paths dentro do limite de 260 chars do Windows
const MONTHS_SHORT = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

const CATEGORIA_LABELS: Record<string, string> = {
  DIVULGACAO_VAGA: 'Divulgacao_de_Vagas',
  CONTRATACAO: 'Contratacao_PCD',
  DIVULGACAO_INTERNA: 'Divulgacao_Interna',
  PARCERIA: 'Parcerias',
}

const CATEGORIA_SHORT: Record<string, string> = {
  DIVULGACAO_VAGA: 'Vagas',
  CONTRATACAO: 'Contratacao',
  DIVULGACAO_INTERNA: 'Interna',
  PARCERIA: 'Parcerias',
}

function sanitizeName(str: string, maxLen = 60): string {
  return str
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, maxLen)
    .replace(/_+$/, '')
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = req.nextUrl
  const categoria = searchParams.get('categoria')
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : undefined
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined
  const unitId = searchParams.get('unitId') || undefined

  if (!categoria) return NextResponse.json({ error: 'categoria obrigatória' }, { status: 400 })

  const where: Record<string, unknown> = { categoria }
  if (year) where.year = year
  if (month) where.month = month
  if (unitId) where.unitId = unitId

  const evidencias = await prisma.pcdEvidencia.findMany({
    where,
    include: {
      arquivos: { orderBy: { createdAt: 'asc' } },
      unit: { select: { name: true } },
      createdBy: { select: { name: true } },
    },
    orderBy: [{ year: 'asc' }, { month: 'asc' }, { createdAt: 'asc' }],
  })

  if (evidencias.length === 0) {
    return NextResponse.json({ error: 'Nenhuma evidência encontrada.' }, { status: 404 })
  }

  const zip = new JSZip()

  const catShort = CATEGORIA_SHORT[categoria] ?? sanitizeName(categoria, 12)
  const catLabel = CATEGORIA_LABELS[categoria] ?? sanitizeName(categoria)
  const yearLabel = year ? `_${year}` : ''
  const monthLabel = month ? `_${MONTHS_SHORT[month - 1]}` : ''
  // Root curto: PCD_Vagas_2026 (~15 chars)
  const rootFolder = zip.folder(`PCD_${catShort}${yearLabel}${monthLabel}`)!

  for (let i = 0; i < evidencias.length; i++) {
    const ev = evidencias[i]
    const monthShort = MONTHS_SHORT[ev.month - 1]
    const yearShort = String(ev.year).slice(2) // "26" em vez de "2026"
    const descSlug = ev.nomePCD
      ? sanitizeName(ev.nomePCD, 28)
      : ev.descricao
      ? sanitizeName(ev.descricao, 28)
      : 'sem_desc'

    // Pasta curta: 001_Jun26_Descricao_curta (~40 chars max)
    const folderName = `${String(i + 1).padStart(3, '0')}_${monthShort}${yearShort}_${descSlug}`
    const folder = rootFolder.folder(folderName)!

    // descricao.txt
    const monthName = MONTHS[ev.month - 1]
    const lines: string[] = [
      `Evidência PCD - ${CATEGORIA_LABELS[ev.categoria] ?? ev.categoria}`,
      `Período: ${monthName}/${ev.year}`,
    ]
    if (ev.unit) lines.push(`Unidade: ${ev.unit.name}`)
    if (ev.nomePCD) lines.push(`Colaborador PCD: ${ev.nomePCD}`)
    if (ev.descricao) lines.push(`\nDescrição:\n${ev.descricao}`)
    lines.push(`\nAdicionado por: ${ev.createdBy?.name ?? 'Desconhecido'}`)
    lines.push(`Data: ${new Date(ev.createdAt).toLocaleDateString('pt-BR')}`)
    folder.file('descricao.txt', lines.join('\n'))

    // arquivos físicos
    for (const arq of ev.arquivos) {
      try {
        const fileName = arq.url.split('/').pop()!
        const filePath = path.join(process.cwd(), 'public', 'uploads', 'pcd-evidencias', fileName)
        const buffer = await readFile(filePath)

        let zipName = arq.nome
        if (arq.tipoDoc === 'ficha_registro') zipName = `ficha_registro_${arq.nome}`
        else if (arq.tipoDoc === 'laudo_medico') zipName = `laudo_medico_${arq.nome}`

        folder.file(zipName, buffer)
      } catch {
        folder.file(`${arq.nome}.erro.txt`, `Arquivo não encontrado: ${arq.url}`)
      }
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })

  const zipName = `PCD_${catShort}${yearLabel}${monthLabel}.zip`

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${zipName}"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
