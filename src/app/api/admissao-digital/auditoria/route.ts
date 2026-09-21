import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized(); if (error) return error
  if (!['ADMIN','GERENTE'].includes(session!.user.role)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  const p=req.nextUrl.searchParams,page=Math.max(1,Number(p.get('page')||1)),pageSize=50
  const where:Record<string,any>={};if(p.get('action'))where.action={contains:p.get('action'),mode:'insensitive'}
  const [total,items]=await prisma.$transaction([prisma.admissionAuditLog.count({where}),prisma.admissionAuditLog.findMany({where,include:{admission:{select:{protocol:true,candidateName:true}}},orderBy:{createdAt:'desc'},skip:(page-1)*pageSize,take:pageSize})])
  return NextResponse.json({items,pagination:{page,total,pages:Math.ceil(total/pageSize)}})
}
