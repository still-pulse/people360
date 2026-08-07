import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🗑️  Limpando todos os dados de seed...')

  // Apaga na ordem correta respeitando as foreign keys
  await prisma.auditLog.deleteMany()
  await prisma.notification.deleteMany()
  await prisma.chamadoAnexo.deleteMany()
  await prisma.chamadoMensagem.deleteMany()
  await prisma.chamado.deleteMany()
  await prisma.candidato.deleteMany()
  await prisma.vagaHistorico.deleteMany()
  await prisma.vaga.deleteMany()
  await prisma.taskComment.deleteMany()
  await prisma.taskHistory.deleteMany()
  await prisma.task.deleteMany()
  await prisma.calendarEvent.deleteMany()
  await prisma.headcountEntry.deleteMany()
  await prisma.pCDIndicator.deleteMany()
  await prisma.apprenticeIndicator.deleteMany()
  await prisma.turnoverIndicator.deleteMany()
  await prisma.absenteeismIndicator.deleteMany()
  await prisma.systemSettings.deleteMany()
  await prisma.user.deleteMany()
  await prisma.position.deleteMany()
  await prisma.unit.deleteMany()

  console.log('✅ Todos os dados apagados.')

  // Recria apenas o admin para não ficar sem acesso
  const hashed = await bcrypt.hash('admin123', 12)
  await prisma.user.create({
    data: {
      name:     'Administrador',
      email:    'admin@bhcl.com.br',
      password: hashed,
      role:     'ADMIN',
    },
  })

  console.log('✅ Admin recriado: admin@bhcl.com.br / admin123')
  console.log('')
  console.log('⚠️  IMPORTANTE: altere a senha do admin no primeiro acesso!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
