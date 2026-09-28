import { readFile } from 'fs/promises'
import path from 'path'
import { prisma } from '@/lib/prisma'
import { imageSize, type Logo, type SheetPosition, type SheetUnit } from '@/lib/positionSheet'

export async function loadSheetData(): Promise<{ positions: SheetPosition[]; units: SheetUnit[] }> {
  const [positions, units] = await Promise.all([
    prisma.position.findMany({
      orderBy: { name: 'asc' },
      include: { aliases: { orderBy: { alias: 'asc' } }, salarios: { select: { id: true, unitId: true, salario: true } } },
    }),
    prisma.unit.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, color: true, active: true } }),
  ])
  return {
    positions: positions.map((position) => ({
      id: position.id, name: position.name, categoria: position.categoria, departamento: position.departamento,
      codigoInterno: position.codigoInterno, active: position.active,
      aliases: position.aliases.map((alias) => alias.alias), salarios: position.salarios,
    })),
    units,
  }
}

/** Logo configurado em Configurações (PNG/JPEG); sem ele, o logo da BHCL em public/. */
export async function loadSheetMeta(userName: string) {
  const rows = await prisma.systemSettings.findMany({ where: { key: { in: ['logoFileName', 'companyName'] } } })
  const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]))
  const candidates = [
    settings.logoFileName ? path.join(process.cwd(), 'public', 'uploads', 'logos', path.basename(settings.logoFileName)) : null,
    path.join(process.cwd(), 'public', 'bhcl-admissao-logo.png'),
  ].filter((file): file is string => !!file)
  let logo: Logo | null = null
  for (const file of candidates) {
    const buffer = await readFile(file).catch(() => null)
    const size = buffer && imageSize(buffer)
    if (buffer && size) { logo = { buffer, ...size }; break }
  }
  return { companyName: settings.companyName || 'BHCL', userName, logo }
}
