import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionOrUnauthorized } from '@/lib/apiHelpers'
import { prisma } from '@/lib/prisma'
import { admissionProgressForEvent } from '@/lib/admission/tours/registry'
import { getAdmissionTour } from '@/lib/admission/tours/catalog'

const allowedRoles = new Set(['ADMIN', 'ANALYST', 'SUPERINTENDENT', 'GERENTE'])
const eventSchema = z.object({
  tourId: z.string().min(1).max(100),
  version: z.number().int().positive(),
  event: z.enum(['tour_started', 'tour_step_viewed', 'tour_skipped', 'tour_completed']),
  stepIndex: z.number().int().nonnegative().optional(),
  totalSteps: z.number().int().positive().max(30),
})

export async function GET() {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!allowedRoles.has(session!.user.role)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const progress = await prisma.admissionTourProgress.findMany({
    where: { userId: session!.user.id },
    select: { tourId: true, version: true, status: true, currentStep: true, totalSteps: true },
  })
  return NextResponse.json({ progress })
}

export async function POST(request: Request) {
  const { session, error } = await getSessionOrUnauthorized()
  if (error) return error
  if (!allowedRoles.has(session!.user.role)) return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })

  const parsed = eventSchema.safeParse(await request.json())
  if (!parsed.success) return NextResponse.json({ error: 'Evento inválido.' }, { status: 400 })
  const data = parsed.data
  const tour = getAdmissionTour(data.tourId)
  if (!tour || tour.version !== data.version || tour.steps.length !== data.totalSteps) {
    return NextResponse.json({ error: 'Tutorial inválido ou desatualizado.' }, { status: 400 })
  }
  if (tour.roles && !tour.roles.includes(session!.user.role)) {
    return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
  }

  const { status, currentStep } = admissionProgressForEvent(data.event, data.stepIndex, data.totalSteps)
  const now = new Date()
  await prisma.$transaction([
    prisma.admissionTourProgress.upsert({
      where: { userId_tourId_version: { userId: session!.user.id, tourId: data.tourId, version: data.version } },
      create: {
        userId: session!.user.id, tourId: data.tourId, version: data.version,
        status, currentStep, totalSteps: data.totalSteps,
        completedAt: status === 'COMPLETED' ? now : null,
      },
      update: {
        status, currentStep, totalSteps: data.totalSteps, lastViewedAt: now,
        completedAt: status === 'COMPLETED' ? now : null,
      },
    }),
    prisma.admissionTourEvent.create({
      data: {
        userId: session!.user.id, tourId: data.tourId, version: data.version,
        event: data.event, stepIndex: data.stepIndex,
      },
    }),
  ])
  return NextResponse.json({ ok: true })
}
