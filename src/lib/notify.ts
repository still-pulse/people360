import { prisma } from './prisma'
import { sendEmail, emailTemplate, appUrl } from './email'
import { sendSlackNotification } from './slack'

interface NotifyPayload {
  type: 'TASK' | 'CALENDAR' | 'VAGA'
  title: string
  body?: string
  href: string
}

const CTA_LABELS: Record<NotifyPayload['type'], string> = {
  TASK: 'Ver detalhes',
  CALENDAR: 'Ver no calendário',
  VAGA: 'Ver vaga',
}

async function sendEmailsToUsers(userIds: string[], payload: NotifyPayload) {
  // VAGA: e-mails são consolidados no digest diário das 18h (cron.ts)
  if (payload.type === 'VAGA') return
  if (userIds.length === 0) return

  const users = await prisma.user.findMany({
    where: { id: { in: userIds }, active: true },
    select: { email: true },
  })
  if (users.length === 0) return

  const html = emailTemplate({
    title: payload.title,
    body: payload.body,
    ctaLabel: CTA_LABELS[payload.type],
    ctaUrl: appUrl(payload.href),
  })

  for (const user of users) {
    await sendEmail({ to: user.email, subject: payload.title, html })
  }
}

// Cria notificações para os usuários indicados (deduplicado, ignora o criador) e envia e-mail
export async function notifyUsers(
  userIds: (string | null | undefined)[],
  payload: NotifyPayload,
  creatorId?: string,
) {
  const seen = new Set<string>()
  const ids: string[] = []
  for (const id of userIds) {
    if (id && id !== creatorId && !seen.has(id)) { seen.add(id); ids.push(id) }
  }
  if (ids.length === 0) return

  await prisma.notification.createMany({
    data: ids.map((userId) => ({ userId, ...payload })),
    skipDuplicates: true,
  })

  await sendEmailsToUsers(ids, payload)

  if (payload.type !== 'VAGA') {
    sendSlackNotification(payload.title, payload.body ?? '', appUrl(payload.href)).catch(() => {})
  }
}

// Notifica todos os usuários de uma unidade (exceto criador) — considera unidade principal e unidades adicionais (UserUnit)
export async function notifyUnit(
  unitId: string | null | undefined,
  payload: NotifyPayload,
  creatorId?: string,
) {
  if (!unitId) {
    // Sem unidade: notifica todos
    const users = await prisma.user.findMany({ where: { active: true }, select: { id: true } })
    await notifyUsers(users.map((u) => u.id), payload, creatorId)
    return
  }
  const users = await prisma.user.findMany({
    where: {
      active: true,
      OR: [
        { unitId },
        { managedUnits: { some: { unitId } } },
      ],
    },
    select: { id: true },
  })
  await notifyUsers(users.map((u) => u.id), payload, creatorId)
}

// Notifica todos os admins (exceto criador)
export async function notifyAdmins(payload: NotifyPayload, creatorId?: string) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { id: true },
  })
  await notifyUsers(admins.map((u) => u.id), payload, creatorId)
}
