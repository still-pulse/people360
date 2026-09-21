import { createHash, randomBytes } from 'crypto'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { decryptAdmissionValue, hashToken } from './security'
import { savePrivateAdmissionFile } from './storage'

export function interpolate(content: string, values: Record<string, string>) {
  return content.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => values[key] ?? '—')
}

function date(value?: Date | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(value) : '—'
}

function longDate(value: Date) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Sao_Paulo' }).format(value)
}

function money(value?: number | null) {
  return value == null ? '—' : value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function valueText(value: unknown) {
  if (value == null || value === '') return '—'
  return typeof value === 'string' ? value : String(value)
}

export function createPdf(name: string, content: string, protocol: string, version: number, validationCode: string, qrDataUrl: string) {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const margin = 20, width = 170, bottom = 267
  let page = 1, y = 22
  const header = () => {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(name, margin, 18)
    pdf.setDrawColor(15, 155, 142); pdf.setLineWidth(.5); pdf.line(margin, 22, 190, 22)
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(93, 110, 113)
    pdf.text(`Protocolo ${protocol} · Versão ${version}`, margin, 27)
    pdf.setTextColor(29, 43, 46); y = 34
  }
  const footer = () => {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(124, 142, 145)
    pdf.text(`People360 · Documento ${validationCode} · Página ${page}`, 105, 289, { align: 'center' })
    pdf.setTextColor(29, 43, 46)
  }
  const nextPage = () => { footer(); pdf.addPage(); page += 1; header() }
  header()
  for (const paragraph of content.split('\n')) {
    if (!paragraph.trim()) { y += 4; continue }
    const heading = /^[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ0-9 —–-]{6,}$/.test(paragraph.trim()) || /^\d+\s*[—-]/.test(paragraph.trim())
    pdf.setFont('helvetica', heading ? 'bold' : 'normal'); pdf.setFontSize(heading ? 10.5 : 9.5)
    const lines = pdf.splitTextToSize(paragraph.trim(), width) as string[]
    const height = lines.length * (heading ? 5.2 : 4.7)
    if (y + height > bottom) nextPage()
    pdf.text(lines, margin, y); y += height + (heading ? 2.2 : 1.4)
  }
  if (y > 229) nextPage()
  pdf.setDrawColor(226, 232, 231); pdf.roundedRect(margin, y + 2, width, 40, 2, 2)
  pdf.addImage(qrDataUrl, 'PNG', 153, y + 6, 32, 32)
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9); pdf.text('VALIDAÇÃO DO DOCUMENTO', 25, y + 13)
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.text(`Código: ${validationCode}`, 25, y + 20)
  pdf.text('Leia o QR Code para consultar a autenticidade.', 25, y + 26)
  footer()
  return pdf
}

