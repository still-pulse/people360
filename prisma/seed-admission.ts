import { PrismaClient } from '@prisma/client'
import { randomBytes, createHash } from 'crypto'
import { DOCUMENT_CATALOG, syncDocumentCatalog } from '../src/lib/admission/documentCatalog'
import { ensureAdmissionTemplates } from '../src/lib/admission/ensureTemplates'

const prisma = new PrismaClient()

async function main(){
 // Catálogo de documentos e templates vêm do código (mesma fonte usada em produção, que também os sincroniza sozinha).
 await syncDocumentCatalog(true)
 await ensureAdmissionTemplates()
 console.log(`Admissão Digital: ${DOCUMENT_CATALOG.length} tipos de documento e templates sincronizados.`)
 if(process.env.ADMISSION_SEED_DEMO!=='true')return
 const [user,unit]=await Promise.all([prisma.user.findFirst({where:{active:true,role:'ADMIN'}}),prisma.unit.findFirst({where:{active:true}})])
 if(!user||!unit){console.log('Demo não criada: execute o seed principal primeiro.');return}
 const raw=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(raw).digest('hex')
 const admission=await prisma.admission.upsert({where:{protocol:'ADM-DEMO-2026'},update:{},create:{protocol:'ADM-DEMO-2026',unitId:unit.id,createdById:user.id,ownerId:user.id,candidateName:'Candidato Demonstração',candidateEmail:'candidato@example.com',candidatePhone:'(11) 99999-0000',jobTitle:'Técnico(a) de Enfermagem',department:'Enfermagem',hireDate:new Date(Date.now()+14*86400000),contractType:'CLT - prazo indeterminado',workSchedule:'12x36 · 07:00–19:00',weeklyHours:36,status:'LINK_SENT',tokens:{create:{tokenHash,tokenHint:raw.slice(-4),expiresAt:new Date(Date.now()+30*86400000)}},documents:{create:(await prisma.admissionDocumentType.findMany({where:{active:true}})).map(t=>({typeId:t.id}))},faceVerifications:{create:{provider:'mock'}}}})
 console.log(`Portal demonstrativo: ${(process.env.NEXTAUTH_URL||'http://localhost:3000')}/admissao/${raw}`)
 console.log(`Admissão interna: /admissao-digital/admissoes/${admission.id}`)
}
main().finally(()=>prisma.$disconnect())
