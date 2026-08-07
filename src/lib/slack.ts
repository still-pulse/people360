const BRAND_COLOR = '#15AFA4'

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: { type: string; text: string }[]
  fields?: { type: string; text: string }[]
  accessory?: { type: string; text: { type: string; text: string; emoji?: boolean }; url: string }
}

function getWebhookUrl(): string | null {
  return process.env.SLACK_WEBHOOK_URL || null
}

async function postToSlack(blocks: SlackBlock[], text: string): Promise<{ ok: boolean; error?: string }> {
  const url = getWebhookUrl()
  if (!url) {
    console.warn('[slack] SLACK_WEBHOOK_URL não configurado — mensagem não enviada.')
    return { ok: false, error: 'SLACK_WEBHOOK_URL não configurado' }
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[slack] Erro ao enviar mensagem: ${res.status} — ${body}`)
      return { ok: false, error: `${res.status}: ${body}` }
    }

    console.log('[slack] Mensagem enviada com sucesso.')
    return { ok: true }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error('[slack] Falha ao enviar mensagem:', error)
    return { ok: false, error }
  }
}

export interface SlackDigestItem {
  label: string
  detail: string
  url: string
}

export interface SlackDigestSection {
  title: string
  emoji: string
  items: SlackDigestItem[]
}

export async function sendSlackNotification(title: string, body: string, url: string) {
  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title, emoji: true },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body },
      accessory: {
        type: 'button',
        text: { type: 'plain_text', text: 'Abrir', emoji: true },
        url,
      },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [{ type: 'mrkdwn', text: ':office: *People 360*' }],
    },
  ]

  return postToSlack(blocks, `${title}: ${body}`)
}

export async function sendSlackDigest(sections: SlackDigestSection[], dateLabel: string) {
  const filtered = sections.filter((s) => s.items.length > 0)
  if (filtered.length === 0) return { ok: true }

  const totalItems = filtered.reduce((sum, s) => sum + s.items.length, 0)

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Resumo diário — ${dateLabel}`, emoji: true },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*${totalItems} ${totalItems === 1 ? 'item pendente' : 'itens pendentes'}* que requerem atenção:`,
      },
    },
  ]

  for (const section of filtered) {
    blocks.push({ type: 'divider' })
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `${section.emoji} *${section.title}* (${section.items.length})`,
      },
    })

    const lines = section.items.map(
      (item) => `• <${item.url}|${item.label}>${item.detail ? ` — ${item.detail}` : ''}`,
    )
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: lines.join('\n') },
    })
  }

  blocks.push({ type: 'divider' })
  blocks.push({
    type: 'context',
    elements: [{ type: 'mrkdwn', text: ':office: *People 360*' }],
  })

  const fallback = filtered.map((s) => `${s.title}: ${s.items.length}`).join(', ')
  return postToSlack(blocks, `Resumo diário (${dateLabel}): ${fallback}`)
}

export function isSlackConfigured(): boolean {
  return !!getWebhookUrl()
}
