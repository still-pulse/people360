import cron from 'node-cron'
import { prisma } from './prisma'
import { sendEmail, digestEmailTemplate, appUrl, type DigestSection, type DigestItem } from './email'
import { sendSlackDigest, isSlackConfigured, type SlackDigestSection } from './slack'
import { formatDate } from './utils'

const CLOSED_VAGA_STATUSES = ['CONTRATADA', 'FECHADA', 'CANCELADA']
// São Paulo é sempre UTC-3 (Brasil aboliu horário de verão em 2019)
const SP_OFFSET_MS = -3 * 60 * 60 * 1000

// Retorna meia-noite de São Paulo como Date UTC
function startOfTodaySP(): Date {
  const spAsUtc = new Date(Date.now() + SP_OFFSET_MS)
  spAsUtc.setUTCHours(0, 0, 0, 0)
  return new Date(spAsUtc.getTime() - SP_OFFSET_MS)
}

function addDays(date: Date, days: number) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateLabel(date: Date): string {
  const sp = new Date(date.getTime() + SP_OFFSET_MS)
  const d = String(sp.getUTCDate()).padStart(2, '0')
  const m = String(sp.getUTCMonth() + 1).padStart(2, '0')
  const y = sp.getUTCFullYear()
  return `${d}/${m}/${y}`
}

interface DigestEntry {
  section: 'vagas_vencidas' | 'vagas_proximas' | 'tarefas_vencidas' | 'tarefas_proximas'
  label: string
  detail: string
  url: string
}

export async function sendDailyDigest() {
  const hoje = startOfTodaySP()
  const limiteVagas = addDays(hoje, 3)
  const limiteTarefas = addDays(hoje, 1)

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { email: true },
  })
  const adminEmails = admins.map((a) => a.email)

  const recipientMap = new Map<string, DigestEntry[]>()

  function addEntry(email: string, entry: DigestEntry) {
    if (!recipientMap.has(email)) recipientMap.set(email, [])
    recipientMap.get(email)!.push(entry)
  }

  // --- Vagas vencidas ou próximas do prazo ---
  const vagas = await prisma.vaga.findMany({
    where: {
      status: { notIn: CLOSED_VAGA_STATUSES as any },
      dataPrevistaFechamento: { not: null, lte: limiteVagas },
    },
    include: {
      analistas: { select: { email: true } },
      unit: { select: { name: true } },
    },
  })

  for (const vaga of vagas) {
    const prazo = vaga.dataPrevistaFechamento!
    const vencida = prazo < hoje
    const section = vencida ? 'vagas_vencidas' : 'vagas_proximas'
    const entry: DigestEntry = {
      section,
      label: vaga.cargo,
      detail: `${vaga.unit ? vaga.unit.name + ' — ' : ''}Prazo: ${formatDate(prazo)}`,
      url: appUrl(`/vagas/${vaga.id}`),
    }

    for (const email of adminEmails) addEntry(email, entry)
    for (const a of (vaga as any).analistas ?? []) if (a.email) addEntry(a.email, entry)
  }

  // --- Tarefas vencidas ou próximas do prazo ---
  const tarefas = await prisma.task.findMany({
    where: {
      status: { not: 'DONE' },
      dueDate: { not: null, lte: limiteTarefas },
    },
    include: {
      responsibles: { include: { user: { select: { email: true } } } },
    },
  })

  for (const tarefa of tarefas) {
    const prazo = tarefa.dueDate!
    const vencida = prazo < hoje
    const section = vencida ? 'tarefas_vencidas' : 'tarefas_proximas'
    const entry: DigestEntry = {
      section,
      label: tarefa.title,
      detail: `Prazo: ${formatDate(prazo)}`,
      url: appUrl(`/tarefas?taskId=${tarefa.id}`),
    }

    for (const email of adminEmails) addEntry(email, entry)
    tarefa.responsibles.forEach((r) => addEntry(r.user.email, entry))
  }

  // --- Envia um e-mail por destinatário ---
  const dateLabel = formatDateLabel(hoje)

  const emails = Array.from(recipientMap.keys())
  for (const email of emails) {
    const entries = recipientMap.get(email)!
    const sections: DigestSection[] = [
      { title: 'Vagas com prazo vencido', color: '#DC2626', items: entries.filter((e: DigestEntry) => e.section === 'vagas_vencidas') },
      { title: 'Vagas próximas do prazo', color: '#F59E0B', items: entries.filter((e: DigestEntry) => e.section === 'vagas_proximas') },
      { title: 'Tarefas com prazo vencido', color: '#DC2626', items: entries.filter((e: DigestEntry) => e.section === 'tarefas_vencidas') },
      { title: 'Tarefas próximas do prazo', color: '#F59E0B', items: entries.filter((e: DigestEntry) => e.section === 'tarefas_proximas') },
    ].filter((s) => s.items.length > 0)

    const html = digestEmailTemplate(sections, dateLabel)
    const total = entries.length
    const subject = `Resumo diário: ${total} ${total === 1 ? 'pendência' : 'pendências'} — People 360`

    await sendEmail({ to: email, subject, html })
  }

  console.log(`[cron] Digest diário enviado para ${recipientMap.size} destinatário(s).`)

  // Slack: envia resumo consolidado no canal
  const allEntries = Array.from(recipientMap.values()).flat()
  const slackSections: SlackDigestSection[] = [
    { title: 'Vagas com prazo vencido', emoji: ':red_circle:', items: allEntries.filter((e) => e.section === 'vagas_vencidas') },
    { title: 'Vagas próximas do prazo', emoji: ':warning:', items: allEntries.filter((e) => e.section === 'vagas_proximas') },
    { title: 'Tarefas com prazo vencido', emoji: ':red_circle:', items: allEntries.filter((e) => e.section === 'tarefas_vencidas') },
    { title: 'Tarefas próximas do prazo', emoji: ':warning:', items: allEntries.filter((e) => e.section === 'tarefas_proximas') },
  ]
  const uniqueSlackItems = new Map<string, SlackDigestSection>()
  for (const s of slackSections) {
    const deduped = s.items.filter((item) => {
      const key = `${s.title}:${item.url}`
      if (uniqueSlackItems.has(key)) return false
      uniqueSlackItems.set(key, s)
      return true
    })
    s.items = deduped
  }
  sendSlackDigest(slackSections, dateLabel).catch((err) => console.error('[cron] erro ao enviar digest Slack:', err))
}