export async function generateAdmissionDocuments(admissionId: string, origin: string) {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    include: { unit: true, vacancy: true, fields: true, dependents: true, transport: { include: { routes: { orderBy: { position: 'asc' } } } } },
  })
  if (!admission) throw new Error('Admissão não encontrada.')
  const templates = await prisma.documentTemplate.findMany({ where: { active: true }, orderBy: [{ key: 'asc' }, { version: 'desc' }], distinct: ['key'] })
  if (!templates.length) throw new Error('Nenhum template ativo foi configurado.')

  const fields = Object.fromEntries(admission.fields.map((field) => [field.key, field.sensitive ? decryptAdmissionValue(field.value) : field.value]))
  const address = [fields.street, fields.number, fields.complement, fields.district, fields.city, fields.state, fields.zipCode].filter(Boolean).join(', ')
  const transport = admission.transport
  const transportRequested = transport?.requested === true
  const routes = transportRequested ? transport.routes : []
  const transportRoutesTable = routes.length
    ? routes.map((route, index) => `${index + 1}. Tipo: ${route.type} | Linha: ${route.line} | Ida: ${money(route.outbound)} | Volta: ${money(route.returnValue)} | Total/dia: ${money(route.outbound + route.returnValue)}`).join('\n')
    : 'Não se aplica.'
  const transportDailyTotal = routes.length ? money(routes.reduce((sum, route) => sum + route.outbound + route.returnValue, 0)) : '—'
  const values: Record<string, string> = {
    employerName: process.env.ADMISSION_EMPLOYER_NAME || 'BENEFICÊNCIA HOSPITALAR DE CESÁRIO LANGE',
    employerCnpj: process.env.ADMISSION_EMPLOYER_CNPJ || '50.351.626/0015-16',
    employerAddress: process.env.ADMISSION_EMPLOYER_ADDRESS || 'R. dos Jesuítas, 533, Cidade Industrial Satélite de São Paulo, Guarulhos/SP',
    candidateName: admission.candidateName, protocol: admission.protocol, jobTitle: admission.jobTitle,
    vacancyTitle: admission.vacancy?.titulo || admission.jobTitle, department: admission.department || admission.vacancy?.setor || '—', unit: admission.unit.name,
    hireDate: date(admission.hireDate), contractEndDate: date(admission.contractEndDate), contractType: admission.contractType,
    experienceDays: admission.experienceDays ? `${admission.experienceDays} dias` : 'conforme contratação', salary: money(admission.salary),
    hazardPayPercentage: admission.hazardPayPercentage == null ? 'não informado' : `${admission.hazardPayPercentage}%`,
    workSchedule: admission.workSchedule || admission.vacancy?.horarioTrabalho || admission.vacancy?.escala || '—', breakSchedule: admission.breakSchedule || '—',
    weeklyHours: admission.weeklyHours ? `${admission.weeklyHours} horas` : admission.vacancy?.cargaHoraria || '—',
    cpf: valueText(fields.cpf), rg: valueText(fields.rg), rgIssuer: valueText(fields.rgIssuer), rgIssuedAt: valueText(fields.rgIssuedAt), pis: valueText(fields.pis),
    birthDate: valueText(fields.birthDate), maritalStatus: valueText(fields.maritalStatus), education: valueText(fields.education), fatherName: valueText(fields.fatherName),
    motherName: valueText(fields.motherName), phone: valueText(fields.phone), email: valueText(fields.email), addressFull: address || '—', city: valueText(fields.city),
    signatureDateLong: longDate(new Date()),
    dependents: admission.dependents.map((dependent) => `${dependent.name} (${dependent.relationship}), nascimento ${date(dependent.birthDate)}`).join('; ') || 'Nenhum dependente informado',
    street: valueText(fields.street), number: valueText(fields.number), district: valueText(fields.district), state: valueText(fields.state), zipCode: valueText(fields.zipCode),
    transportYes: transportRequested ? '(X)' : '( )', transportNo: transport && !transportRequested ? '(X)' : '( )',
    transportRefusalReason: transportRequested ? '—' : valueText(transport?.refusalReason), transportRoutesTable, transportDailyTotal,
  }

  const results = []
  for (const template of templates) {
    const existing = await prisma.generatedDocument.findFirst({ where: { admissionId, templateId: template.id, status: { in: ['GENERATED', 'SENT', 'SIGNED'] } } })
    if (existing) { results.push(existing); continue }
    const validationToken = randomBytes(24).toString('base64url'), validationCode = randomBytes(4).toString('hex').toUpperCase()
    const validationUrl = `${origin}/validar-documento/${validationToken}`
    const qr = await QRCode.toDataURL(validationUrl, { margin: 1, width: 180 })
    const pdf = createPdf(template.name, interpolate(template.content, values), admission.protocol, template.version, validationCode, qr)
    const buffer = Buffer.from(pdf.output('arraybuffer')), hash = createHash('sha256').update(buffer).digest('hex')
    const saved = await savePrivateAdmissionFile(admissionId, `generated-${template.key}`, new File([buffer], `${template.key}.pdf`, { type: 'application/pdf' }))
    const created = await prisma.generatedDocument.create({ data: { admissionId, templateId: template.id, templateVersion: template.version, status: 'GENERATED', storagePath: saved.storagePath, originalHash: hash, validationTokenHash: hashToken(validationToken), validationCode, generatedAt: new Date() } })
    results.push({ ...created, validationUrl })
  }
  return results
}
