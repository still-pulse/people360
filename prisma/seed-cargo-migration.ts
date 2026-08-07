/**
 * Migração: cargo texto livre → FK para Position
 *
 * Este script:
 * 1. Lê todos os valores distintos de `cargo` nas vagas
 * 2. Normaliza e agrupa variações do mesmo cargo
 * 3. Cria registros em `Position` (ou reutiliza os existentes)
 * 4. Cria `CargoAlias` para cada variação
 * 5. Atualiza `vaga.cargoId` para cada vaga
 *
 * Execute com: npx tsx prisma/seed-cargo-migration.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/\(a\)/g, '')      // remove (a)
    .replace(/[^a-z0-9\s]/g, '') // remove pontuação
    .replace(/\s+/g, ' ')
    .trim()
}

async function main() {
  console.log('🔍 Lendo valores distintos de cargo nas vagas...')

  const vagas = await prisma.vaga.findMany({
    select: { id: true, cargo: true, cargoId: true },
  })

  // Agrupa variações pelo texto normalizado
  const grupos = new Map<string, { original: string; count: number; ids: string[] }>()

  for (const vaga of vagas) {
    if (!vaga.cargo?.trim()) continue
    const chave = normalizar(vaga.cargo)
    if (!grupos.has(chave)) {
      grupos.set(chave, { original: vaga.cargo.trim(), count: 0, ids: [] })
    }
    const g = grupos.get(chave)!
    g.count++
    g.ids.push(vaga.id)
    // Prefere a variação mais comum (mais curta e capitalizada)
    if (vaga.cargo.trim().length < g.original.length) {
      g.original = vaga.cargo.trim()
    }
  }

  console.log(`📦 ${grupos.size} grupos de cargo encontrados (de ${vagas.length} vagas)\n`)

  // Lista para revisão
  for (const [chave, grupo] of grupos.entries()) {
    const variacoes = vagas
      .filter((v) => normalizar(v.cargo) === chave)
      .map((v) => v.cargo.trim())
    const unicas = [...new Set(variacoes)]
    if (unicas.length > 1) {
      console.log(`  ⚠️  "${grupo.original}" (${grupo.count} vagas) — ${unicas.length} variações:`)
      unicas.forEach((u) => console.log(`       - ${u}`))
    }
  }

  console.log('\n🔧 Criando registros de Position e CargoAlias...\n')

  for (const [chave, grupo] of grupos.entries()) {
    const variacoes = vagas
      .filter((v) => normalizar(v.cargo) === chave)
      .map((v) => v.cargo.trim())
    const unicas = [...new Set(variacoes)]

    // Escolhe o nome oficial: prefere o que já existe, senão o mais longo
    let nomeOficial = grupo.original
    const maiorVariacao = unicas.reduce((a, b) => a.length >= b.length ? a : b)
    if (maiorVariacao.length > nomeOficial.length) nomeOficial = maiorVariacao

    // Cria ou encontra a Position
    let position = await prisma.position.findFirst({
      where: { name: { equals: nomeOficial, mode: 'insensitive' } },
    })

    if (!position) {
      // Tenta encontrar por qualquer variação existente
      for (const variacao of unicas) {
        position = await prisma.position.findFirst({
          where: { name: { equals: variacao, mode: 'insensitive' } },
        })
        if (position) break
      }
    }

    if (!position) {
      position = await prisma.position.create({
        data: { name: nomeOficial },
      })
      console.log(`  ✅ Criado: "${nomeOficial}"`)
    } else {
      console.log(`  ♻️  Reutilizado: "${position.name}"`)
    }

    // Cria aliases para variações diferentes do nome oficial
    for (const variacao of unicas) {
      if (variacao.toLowerCase() === position.name.toLowerCase()) continue
      const aliasExiste = await prisma.cargoAlias.findFirst({
        where: { alias: variacao },
      })
      if (!aliasExiste) {
        await prisma.cargoAlias.create({
          data: { positionId: position.id, alias: variacao },
        })
      }
    }

    // Atualiza cargoId nas vagas
    await prisma.vaga.updateMany({
      where: { id: { in: grupo.ids } },
      data: { cargoId: position.id, cargo: position.name },
    })
  }

  // Relatório final
  const total = await prisma.vaga.count()
  const migradas = await prisma.vaga.count({ where: { cargoId: { not: null } } })
  const totalPositions = await prisma.position.count()
  const totalAliases = await prisma.cargoAlias.count()

  console.log('\n📊 Resultado da migração:')
  console.log(`  Vagas migradas: ${migradas}/${total}`)
  console.log(`  Cargos criados/usados: ${totalPositions}`)
  console.log(`  Aliases criados: ${totalAliases}`)
  console.log('\n✅ Migração concluída!')
}

main()
  .catch((e) => { console.error('❌ Erro na migração:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
