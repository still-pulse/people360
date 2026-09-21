import { PrismaClient } from '@prisma/client'
import { randomBytes, createHash } from 'crypto'
import { readFile } from 'fs/promises'
import path from 'path'

const prisma = new PrismaClient()

const documentTypes = [
  ['rg_frente','RG ou CNH (frente)',1],['rg_verso','RG ou CNH (verso)',2],['cpf','CPF',3],
  ['comprovante_residencia','Comprovante de residência',4],['carteira_trabalho','Carteira de Trabalho Digital',5],
  ['pis','Comprovante de PIS/PASEP',6],['titulo_eleitor','Título de eleitor',7],['certidao','Certidão civil',8],
] as const

const templates = [
  {key:'ficha_registro',name:'Ficha de Registro',version:1,content:'Ficha de registro de {{candidateName}}. Cargo: {{jobTitle}}. Unidade: {{unit}}. Tipo de contrato: {{contractType}}. Protocolo: {{protocol}}.'},
  {key:'termo_vale_transporte',name:'Termo de Vale-Transporte',version:1,content:'Declaração de Vale-Transporte vinculada ao processo de {{candidateName}}, protocolo {{protocol}}. Opção: {{transportChoice}}. Itinerário: {{transportRoutes}}. Aplicam-se o texto e a versão validados pelo Jurídico/DPO.'},
] as const

async function main(){
 for(const [key,name,position] of documentTypes)await prisma.admissionDocumentType.upsert({where:{key},update:{name,position,active:true},create:{key,name,position}})
 const contractContent=await readFile(path.join(process.cwd(),'prisma','templates','contrato-experiencia-v2.txt'),'utf8')
 await prisma.documentTemplate.updateMany({where:{key:'contrato_trabalho'},data:{active:false}})
 const configuredTemplates=[{key:'contrato_trabalho',name:'Contrato de Experiência',version:2,content:contractContent},...templates]
 for(const t of configuredTemplates)await prisma.documentTemplate.upsert({where:{key_version:{key:t.key,version:t.version}},update:{name:t.name,content:t.content,active:true},create:{...t,variables:{candidateName:'string',jobTitle:'string',unit:'string',hireDate:'date',protocol:'string'}}})
 console.log(`Admissão Digital: ${documentTypes.length} tipos e ${configuredTemplates.length} templates configurados.`)
 if(process.env.ADMISSION_SEED_DEMO!=='true')return
 const [user,unit]=await Promise.all([prisma.user.findFirst({where:{active:true,role:'ADMIN'}}),prisma.unit.findFirst({where:{active:true}})])
 if(!user||!unit){console.log('Demo não criada: execute o seed principal primeiro.');return}
 const raw=randomBytes(32).toString('base64url'),tokenHash=createHash('sha256').update(raw).digest('hex')
 const admission=await prisma.admission.upsert({where:{protocol:'ADM-DEMO-2026'},update:{},create:{protocol:'ADM-DEMO-2026',unitId:unit.id,createdById:user.id,ownerId:user.id,candidateName:'Candidato Demonstração',candidateEmail:'candidato@example.com',candidatePhone:'(11) 99999-0000',jobTitle:'Técnico(a) de Enfermagem',department:'Enfermagem',hireDate:new Date(Date.now()+14*86400000),contractType:'CLT - prazo indeterminado',workSchedule:'12x36 · 07:00–19:00',weeklyHours:36,status:'LINK_SENT',tokens:{create:{tokenHash,tokenHint:raw.slice(-4),expiresAt:new Date(Date.now()+30*86400000)}},documents:{create:(await prisma.admissionDocumentType.findMany({where:{active:true}})).map(t=>({typeId:t.id}))},faceVerifications:{create:{provider:'mock'}}}})
 console.log(`Portal demonstrativo: ${(process.env.NEXTAUTH_URL||'http://localhost:3000')}/admissao/${raw}`)
 console.log(`Admissão interna: /admissao-digital/admissoes/${admission.id}`)
}
main().finally(()=>prisma.$disconnect())
