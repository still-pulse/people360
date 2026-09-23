import nodemailer, { Transporter } from 'nodemailer'
import { prisma } from './prisma'

let transporter: Transporter | null | undefined

function getTransporter(): Transporter | null {
  if (transporter !== undefined) return transporter

  if (!process.env.SMTP_HOST) {
    transporter = null
    return transporter
  }

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined,
  })

  return transporter
}

interface SendEmailParams {
  to: string | string[]
  subject: string
  html: string
}

// Registra o envio na tabela de logs de e-mail (não quebra o fluxo principal em caso de erro)
async function logEmail(to: string, subject: string, status: 'SUCCESS' | 'ERROR', response?: string | null) {
  try {
    await prisma.emailLog.create({ data: { to, subject, status, response: response ?? null } })
  } catch (err) {
    console.error('[email] Falha ao registrar log de e-mail:', err)
  }
}

/** Envia um e-mail via SMTP. Se SMTP não estiver configurado, apenas loga e ignora. */
export async function sendEmail({ to, subject, html }: SendEmailParams): Promise<{ ok: boolean; error?: string }> {
  const t = getTransporter()
  const recipient = Array.isArray(to) ? to.join(', ') : to

  if (!t) {
    const msg = 'SMTP não configurado (SMTP_HOST vazio)'
    console.warn(`[email] ${msg} — e-mail não enviado: "${subject}" para ${recipient}`)
    return { ok: false, error: msg }
  }

  try {
    const info = await t.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    })
    console.log(`[email] Enviado para ${recipient}: "${subject}" — ${info.response}`)
    await logEmail(recipient, subject, 'SUCCESS', info.response)
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error(`[email] Falha ao enviar e-mail para ${recipient}:`, err)
    await logEmail(recipient, subject, 'ERROR', error)
    return { ok: false, error }
  }
}

const BRAND_COLOR = '#15AFA4'

interface EmailTemplateParams {
  title: string
  body?: string
  ctaLabel?: string
  ctaUrl?: string
  footer?: string
}

/** Template HTML padrão das notificações por e-mail da BHCL. */
export function emailTemplate({ title, body, ctaLabel, ctaUrl, footer }: EmailTemplateParams) {
  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #F8FAFB; padding: 24px;">
    <div style="background: ${BRAND_COLOR}; border-radius: 12px 12px 0 0; padding: 20px 24px;">
      <span style="color: #fff; font-size: 18px; font-weight: 700;">BHCL</span>
    </div>
    <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 24px; border: 1px solid #E5E7EB; border-top: none;">
      <h2 style="margin: 0 0 12px; font-size: 16px; color: #111827;">${title}</h2>
      ${body ? `<p style="margin: 0 0 20px; font-size: 14px; color: #4B5563; line-height: 1.5; white-space: pre-line;">${body}</p>` : ''}
      ${ctaLabel && ctaUrl ? `<a href="${ctaUrl}" style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;">${ctaLabel}</a>` : ''}
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 16px;">${footer ?? 'Esta é uma notificação automática da BHCL.'}</p>
  </div>
  `.trim()
}

export interface DigestItem {
  label: string
  detail: string
  url: string
}

export interface DigestSection {
  title: string
  color: string
  items: DigestItem[]
}

/** Template HTML do e-mail de resumo diário (digest) com múltiplas seções. */
export function digestEmailTemplate(sections: DigestSection[], dateLabel: string) {
  const sectionHtml = sections
    .filter((s) => s.items.length > 0)
    .map(
      (s) => `
      <div style="margin-bottom: 20px;">
        <div style="background: ${s.color}; color: #fff; font-size: 13px; font-weight: 700; padding: 8px 14px; border-radius: 8px 8px 0 0;">
          ${s.title} (${s.items.length})
        </div>
        <div style="border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px; overflow: hidden;">
          ${s.items
            .map(
              (item, i) => `
            <div style="padding: 10px 14px; font-size: 13px; color: #374151; ${i > 0 ? 'border-top: 1px solid #F3F4F6;' : ''}">
              <a href="${item.url}" style="color: ${BRAND_COLOR}; text-decoration: none; font-weight: 600;">${item.label}</a>
              <div style="color: #6B7280; font-size: 12px; margin-top: 2px;">${item.detail}</div>
            </div>`,
            )
            .join('')}
        </div>
      </div>`,
    )
    .join('')

  const totalItems = sections.reduce((sum, s) => sum + s.items.length, 0)

  return `
  <div style="font-family: -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; background: #F8FAFB; padding: 24px;">
    <div style="background: ${BRAND_COLOR}; border-radius: 12px 12px 0 0; padding: 20px 24px;">
      <span style="color: #fff; font-size: 18px; font-weight: 700;">BHCL</span>
      <div style="color: rgba(255,255,255,0.85); font-size: 12px; margin-top: 4px;">Resumo diário — ${dateLabel}</div>
    </div>
    <div style="background: #fff; border-radius: 0 0 12px 12px; padding: 24px; border: 1px solid #E5E7EB; border-top: none;">
      <p style="margin: 0 0 16px; font-size: 14px; color: #4B5563;">
        Você tem <strong>${totalItems} ${totalItems === 1 ? 'item pendente' : 'itens pendentes'}</strong> que requerem atenção:
      </p>
      ${sectionHtml}
      <a href="${appUrl('/')}" style="display: inline-block; background: ${BRAND_COLOR}; color: #fff; text-decoration: none; font-size: 14px; font-weight: 600; padding: 10px 20px; border-radius: 8px;">Acessar o sistema</a>
    </div>
    <p style="text-align: center; color: #9CA3AF; font-size: 11px; margin-top: 16px;">Esta é uma notificação automática da BHCL.</p>
  </div>
  `.trim()
}

/** Monta a URL absoluta para um link relativo da aplicação. */
export function appUrl(path: string) {
  const base = (process.env.NEXTAUTH_URL ?? '').replace(/\/$/, '')
  return `${base}${path}`
}
