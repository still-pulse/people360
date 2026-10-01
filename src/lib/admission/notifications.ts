import { appUrl, emailTemplate, sendEmail } from '@/lib/email'
import { sendEvolutionText } from '@/lib/evolution'
import { prisma } from '@/lib/prisma'

export type AdmissionNotification = {
  id?: string
  status?: string
  candidateName: string
  candidateEmail?: string | null
  candidatePhone?: string | null
  protocol: string
  title: string
  message: string
  portalUrl?: string
}

export async function notifyAdmissionCandidate(input: AdmissionNotification) {
  if (input.status === 'CANCELLED') return []
  if (input.id) {
    const admission = await prisma.admission.findUnique({ where: { id: input.id }, select: { status: true } })
    if (!admission || admission.status === 'CANCELLED') return []
  }
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
  const tasks: Promise<unknown>[] = []
  if (input.candidateEmail) tasks.push(sendEmail({
    to: input.candidateEmail,
    subject: `${input.title} — ${input.protocol}`,
    html: emailTemplate({ title: escapeHtml(input.title), body: escapeHtml(`Olá, ${input.candidateName.split(' ')[0]}.\n\n${input.message}\n\nProtocolo: ${input.protocol}`), ctaLabel: input.portalUrl ? 'Acessar admissão' : undefined, ctaUrl: input.portalUrl }),
  }))
  if (input.candidatePhone) tasks.push(sendEvolutionText(input.candidatePhone, `Olá, ${input.candidateName.split(' ')[0]}!\n\n${input.message}\n\nProtocolo: ${input.protocol}${input.portalUrl ? `\n\nAcesse: ${input.portalUrl}` : ''}\nBHCL`).catch((error) => {
    console.error('[admission-whatsapp] Falha ao enviar:', error)
    return { error }
  }))
  return Promise.allSettled(tasks)
}

/** Avisa por e-mail a analista responsável (ou quem criou a admissão) que há documentos aguardando aprovação. */
export async function notifyAdmissionOwnerDocumentsPending(admissionId: string) {
  try {
    const admission = await prisma.admission.findUnique({ where: { id: admissionId }, select: {
      id: true, protocol: true, candidateName: true, jobTitle: true, processType: true, status: true,
      unit: { select: { name: true } }, owner: { select: { email: true, active: true } }, createdBy: { select: { email: true, active: true } },
      analysts: { where: { active: true }, select: { email: true } },
      documents: { where: { status: { notIn: ['APPROVED', 'NOT_APPLICABLE'] } }, select: { type: { select: { name: true } } } },
      badgePhotos: { where: { confirmedAt: { not: null } }, orderBy: { createdAt: 'desc' }, take: 1, select: { approvedAt: true } },
    } })
    if (!admission || admission.status === 'CANCELLED') return
    const main = admission.owner?.active ? admission.owner.email : admission.createdBy?.active ? admission.createdBy.email : null
    const recipients = Array.from(new Set([main, ...admission.analysts.map((analyst) => analyst.email)].filter((email): email is string => !!email)))
    if (!recipients.length) return
    const recipient = recipients
    const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
    const kind = admission.processType === 'REGISTRATION_UPDATE' ? 'da atualização cadastral' : 'da admissão'
    const photoPending = admission.processType !== 'REGISTRATION_UPDATE' && admission.badgePhotos[0] && !admission.badgePhotos[0].approvedAt
    const pending = [...admission.documents.map((document) => `• ${document.type.name}`), ...(photoPending ? ['• Foto do crachá'] : [])].join('\n') || '—'
    await sendEmail({
      to: recipient,
      subject: `Documentos pendentes de aprovação — ${admission.candidateName} (${admission.protocol})`,
      html: emailTemplate({
        title: 'Documentos aguardando sua aprovação',
        body: escapeHtml(`${admission.candidateName} concluiu o envio ${kind} e os documentos estão pendentes de aprovação.\n\nCargo: ${admission.jobTitle}\nUnidade: ${admission.unit?.name ?? '—'}\nProtocolo: ${admission.protocol}\n\nDocumentos pendentes:\n${pending}`),
        ctaLabel: 'Revisar documentos',
        ctaUrl: appUrl(`/admissao-digital/admissoes/${admission.id}`),
      }),
    })
  } catch (error) {
    console.error('[admission-owner-email] Falha ao avisar o RH:', error)
  }
}
