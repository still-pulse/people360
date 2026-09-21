import { prisma } from '@/lib/prisma'
import {
  AUTOAVALIACAO_MODELO_DEFAULT, AUTOAVALIACAO_MODELO_KEY, AVALIACAO_MODELO_DEFAULT, AVALIACAO_MODELO_KEY,
  TEMPLATE_DEFAULTS, type AutoavaliacaoModelo, type AvaliacaoModelo,
} from './templateDefaults'

export type LoadedTemplate = { key: string; name: string; version: number; content: string }

function variablesOf(content: string) {
  return Array.from(new Set(Array.from(content.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)).map((m) => m[1])))
}

const DEFAULTS = new Map<string, { name: string; content: string }>([
  ...TEMPLATE_DEFAULTS.map((t) => [t.key, { name: t.name, content: t.content }] as const),
  [AVALIACAO_MODELO_KEY, { name: 'Modelo de Avaliação do Período de Experiência', content: JSON.stringify(AVALIACAO_MODELO_DEFAULT) }],
  [AUTOAVALIACAO_MODELO_KEY, { name: 'Modelo de Autoavaliação do Colaborador', content: JSON.stringify(AUTOAVALIACAO_MODELO_DEFAULT) }],
])

/**
 * Devolve a versão ativa mais recente do template. Se ainda não existir no banco, cria a
 * versão 1 a partir do padrão (nunca sobrescreve um template já existente/editado).
 */
export async function getTemplate(key: string): Promise<LoadedTemplate> {
  const found = await prisma.documentTemplate.findFirst({ where: { key, active: true }, orderBy: { version: 'desc' } })
  if (found) return { key: found.key, name: found.name, version: found.version, content: found.content }
  const fallback = DEFAULTS.get(key)
  if (!fallback) throw new Error(`Template não encontrado: ${key}`)
  const created = await prisma.documentTemplate.upsert({
    where: { key_version: { key, version: 1 } },
    update: {},
    create: { key, version: 1, name: fallback.name, content: fallback.content, variables: variablesOf(fallback.content), active: true },
  })
  return { key: created.key, name: created.name, version: created.version, content: created.content }
}

function parseModelo<T>(template: LoadedTemplate, fallback: T): { modelo: T; version: number } {
  try { return { modelo: JSON.parse(template.content) as T, version: template.version } }
  catch { return { modelo: fallback, version: template.version } }
}

export async function getAvaliacaoModelo() {
  return parseModelo<AvaliacaoModelo>(await getTemplate(AVALIACAO_MODELO_KEY), AVALIACAO_MODELO_DEFAULT)
}

export async function getAutoavaliacaoModelo() {
  return parseModelo<AutoavaliacaoModelo>(await getTemplate(AUTOAVALIACAO_MODELO_KEY), AUTOAVALIACAO_MODELO_DEFAULT)
}

/** Templates extras cadastrados no banco (ex.: `colab_termo_uniforme`) aparecem automaticamente em "Novo Documento". */
export async function listCustomTemplates() {
  const rows = await prisma.documentTemplate.findMany({
    where: { active: true, key: { startsWith: 'colab_' }, NOT: { key: { in: Array.from(DEFAULTS.keys()) } } },
    orderBy: [{ key: 'asc' }, { version: 'desc' }],
    distinct: ['key'],
  })
  return rows.map((row) => ({ key: row.key, name: row.name, version: row.version, content: row.content }))
}