export async function sendNewVagasDigest() {
  const hoje = startOfTodaySP()
  const amanha = addDays(hoje, 1)

  const vagas = await prisma.vaga.findMany({
    where: { dataAbertura: { gte: hoje, lt: amanha } },
    include: {
      analistas: { select: { email: true } },
      unit: { select: { name: true } },
    },
    orderBy: { dataAbertura: 'asc' },
  })

  if (vagas.length === 0) {
    console.log(`[cron] Nenhuma vaga aberta hoje (${formatDateLabel(hoje)}) — digest de novas vagas não enviado.`)
    return { sent: 0, vagas: 0 }
  }

  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { email: true },
  })
  const adminEmails = admins.map((a) => a.email)

  const recipientMap = new Map<string, DigestItem[]>()

  function addItem(email: string, item: DigestItem) {
    if (!recipientMap.has(email)) recipientMap.set(email, [])
    recipientMap.get(email)!.push(item)
  }

  for (const vaga of vagas) {
    const item: DigestItem = {
      label: vaga.cargo,
      detail: vaga.unit ? vaga.unit.name : '',
      url: appUrl(`/vagas/${vaga.id}`),
    }
    for (const email of adminEmails) addItem(email, item)
    for (const a of (vaga as any).analistas ?? []) if (a.email) addItem(a.email, item)
  }

  const dateLabel = formatDateLabel(hoje)

  const emails = Array.from(recipientMap.keys())
  for (const email of emails) {
    const items = recipientMap.get(email)!
    const sections: DigestSection[] = [
      { title: 'Novas vagas abertas hoje', color: '#15AFA4', items },
    ]
    const html = digestEmailTemplate(sections, dateLabel)
    const subject = `${items.length} ${items.length === 1 ? 'nova vaga aberta' : 'novas vagas abertas'} hoje — People 360`
    await sendEmail({ to: email, subject, html })
  }

  console.log(`[cron] Digest de novas vagas enviado para ${recipientMap.size} destinatário(s) (${vagas.length} vagas).`)

  // Slack: envia resumo consolidado de novas vagas no canal
  const allItems = vagas.map((v) => ({
    label: v.cargo,
    detail: v.unit ? v.unit.name : '',
    url: appUrl(`/vagas/${v.id}`),
  }))
  const slackSections: SlackDigestSection[] = [
    { title: 'Novas vagas abertas hoje', emoji: ':briefcase:', items: allItems },
  ]
  sendSlackDigest(slackSections, dateLabel).catch((err) => console.error('[cron] erro ao enviar digest Slack de novas vagas:', err))

  return { sent: recipientMap.size, vagas: vagas.length }
}

let started = false

/** Agenda as verificações diárias de prazos (vagas e tarefas) — executa uma vez por processo. */
export function startCronJobs() {
  if (started) return
  started = true

  // Sync Job Requisition (ERPNext) → Vaga — independente de SMTP/Slack
  const erpnextEnabled =
    !!(process.env.ERPNEXT_BASE_URL && process.env.ERPNEXT_API_KEY && process.env.ERPNEXT_API_SECRET) &&
    process.env.ERPNEXT_JR_SYNC_ENABLED !== 'false' &&
    process.env.ERPNEXT_JR_SYNC_ENABLED !== '0'

  if (erpnextEnabled) {
    const expr = process.env.ERPNEXT_JR_SYNC_CRON || '*/5 * * * *'
    cron.schedule(expr, () => {
      import('./erpnextJobRequisition')
        .then(({ syncPendingJobRequisitions }) => syncPendingJobRequisitions())
        .then((r) => {
          if (r.created || r.updated || r.errors.length) {
            console.log(
              `[cron] ERPNext JR sync: fetched=${r.fetched} created=${r.created} updated=${r.updated} skipped=${r.skipped} errors=${r.errors.length}`,
            )
          }
        })
        .catch((err) => console.error('[cron] erro no sync Job Requisition ERPNext:', err))
    }, { timezone: 'America/Sao_Paulo' })
    console.log(`[cron] Sync ERPNext Job Requisition agendado (${expr}, America/Sao_Paulo).`)
  }

  if (!process.env.SMTP_HOST && !isSlackConfigured()) {
    console.log('[cron] SMTP e Slack não configurados — digests não agendados.')
    return
  }

  // 08h — pendências (vagas vencidas/vencendo + tarefas vencidas/vencendo)
  cron.schedule('0 8 * * *', () => {
    sendDailyDigest().catch((err) => console.error('[cron] erro ao enviar digest diário:', err))
  }, { timezone: 'America/Sao_Paulo' })

  // 18h — resumo de novas vagas abertas no dia
  cron.schedule('0 18 * * 1-5', () => {
    sendNewVagasDigest().catch((err) => console.error('[cron] erro ao enviar digest de novas vagas:', err))
  }, { timezone: 'America/Sao_Paulo' })

  console.log('[cron] Jobs diários agendados: pendências 08:00, novas vagas 18:00 (America/Sao_Paulo).')
}
