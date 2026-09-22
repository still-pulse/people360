import { emailTemplate, sendEmail } from '@/lib/email'
import { sendEvolutionText } from '@/lib/evolution'

export type AdmissionNotification = {
  candidateName: string
  candidateEmail?: string | null
  candidatePhone?: string | null
  protocol: string
  title: string
  message: string
  portalUrl?: string
}

export async function notifyAdmissionCandidate(input: AdmissionNotification) {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!)
  const tasks: Promise<unknown>[] = []
  if (input.candidateEmail) tasks.push(sendEmail({
    to: input.candidateEmail,
    subject: `${input.title} — ${input.protocol}`,
    html: emailTemplate({ title: escapeHtml(input.title), body: escapeHtml(`Olá, ${input.candidateName.split(' ')[0]}.\n\n${input.message}\n\nProtocolo: ${input.protocol}`), ctaLabel: input.portalUrl ? 'Acessar admissão' : undefined, ctaUrl: input.portalUrl }),
  }))
  if (input.candidatePhone) tasks.push(sendEvolutionText(input.candidatePhone, `Olá, ${input.candidateName.split(' ')[0]}!\n\n${input.message}\n\nProtocolo: ${input.protocol}${input.portalUrl ? `\n\nAcesse: ${input.portalUrl}` : ''}\nPeople 360`).catch((error) => {
    console.error('[admission-whatsapp] Falha ao enviar:', error)
    return { error }
  }))
  return Promise.allSettled(tasks)
}
