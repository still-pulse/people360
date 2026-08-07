import { PrismaClient, Role, TaskStatus, TaskPriority, EventType } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Iniciando seed...')

  // Unidades
  const units = await Promise.all([
    prisma.unit.upsert({
      where: { name: 'UPA Cumbica' },
      update: {},
      create: { name: 'UPA Cumbica', color: '#3B82F6', description: 'Unidade de Pronto Atendimento Cumbica' },
    }),
    prisma.unit.upsert({
      where: { name: 'UPA Akira' },
      update: {},
      create: { name: 'UPA Akira', color: '#10B981', description: 'Unidade de Pronto Atendimento Akira' },
    }),
    prisma.unit.upsert({
      where: { name: 'PSI' },
      update: {},
      create: { name: 'PSI', color: '#8B5CF6', description: 'Pronto Socorro Infantil' },
    }),
    prisma.unit.upsert({
      where: { name: 'HMCA' },
      update: {},
      create: { name: 'HMCA', color: '#F59E0B', description: 'Hospital Municipal de Campinas' },
    }),
  ])

  console.log(`✅ ${units.length} unidades criadas`)

  // Cargos
  const positionNames = [
    'Enfermeiro(a)',
    'Técnico(a) de Enfermagem',
    'Médico(a)',
    'Recepcionista',
    'Copeira',
    'Auxiliar Administrativo',
    'Auxiliar de Limpeza',
    'Farmacêutico(a)',
    'Assistente Social',
    'Psicólogo(a)',
  ]

  const positions = await Promise.all(
    positionNames.map((name) =>
      prisma.position.upsert({
        where: { id: name },
        update: {},
        create: { id: name, name },
      })
    )
  )

  console.log(`✅ ${positions.length} cargos criados`)

  // Usuários
  const adminPassword = await bcrypt.hash('admin123', 12)
  const analystPassword = await bcrypt.hash('analista123', 12)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@bhcl.com.br' },
    update: {},
    create: {
      name: 'Administrador BHCL',
      email: 'admin@bhcl.com.br',
      password: adminPassword,
      role: Role.ADMIN,
    },
  })

  const analyst = await prisma.user.upsert({
    where: { email: 'analista@bhcl.com.br' },
    update: { unitId: units[0].id },   // garante unitId mesmo em re-seed
    create: {
      name: 'Ana Silva',
      email: 'analista@bhcl.com.br',
      password: analystPassword,
      role: Role.ANALYST,
      unitId: units[0].id,
    },
  })

  const analyst2 = await prisma.user.upsert({
    where: { email: 'analista2@bhcl.com.br' },
    update: { unitId: units[1].id },   // garante unitId mesmo em re-seed
    create: {
      name: 'Carlos Santos',
      email: 'analista2@bhcl.com.br',
      password: analystPassword,
      role: Role.ANALYST,
      unitId: units[1].id,
    },
  })

  console.log(`✅ Usuários criados: ${admin.email}, ${analyst.email}, ${analyst2.email}`)

  // Dados de indicadores para os últimos 6 meses
  const now = new Date()
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    return { year: d.getFullYear(), month: d.getMonth() + 1 }
  }).reverse()

  for (const unit of units) {
    for (const { year, month } of months) {
      const totalEmployees = Math.floor(Math.random() * 100) + 150

      // PCD
      await prisma.pCDIndicator.upsert({
        where: { unitId_year_month: { unitId: unit.id, year, month } },
        update: {},
        create: {
          unitId: unit.id,
          year,
          month,
          totalEmployees,
          metaPercentage: 5,
          currentPcd: Math.floor(Math.random() * 12) + 5,
        },
      })

      // Aprendiz
      await prisma.apprenticeIndicator.upsert({
        where: { unitId_year_month: { unitId: unit.id, year, month } },
        update: {},
        create: {
          unitId: unit.id,
          year,
          month,
          totalEmployees,
          requiredCount: Math.floor(totalEmployees * 0.05),
          currentCount: Math.floor(Math.random() * 10) + 3,
        },
      })

      // Turnover
      const admissions = Math.floor(Math.random() * 15) + 2
      const dismissals = Math.floor(Math.random() * 12) + 1
      await prisma.turnoverIndicator.upsert({
        where: { unitId_year_month: { unitId: unit.id, year, month } },
        update: {},
        create: {
          unitId: unit.id,
          year,
          month,
          admissions,
          dismissals,
          headcountStart: totalEmployees,
          headcountEnd: totalEmployees + admissions - dismissals,
        },
      })

      // Absenteísmo
      await prisma.absenteeismIndicator.upsert({
        where: { unitId_year_month: { unitId: unit.id, year, month } },
        update: {},
        create: {
          unitId: unit.id,
          year,
          month,
          totalCertificates: Math.floor(Math.random() * 20) + 5,
          totalDaysLost: Math.floor(Math.random() * 40) + 10,
          totalEmployees,
          workingDaysInMonth: 22,
        },
      })

      // Headcount
      for (const position of positions.slice(0, 5)) {
        await prisma.headcountEntry.upsert({
          where: { unitId_positionId_year_month: { unitId: unit.id, positionId: position.id, year, month } },
          update: {},
          create: {
            unitId: unit.id,
            positionId: position.id,
            year,
            month,
            count: Math.floor(Math.random() * 20) + 5,
          },
        })
      }
    }
  }

  console.log('✅ Indicadores de exemplo criados')

  // Tarefas Kanban de exemplo
  const taskData = [
    { title: 'Processo Seletivo Enfermeiros UPA Cumbica', status: TaskStatus.IN_PROGRESS, priority: TaskPriority.HIGH, unitId: units[0].id },
    { title: 'Atualizar planilha de PCD - Abril', status: TaskStatus.TODO, priority: TaskPriority.MEDIUM, unitId: units[1].id },
    { title: 'Treinamento integração novos colaboradores', status: TaskStatus.BACKLOG, priority: TaskPriority.LOW, unitId: units[2].id },
    { title: 'Enviar relatório mensal para gestão', status: TaskStatus.WAITING, priority: TaskPriority.URGENT, unitId: units[0].id },
    { title: 'Atualizar cadastros HMCA', status: TaskStatus.DONE, priority: TaskPriority.MEDIUM, unitId: units[3].id },
    { title: 'Revisão de contratos aprendizes', status: TaskStatus.TODO, priority: TaskPriority.HIGH, unitId: units[2].id },
  ]

  for (let i = 0; i < taskData.length; i++) {
    const task = taskData[i]
    await prisma.task.create({
      data: {
        ...task,
        responsibleId: i % 2 === 0 ? analyst.id : analyst2.id,
        position: i,
        dueDate: new Date(Date.now() + (i + 1) * 7 * 24 * 60 * 60 * 1000),
      },
    })
  }

  console.log(`✅ ${taskData.length} tarefas de exemplo criadas`)

  // Eventos de calendário de exemplo
  const eventTypes = [EventType.PROCESSO_SELETIVO, EventType.REUNIAO, EventType.TREINAMENTO, EventType.VISITA]
  const eventTitles = ['Processo Seletivo Técnicos', 'Reunião de Equipe', 'Treinamento NR-32', 'Visita às Unidades', 'Integração de Colaboradores']

  for (let i = 0; i < 8; i++) {
    const startDate = new Date(now.getFullYear(), now.getMonth(), Math.floor(Math.random() * 20) + 1, 9)
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000)
    await prisma.calendarEvent.create({
      data: {
        title: eventTitles[i % eventTitles.length],
        description: 'Evento de exemplo',
        startDate,
        endDate,
        eventType: eventTypes[i % eventTypes.length],
        unitId: units[i % units.length].id,
        userId: i % 2 === 0 ? analyst.id : analyst2.id,
      },
    })
  }

  console.log('✅ Eventos de calendário criados')
  console.log('\n🎉 Seed concluído!')
  console.log('📧 Login Admin:   admin@bhcl.com.br    / admin123')
  console.log('📧 Login Analista: analista@bhcl.com.br / analista123')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
