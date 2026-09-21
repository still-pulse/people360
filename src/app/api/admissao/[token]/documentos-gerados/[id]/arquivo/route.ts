import { NextRequest,NextResponse } from 'next/server'
import { getAdmissionByPublicToken } from '@/lib/admission/service'
import { readPrivateAdmissionFile } from '@/lib/admission/storage'

export async function GET(_:NextRequest,{params}:{params:{token:string;id:string}}){const token=await getAdmissionByPublicToken(params.token);if(!token)return NextResponse.json({error:'Link inválido.'},{status:404});const doc=token.admission.generatedDocuments.find(d=>d.id===params.id);if(!doc?.storagePath)return NextResponse.json({error:'Documento indisponível.'},{status:404});const file=await readPrivateAdmissionFile(doc.signedStoragePath||doc.storagePath);if(!file)return NextResponse.json({error:'Arquivo indisponível.'},{status:404});return new NextResponse(file,{headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="documento-${doc.id}.pdf"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}})}
