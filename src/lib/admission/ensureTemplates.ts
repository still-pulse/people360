import { prisma } from '@/lib/prisma'
import { ADMISSION_TEMPLATE_DEFAULTS } from './templateDefaults'

let ensured = false

function variablesOf(content: string) {
  return Array.from(new Set(Array.from(content.matchAll(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g)).map((m) => m[1])))
}

/**
 * Garante no banco as versões atuais dos templates da admissão (idempotente, roda uma vez por processo)
 * e desativa as versões anteriores da mesma chave. Documentos já gerados não são afetados.
 */
export async function ensureAdmissionTemplates() {
  if (ensured) return
  for (const template of ADMISSION_TEMPLATE_DEFAULTS) {
    const exists = await prisma.documentTemplate.findUnique({ where: { key_version: { key: template.key, version: template.version } } })
    if (!exists) {
      await prisma.documentTemplate.create({ data: { key: template.key, version: template.version, name: template.name, content: template.content, variables: variablesOf(template.content), active: true } })
    }
    await prisma.documentTemplate.updateMany({ where: { key: template.key, version: { lt: template.version }, active: true }, data: { active: false } })
  }
  ensured = true
}
