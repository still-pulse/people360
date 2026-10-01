import { createHmac, timingSafeEqual } from 'crypto'

// Cliente da API da Autentique (GraphQL): https://docs.autentique.com.br/api
// Configuração: AUTENTIQUE_API_TOKEN, AUTENTIQUE_WEBHOOK_SECRET e AUTENTIQUE_SANDBOX (true = não consome créditos).

const ENDPOINT = 'https://api.autentique.com.br/v2/graphql'

export class AutentiqueError extends Error {
  constructor(message: string, readonly status?: number) { super(message); this.name = 'AutentiqueError' }
}

function token() {
  const value = process.env.AUTENTIQUE_API_TOKEN?.trim()
  if (!value) throw new AutentiqueError('A integração com a Autentique não está configurada (AUTENTIQUE_API_TOKEN).')
  return value
}

export const autentiqueConfigured = () => !!process.env.AUTENTIQUE_API_TOKEN?.trim()
export const autentiqueSandbox = () => ['true', '1', 'sim'].includes((process.env.AUTENTIQUE_SANDBOX || '').trim().toLowerCase())

async function parse<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as { data?: T; errors?: { message: string }[] } | null
  if (!response.ok || !body || body.errors?.length || !body.data) {
    const message = body?.errors?.map((error) => error.message).join('; ') || `HTTP ${response.status}`
    throw new AutentiqueError(`Autentique: ${message}`, response.status)
  }
  return body.data
}

async function graphql<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(30_000),
  })
  return parse<T>(response)
}

export type AutentiqueEvent = { created_at: string; ip?: string | null; reason?: string | null } | null
export type AutentiqueSignature = {
  public_id: string; name: string | null; email: string | null
  action: { name: string } | null; link: { short_link: string } | null
  signed?: AutentiqueEvent; rejected?: AutentiqueEvent
}

const SIGNATURE_FIELDS = 'public_id name email action { name } link { short_link }'

/** Cria o documento com um signatário (upload multipart no padrão GraphQL multipart request). */
export async function createAutentiqueDocument(input: {
  name: string; message?: string; file: Buffer; fileName: string
  signer: { name: string; email?: string | null }
}) {
  const query = `mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!, $file: Upload!) {
    createDocument(document: $document, signers: $signers, file: $file${autentiqueSandbox() ? ', sandbox: true' : ''}) {
      id name signatures { ${SIGNATURE_FIELDS} }
    }
  }`
  // Com e-mail a Autentique também avisa o candidato; sem e-mail, o link é entregue pelo portal.
  const signer = input.signer.email ? { email: input.signer.email, action: 'SIGN' } : { name: input.signer.name, action: 'SIGN' }
  const form = new FormData()
  form.append('operations', JSON.stringify({ query, variables: { document: { name: input.name, ...(input.message ? { message: input.message } : {}) }, signers: [signer], file: null } }))
  form.append('map', JSON.stringify({ file: ['variables.file'] }))
  form.append('file', new Blob([new Uint8Array(input.file)], { type: 'application/pdf' }), input.fileName)
  const response = await fetch(ENDPOINT, { method: 'POST', headers: { Authorization: `Bearer ${token()}` }, body: form, signal: AbortSignal.timeout(120_000) })
  const data = await parse<{ createDocument: { id: string; name: string; signatures: AutentiqueSignature[] } }>(response)
  return data.createDocument
}

/** Link exclusivo do signatário (quando a Autentique não o devolve na criação). */
export async function createAutentiqueSignatureLink(publicId: string) {
  // O id vai como literal (JSON.stringify escapa): a documentação não informa o tipo GraphQL do argumento.
  const data = await graphql<{ createLinkToSignature: { short_link: string } }>(
    `mutation { createLinkToSignature(public_id: ${JSON.stringify(publicId)}) { short_link } }`)
  return data.createLinkToSignature.short_link
}

export async function getAutentiqueDocument(id: string) {
  const data = await graphql<{ document: { id: string; files: { original: string | null; signed: string | null } | null; signatures: AutentiqueSignature[] } | null }>(
    `query { document(id: ${JSON.stringify(id)}) {
      id files { original signed }
      signatures { ${SIGNATURE_FIELDS} signed { created_at ip } rejected { created_at ip reason } }
    } }`)
  if (!data.document) throw new AutentiqueError(`Documento ${id} não encontrado na Autentique.`, 404)
  return data.document
}

/** Remove um documento ainda em aberto para interromper o fluxo e os avisos da Autentique. */
export async function deleteAutentiqueDocument(id: string) {
  const data = await graphql<{ deleteDocument: boolean }>(
    `mutation { deleteDocument(id: ${JSON.stringify(id)}) }`)
  return data.deleteDocument
}

export async function downloadAutentiqueFile(url: string) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token()}` }, signal: AbortSignal.timeout(120_000) })
  if (!response.ok) throw new AutentiqueError(`Não foi possível baixar o PDF assinado (HTTP ${response.status}).`, response.status)
  return Buffer.from(await response.arrayBuffer())
}

/** Confere o cabeçalho x-autentique-signature (HMAC-SHA256 em hexadecimal do corpo bruto). */
export function verifyAutentiqueWebhook(rawBody: string, signature: string | null, secret = process.env.AUTENTIQUE_WEBHOOK_SECRET) {
  if (!secret || !signature) return false
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'))
  const received = Buffer.from(signature.trim().toLowerCase())
  return expected.length === received.length && timingSafeEqual(expected, received)
}
