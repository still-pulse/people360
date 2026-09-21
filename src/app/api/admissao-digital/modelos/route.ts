import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { extractIp, log } from '@/lib/audit'

const modelSchema = z.object({
  key: z.string().min(2).max(80).regex(/^[a-z0-9_-]+$/),
  name: z.string().min(3).max(140),
  content: z.string().min(20).max(100_000),
})

export async function GET(){
  const { error }=await getSessionOrUnauthorized(); if(error)return error
  const templates=await prisma.documentTemplate.findMany({orderBy:[{key:'asc'},{version:'desc'}]})
  return NextResponse.json(templates)
}

export async function POST(req:NextRequest){
  const {session,error}=await getSessionOrUnauthorized(); if(error)return error
  if(session!.user.role!=='ADMIN')return NextResponse.json({error:'Somente administradores podem criar modelos.'},{status:403})
  const parsed=modelSchema.safeParse(await req.json().catch(()=>null))
  if(!parsed.success)return NextResponse.json({error:'Revise o nome, a chave e o conteúdo do modelo.'},{status:400})
  const latest=await prisma.documentTemplate.findFirst({where:{key:parsed.data.key},orderBy:{version:'desc'},select:{version:true}})
  const variables=Array.from(parsed.data.content.matchAll(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g),match=>match[1])
  const created=await prisma.$transaction(async tx=>{
    await tx.documentTemplate.updateMany({where:{key:parsed.data.key,active:true},data:{active:false}})
    return tx.documentTemplate.create({data:{...parsed.data,version:(latest?.version||0)+1,variables,active:true}})
  })
  await log({userId:session!.user.id,userName:session!.user.name,userRole:session!.user.role,action:'CREATE',entity:'DocumentTemplate',entityId:created.id,entityName:created.name,details:{key:created.key,version:created.version},ip:extractIp(req.headers)})
  return NextResponse.json(created,{status:201})
}
