import { NextResponse } from 'next/server'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'

export async function GET(){const {session,error}=await getSessionOrUnauthorized();if(error)return error;if(session!.user.role!=='ADMIN')return NextResponse.json({error:'Sem permissão.'},{status:403});return NextResponse.json({providers:{face:process.env.FACE_VERIFICATION_PROVIDER||'mock',signature:process.env.SIGNATURE_PROVIDER||'mock',erpnext:process.env.ADMISSION_ERPNEXT_PROVIDER||'mock',notifications:process.env.ADMISSION_NOTIFICATION_PROVIDER||'mock'},retentionDays:Number(process.env.ADMISSION_RETENTION_DAYS||3650),maxFileSize:Number(process.env.ADMISSION_MAX_FILE_SIZE||15728640),transportDeclarationVersion:process.env.VT_DECLARATION_VERSION||'v1'})}
