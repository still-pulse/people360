import { prisma } from '@/lib/prisma'
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
  // A pasta de formulários oficiais é a fonte única da admissão. Templates removidos do
  // catálogo deixam de ser gerados, mas o histórico e os documentos já assinados são preservados.
  const layouts = ADMISSION_LAYOUTS.map((layout) => ({ key: layout.key, name: layout.name, version: layout.version, content: layoutTemplateContent(layout) }))
  const layoutKeys = new Set(layouts.map((layout) => layout.key))
  await prisma.documentTemplate.updateMany({
    where: { active: true, AND: [{ key: { not: { startsWith: 'colab_' } } }, { key: { notIn: [...layoutKeys] } }] },
    data: { active: false },
  })
  for (const template of layouts) {
    const variables = variablesOf(template.content)
    await prisma.documentTemplate.upsert({
      where: { key_version: { key: template.key, version: template.version } },
      create: { ...template, variables, active: true },
      update: { name: template.name, content: template.content, variables, active: true },
    })
    await prisma.documentTemplate.updateMany({ where: { key: template.key, version: { not: template.version }, active: true }, data: { active: false } })
  }
  ensured = true
}
