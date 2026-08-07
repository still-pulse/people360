import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const MIME: Record<string, string> = {
  '.png':  'image/png',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif':  'image/gif',
  '.svg':  'image/svg+xml',
  '.pdf':  'application/pdf',
  '.mp4':  'video/mp4',
  '.mov':  'video/quicktime',
  '.webm': 'video/webm',
  '.avi':  'video/x-msvideo',
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  const filePath = path.join(uploadsDir, ...params.path)

  // Impede path traversal
  if (!filePath.startsWith(uploadsDir + path.sep) && filePath !== uploadsDir) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  if (!existsSync(filePath)) {
    return new NextResponse('Not found', { status: 404 })
  }

  const ext = path.extname(filePath).toLowerCase()
  const contentType = MIME[ext] ?? 'application/octet-stream'
  const buffer = await readFile(filePath)

  // inline = abre no navegador; attachment = força download
  const isInline = contentType.startsWith('image/') || contentType.startsWith('video/') || contentType === 'application/pdf'
  const filename = path.basename(filePath)

  return new NextResponse(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': isInline
        ? `inline; filename="${filename}"`
        : `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  })
}
