import { createHash, randomBytes } from 'crypto'
import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { prisma } from '@/lib/prisma'
import { savePrivateAdmissionFile } from './storage'
import { hashToken } from './security'

function interpolate(content: string, values: Record<string, string>) {
  return content.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_, key) => values[key] ?? '—')
}

export async function generateAdmissionDocuments(admissionId: string, origin: string) {
  const admission = await prisma.admission.findUnique({ where: { id: admissionId }, include: { unit: true } })
  if (!admission) throw new Error('Admissão não encontrada.')
  const templates = await prisma.documentTemplate.findMany({ where: { active: true }, orderBy: [{ key: 'asc' }, { version: 'desc' }], distinct: ['key'] })
  if (!templates.length) throw new Error('Nenhum template ativo foi configurado.')
  const values = { candidateName: admission.candidateName, protocol: admission.protocol, jobTitle: admission.jobTitle, unit: admission.unit.name, hireDate: admission.hireDate.toLocaleDateString('pt-BR'), contractType: admission.contractType }
  const results=[]
  for (const template of templates) {
    const existing=await prisma.generatedDocument.findFirst({where:{admissionId,templateId:template.id,status:{in:['GENERATED','SENT','SIGNED']}}})
    if(existing){results.push(existing);continue}
    const validationToken=randomBytes(24).toString('base64url'),validationCode=randomBytes(4).toString('hex').toUpperCase()
    const validationUrl=`${origin}/validar-documento/${validationToken}`
    const text=interpolate(template.content,values),pdf=new jsPDF({unit:'mm',format:'a4'})
    pdf.setFont('helvetica','bold');pdf.setFontSize(15);pdf.text(template.name,20,22)
    pdf.setFont('helvetica','normal');pdf.setFontSize(10);const lines=pdf.splitTextToSize(text,170);pdf.text(lines,20,34)
    const qr=await QRCode.toDataURL(validationUrl,{margin:1,width:180});pdf.addImage(qr,'PNG',154,245,34,34)
    pdf.setFontSize(8);pdf.text(`Protocolo ${admission.protocol} · Versão ${template.version} · Validação ${validationCode}`,20,282)
    const buffer=Buffer.from(pdf.output('arraybuffer')),hash=createHash('sha256').update(buffer).digest('hex')
    const saved=await savePrivateAdmissionFile(admissionId,`generated-${template.key}`,new File([buffer],`${template.key}.pdf`,{type:'application/pdf'}))
    const created=await prisma.generatedDocument.create({data:{admissionId,templateId:template.id,templateVersion:template.version,status:'GENERATED',storagePath:saved.storagePath,originalHash:hash,validationTokenHash:hashToken(validationToken),validationCode,generatedAt:new Date()}})
    results.push({...created,validationUrl})
  }
  return results
}
