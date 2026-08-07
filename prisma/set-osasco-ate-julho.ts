/**
 * Configura unidades OSC (Osasco) para sumirem do indicador a partir de ago/2026.
 * Histórico até jul/2026 permanece visível. Evidências não são afetadas.
 *
 * Uso:
 *   npx tsx prisma/set-osasco-ate-julho.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const result = await prisma.unit.updateMany({
    where: {
      OR: [
        { name: { startsWith: 'OSC' } },
        { name: { contains: 'Osasco' } },
      ],
    },
    data: {
      exibirIndicadores: true,
      indicadoresAteYear: 2026,
      indicadoresAteMonth: 7,
    },
  })

  const units = await prisma.unit.findMany({
    where: {
      OR: [
        { name: { startsWith: 'OSC' } },
        { name: { contains: 'Osasco' } },
      ],
    },
    select: {
      name: true,
      exibirIndicadores: true,
      indicadoresAteYear: true,
      indicadoresAteMonth: true,
    },
  })

  console.log(`Atualizadas ${result.count} unidade(s):`)
  for (const u of units) {
    console.log(
      `  - ${u.name} → indicadores até ${u.indicadoresAteMonth}/${u.indicadoresAteYear}`
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
