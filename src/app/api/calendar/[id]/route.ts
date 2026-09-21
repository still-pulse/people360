import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { log, extractIp, diff } from '@/lib/audit'
// prisma.calendarEventParticipant available via generated client

async function checkEventAccess(eventId: string, session: any) {
  const event = await prisma.calendarEvent.findUnique({ where: { id: eventId } })
  if (!event) return { event: null, forbidden: true }
  if (session.user.role === 'ANALYST' && event.unitId !== session.user.unitId) {
    return { event, forbidden: true }
  }
  return { event, forbidden: false }
}

export async function PUT(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { event, forbidden } = await checkEventAccess(params.id, session!)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const unitId = session!.user.role === 'ANALYST' && session!.user.unitId
    ? session!.user.unitId
    : body.unitId || null

  // Atualiza participantes: apaga os antigos e recria
  const participantIds: string[] = (body.participantIds ?? []).filter(
    (id: string) => id !== session!.user.id
  )
  await prisma.calendarEventParticipant.deleteMany({ where: { eventId: params.id } })
  if (participantIds.length > 0) {
    await prisma.calendarEventParticipant.createMany({
      data: participantIds.map((userId: string) => ({ eventId: params.id, userId })),
      skipDuplicates: true,
    })
  }

  const updated = await prisma.calendarEvent.update({
    where: { id: params.id },
    data: {
      title: body.title,
      description: body.description || null,
      pauta: body.pauta || null,
      meetingLink: body.meetingLink || null,
      startDate: new Date(body.startDate), endDate: new Date(body.endDate),
      allDay: body.allDay ?? false, eventType: body.eventType, unitId,
      reminders: body.reminders ?? event.reminders,
    },
    include: {
      unit: true,
      user: { select: { id: true, name: true } },
      participants: { include: { user: { select: { id: true, name: true } } } },
    },
  })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'UPDATE', entity: 'Evento', entityId: params.id, entityName: event.title,
    details: diff(event as any, updated as any),
    ip: extractIp(req.headers),
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { event, forbidden } = await checkEventAccess(params.id, session!)
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (forbidden) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await prisma.calendarEvent.delete({ where: { id: params.id } })

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'DELETE', entity: 'Evento', entityId: params.id, entityName: event.title,
    ip: extractIp(req.headers),
  })

  return NextResponse.json({ success: true })
}
