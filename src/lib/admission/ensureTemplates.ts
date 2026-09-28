import { prisma } from '@/lib/prisma'
import { ADMISSION_TEMPLATE_DEFAULTS } from './templateDefaults'
import { ADMISSION_LAYOUTS, layoutTemplateContent } from './forms'

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
  // Contrato e termos oficiais vêm dos formulários (layouts); os demais continuam como texto.
  const layouts = ADMISSION_LAYOUTS.map((layout) => ({ key: layout.key, name: layout.name, version: layout.version, content: layoutTemplateContent(layout) }))
  const layoutKeys = new Set(layouts.map((layout) => layout.key))
  for (const template of [...ADMISSION_TEMPLATE_DEFAULTS.filter((item) => !layoutKeys.has(item.key)), ...layouts]) {
    const exists = await prisma.documentTemplate.findUnique({ where: { key_version: { key: template.key, version: template.version } } })
    if (!exists) {
      await prisma.documentTemplate.create({ data: { key: template.key, version: template.version, name: template.name, content: template.content, variables: variablesOf(template.content), active: true } })
    }
    await prisma.documentTemplate.updateMany({ where: { key: template.key, version: { lt: template.version }, active: true }, data: { active: false } })
  }
  ensured = true
}
