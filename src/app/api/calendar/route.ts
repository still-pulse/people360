import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSessionOrUnauthorized, enforceUnitFilter } from '@/lib/apiHelpers'
import { notifyUsers } from '@/lib/notify'
import { log, extractIp } from '@/lib/audit'

const participantsInclude = {
  participants: { include: { user: { select: { id: true, name: true } } } },
}

export async function GET(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const { searchParams } = new URL(req.url)
  const start = searchParams.get('start')
  const end = searchParams.get('end')

  const where: any = {}

  if (session!.user.role === 'ANALYST') {
    const unitIds: string[] = (session!.user as any).unitIds?.length
      ? (session!.user as any).unitIds
      : (session!.user.unitId ? [session!.user.unitId] : [])
    if (unitIds.length === 0) return NextResponse.json([])

    const requestedUnit = searchParams.get('unitId')
    const effectiveUnit = requestedUnit && unitIds.includes(requestedUnit) ? requestedUnit : null

    const userFilter = { OR: [
      { userId: session!.user.id },
      { participants: { some: { userId: session!.user.id } } },
    ] }
    where.AND = effectiveUnit
      ? [userFilter, { unitId: effectiveUnit }]
      : [userFilter]
  } else {
    enforceUnitFilter(where, session!, searchParams.get('unitId'))
  }

  if (start || end) {
    where.startDate = {}
    if (start) where.startDate.gte = new Date(start)
    if (end) where.startDate.lte = new Date(end)
  }

  const events = await prisma.calendarEvent.findMany({
    where,
    include: { unit: true, user: { select: { id: true, name: true } }, ...participantsInclude },
    orderBy: { startDate: 'asc' },
  })

  return NextResponse.json(events)
}

export async function POST(req: NextRequest) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error

  const body = await req.json()

  const analystUnits: string[] = (session!.user as any).unitIds?.length
    ? (session!.user as any).unitIds
    : (session!.user.unitId ? [session!.user.unitId] : [])
  const unitId = session!.user.role === 'ANALYST'
    ? (analystUnits.includes(body.unitId) ? body.unitId : (analystUnits[0] ?? null))
    : body.unitId || null

  const participantIds: string[] = (body.participantIds ?? []).filter(
    (id: string) => id !== session!.user.id
  )

  const event = await prisma.calendarEvent.create({
    data: {
      title: body.title,
      description: body.description || null,
      pauta: body.pauta || null,
      meetingLink: body.meetingLink || null,
      startDate: new Date(body.startDate),
      endDate: new Date(body.endDate),
      allDay: body.allDay ?? false,
      eventType: body.eventType ?? 'OUTRO',
      reminders: body.reminders ?? [15, 5],
      unitId,
      userId: session!.user.id,
      participants: participantIds.length
        ? { create: participantIds.map((userId) => ({ userId })) }
        : undefined,
    },
    include: { unit: true, user: { select: { id: true, name: true } }, ...participantsInclude },
  })

  // Notifica todos os participantes do evento
  const notifyIds = [
    ...participantIds,
    // Se não houver participantes explícitos, notifica pela unidade (comportamento antigo)
  ]
  if (notifyIds.length > 0) {
    await notifyUsers(notifyIds, {
      type: 'CALENDAR', title: 'Você foi adicionado a um evento', body: event.title, href: `/calendario?eventId=${event.id}`,
    }, session!.user.id)
  }

  await log({
    userId: session!.user.id, userName: session!.user.name, userRole: session!.user.role,
    action: 'CREATE', entity: 'Evento', entityId: event.id, entityName: event.title,
    details: { tipo: event.eventType, inicio: event.startDate, fim: event.endDate, participantes: participantIds.length },
    ip: extractIp(req.headers),
  })

  return NextResponse.json(event, { status: 201 })
}
