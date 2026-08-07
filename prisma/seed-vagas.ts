import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Populando vagas...')

  const units = await prisma.unit.findMany()
  const analysts = await prisma.user.findMany({ where: { role: 'ANALYST' } })
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } })

  if (units.length === 0) { console.log('⚠️  Rode o seed principal primeiro'); return }

  const u = (name: string) => units.find((u) => u.name === name) ?? units[0]
  const a = (i: number) => analysts[i % analysts.length]

  const now = new Date()
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86400000)
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000)

  const vagasData = [
    // UPA Cumbica
    {
      titulo: 'Técnico de Enfermagem — UPA Cumbica',
      cargo: 'Técnico(a) de Enfermagem',
      setor: 'Enfermagem', municipio: 'Guarulhos',
      unidadeId: u('UPA Cumbica').id, analistaId: a(0).id,
      quantidade: 3, tipoVaga: 'EFETIVO', periodoTrabalho: 'PLANTAO',
      cargaHoraria: '36h semanais', escala: '12x36',
      salarioMin: 2200, salarioMax: 2800,
      status: 'ENTREVISTAS', position: 0,
      dataAbertura: daysAgo(20), dataPrevistaFechamento: daysFromNow(5),
      observacoes: 'Prioridade alta. Necessário COREN ativo.',
      candidatos: [
        { nome: 'Maria Fernanda Souza', telefone: '(11) 98765-4321', email: 'mfernanda@email.com', status: 'APROVADO', dataAprovacao: daysAgo(3) },
        { nome: 'João Carlos Lima', telefone: '(11) 97654-3210', email: 'jclima@email.com', status: 'EM_PROCESSO' },
        { nome: 'Patrícia Alves', telefone: '(11) 96543-2109', email: 'palves@email.com', status: 'REPROVADO' },
        { nome: 'Roberto Mendes', telefone: '(11) 95432-1098', email: 'rmendes@email.com', status: 'EM_PROCESSO' },
      ],
    },
    {
      titulo: 'Enfermeiro(a) Plantonista — UPA Cumbica',
      cargo: 'Enfermeiro(a)',
      setor: 'Enfermagem', municipio: 'Guarulhos',
      unidadeId: u('UPA Cumbica').id, analistaId: a(0).id,
      quantidade: 1, tipoVaga: 'EFETIVO', periodoTrabalho: 'NOTURNO',
      cargaHoraria: '36h semanais', escala: '12x36',
      salarioMin: 4500, salarioMax: 5500,
      status: 'TRIAGEM', position: 1,
      dataAbertura: daysAgo(10), dataPrevistaFechamento: daysFromNow(20),
      candidatos: [
        { nome: 'Ana Paula Rocha', telefone: '(11) 94321-0987', email: 'anapaula@email.com', status: 'EM_PROCESSO' },
        { nome: 'Carlos Eduardo', telefone: '(11) 93210-9876', email: 'ceduardo@email.com', status: 'EM_PROCESSO' },
        { nome: 'Luciana Batista', telefone: '(11) 92109-8765', email: 'lbatista@email.com', status: 'DESISTENTE' },
      ],
    },
    {
      titulo: 'Recepcionista — UPA Cumbica',
      cargo: 'Recepcionista',
      setor: 'Administrativo', municipio: 'Guarulhos',
      unidadeId: u('UPA Cumbica').id, analistaId: a(0).id,
      quantidade: 2, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '44h semanais', escala: '6x1',
      salarioMin: 1800, salarioMax: 2100,
      status: 'CONTRATADA', position: 0,
      dataAbertura: daysAgo(45), dataPrevistaFechamento: daysAgo(5),
      dataFechamento: daysAgo(3),
      candidatos: [
        { nome: 'Silvia Cristina', telefone: '(11) 91098-7654', email: 'scristina@email.com', status: 'ADMITIDO', dataAprovacao: daysAgo(10) },
        { nome: 'Marcos Vinícius', telefone: '(11) 90987-6543', email: 'mvinicio@email.com', status: 'ADMITIDO', dataAprovacao: daysAgo(10) },
        { nome: 'Fernanda Lima', telefone: '(11) 99876-5432', email: 'flima@email.com', status: 'REPROVADO' },
      ],
    },
    {
      titulo: 'Médico(a) Clínico — UPA Cumbica',
      cargo: 'Médico(a)',
      setor: 'Pronto-Atendimento', municipio: 'Guarulhos',
      unidadeId: u('UPA Cumbica').id, analistaId: a(0).id,
      quantidade: 1, tipoVaga: 'PJ', periodoTrabalho: 'PLANTAO',
      cargaHoraria: '24h plantão', escala: '12x36',
      salarioMin: 12000, salarioMax: 18000,
      status: 'DIVULGACAO', position: 0,
      dataAbertura: daysAgo(5), dataPrevistaFechamento: daysFromNow(30),
      candidatos: [],
    },

    // UPA Akira
    {
      titulo: 'Técnico(a) de Enfermagem — UPA Akira',
      cargo: 'Técnico(a) de Enfermagem',
      setor: 'Enfermagem', municipio: 'Osasco',
      unidadeId: u('UPA Akira').id, analistaId: a(1).id,
      quantidade: 2, tipoVaga: 'EFETIVO', periodoTrabalho: 'MISTO',
      cargaHoraria: '36h semanais', escala: '12x36',
      salarioMin: 2200, salarioMax: 2700,
      status: 'ENCAMINHADA_GESTOR', position: 0,
      dataAbertura: daysAgo(30), dataPrevistaFechamento: daysFromNow(3),
      observacoes: 'Aguardando aprovação do gestor para contratação.',
      candidatos: [
        { nome: 'Tatiane Oliveira', telefone: '(11) 88765-4321', email: 'tatiane@email.com', status: 'APROVADO', dataAprovacao: daysAgo(5) },
        { nome: 'Diego Santos', telefone: '(11) 87654-3210', email: 'dsantos@email.com', status: 'APROVADO', dataAprovacao: daysAgo(5) },
        { nome: 'Priscila Nunes', telefone: '(11) 86543-2109', email: 'pnunes@email.com', status: 'REPROVADO' },
      ],
    },
    {
      titulo: 'Auxiliar Administrativo — UPA Akira',
      cargo: 'Auxiliar Administrativo',
      setor: 'Administrativo', municipio: 'Osasco',
      unidadeId: u('UPA Akira').id, analistaId: a(1).id,
      quantidade: 1, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '44h semanais', escala: '5x2',
      salarioMin: 1600, salarioMax: 1900,
      status: 'ABERTA', position: 0,
      dataAbertura: daysAgo(2), dataPrevistaFechamento: daysFromNow(45),
      candidatos: [],
    },
    {
      titulo: 'Farmacêutico(a) — UPA Akira',
      cargo: 'Farmacêutico(a)',
      setor: 'Farmácia', municipio: 'Osasco',
      unidadeId: u('UPA Akira').id, analistaId: a(1).id,
      quantidade: 1, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '44h semanais', escala: '5x2',
      salarioMin: 4000, salarioMax: 5000,
      status: 'APROVADA_CONTRATACAO', position: 0,
      dataAbertura: daysAgo(25), dataPrevistaFechamento: daysFromNow(7),
      candidatos: [
        { nome: 'Rafaela Costa', telefone: '(11) 85432-1098', email: 'rcosta@email.com', status: 'AGUARDANDO_ADMISSAO', dataAprovacao: daysAgo(7) },
        { nome: 'Bruno Azevedo', telefone: '(11) 84321-0987', email: 'bazevedo@email.com', status: 'REPROVADO' },
      ],
    },

    // PSI
    {
      titulo: 'Psicólogo(a) Clínico — PSI',
      cargo: 'Psicólogo(a)',
      setor: 'Saúde Mental', municipio: 'São Paulo',
      unidadeId: u('PSI').id, analistaId: a(0).id,
      quantidade: 2, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '30h semanais', escala: '5x2',
      salarioMin: 3800, salarioMax: 5200,
      status: 'ENTREVISTAS', position: 0,
      dataAbertura: daysAgo(15), dataPrevistaFechamento: daysFromNow(15),
      candidatos: [
        { nome: 'Isabela Martins', telefone: '(11) 83210-9876', email: 'imartins@email.com', status: 'EM_PROCESSO' },
        { nome: 'Gabriel Ferreira', telefone: '(11) 82109-8765', email: 'gferreira@email.com', status: 'EM_PROCESSO' },
        { nome: 'Camila Torres', telefone: '(11) 81098-7654', email: 'ctorres@email.com', status: 'EM_PROCESSO' },
        { nome: 'Renato Carvalho', telefone: '(11) 80987-6543', email: 'rcarvalho@email.com', status: 'DESISTENTE' },
      ],
    },
    {
      titulo: 'Assistente Social — PSI',
      cargo: 'Assistente Social',
      setor: 'Serviço Social', municipio: 'São Paulo',
      unidadeId: u('PSI').id, analistaId: a(0).id,
      quantidade: 1, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '30h semanais', escala: '5x2',
      salarioMin: 3200, salarioMax: 4000,
      status: 'FECHADA', position: 0,
      dataAbertura: daysAgo(60), dataPrevistaFechamento: daysAgo(15),
      dataFechamento: daysAgo(12),
      candidatos: [
        { nome: 'Vanessa Ribeiro', telefone: '(11) 79876-5432', email: 'vribeiro@email.com', status: 'ADMITIDO', dataAprovacao: daysAgo(18) },
        { nome: 'Paulo Henrique', telefone: '(11) 78765-4321', email: 'phenrique@email.com', status: 'REPROVADO' },
      ],
    },

    // HMCA
    {
      titulo: 'Enfermeiro(a) UTI — HMCA',
      cargo: 'Enfermeiro(a)',
      setor: 'UTI', municipio: 'Campinas',
      unidadeId: u('HMCA').id, analistaId: a(1).id,
      quantidade: 4, tipoVaga: 'EFETIVO', periodoTrabalho: 'PLANTAO',
      cargaHoraria: '36h semanais', escala: '12x36',
      salarioMin: 5500, salarioMax: 7000,
      status: 'TRIAGEM', position: 0,
      dataAbertura: daysAgo(8), dataPrevistaFechamento: daysFromNow(25),
      observacoes: 'Experiência mínima de 2 anos em UTI. Especialização desejável.',
      candidatos: [
        { nome: 'Alexandre Gomes', telefone: '(19) 98765-4321', email: 'agomes@email.com', status: 'EM_PROCESSO' },
        { nome: 'Natália Pereira', telefone: '(19) 97654-3210', email: 'npereira@email.com', status: 'EM_PROCESSO' },
        { nome: 'Thiago Ramos', telefone: '(19) 96543-2109', email: 'tramos@email.com', status: 'EM_PROCESSO' },
      ],
    },
    {
      titulo: 'Técnico(a) Radiologia — HMCA',
      cargo: 'Técnico(a) de Radiologia',
      setor: 'Diagnóstico por Imagem', municipio: 'Campinas',
      unidadeId: u('HMCA').id, analistaId: a(1).id,
      quantidade: 1, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '44h semanais', escala: '6x1',
      salarioMin: 2800, salarioMax: 3500,
      status: 'ABERTA', position: 1,
      dataAbertura: daysAgo(3), dataPrevistaFechamento: daysFromNow(40),
      candidatos: [],
    },
    {
      titulo: 'Copeira — HMCA',
      cargo: 'Copeira',
      setor: 'Nutrição e Dietética', municipio: 'Campinas',
      unidadeId: u('HMCA').id, analistaId: a(1).id,
      quantidade: 2, tipoVaga: 'EFETIVO', periodoTrabalho: 'DIURNO',
      cargaHoraria: '44h semanais', escala: '6x1',
      salarioMin: 1500, salarioMax: 1800,
      status: 'CANCELADA', position: 0,
      dataAbertura: daysAgo(30), dataPrevistaFechamento: daysAgo(10),
      dataFechamento: daysAgo(8),
      observacoes: 'Vaga cancelada por reestruturação do setor.',
      candidatos: [],
    },
    {
      titulo: 'Médico(a) Pediatra — HMCA',
      cargo: 'Médico(a) Pediatra',
      setor: 'Pediatria', municipio: 'Campinas',
      unidadeId: u('HMCA').id, analistaId: a(1).id,
      quantidade: 1, tipoVaga: 'PJ', periodoTrabalho: 'DIURNO',
      cargaHoraria: '20h semanais', escala: '5x2',
      salarioMin: 15000, salarioMax: 22000,
      status: 'DIVULGACAO', position: 0,
      dataAbertura: daysAgo(4), dataPrevistaFechamento: daysFromNow(50),
      candidatos: [],
    },
  ] as any[]

  let count = 0
  for (const vd of vagasData) {
    const { candidatos: cands, ...vagaFields } = vd
    const vaga = await prisma.vaga.create({ data: vagaFields })

    // Histórico de abertura
    await prisma.vagaHistorico.create({
      data: {
        vagaId: vaga.id,
        userId: admin?.id,
        toStatus: 'ABERTA',
        descricao: 'Vaga aberta',
        createdAt: vd.dataAbertura,
      },
    })

    // Histórico de movimentações intermediárias
    const statusFlow: Record<string, string[]> = {
      DIVULGACAO: ['ABERTA', 'DIVULGACAO'],
      TRIAGEM: ['ABERTA', 'DIVULGACAO', 'TRIAGEM'],
      ENTREVISTAS: ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS'],
      ENCAMINHADA_GESTOR: ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR'],
      APROVADA_CONTRATACAO: ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO'],
      CONTRATADA: ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO', 'CONTRATADA'],
      FECHADA: ['ABERTA', 'DIVULGACAO', 'TRIAGEM', 'ENTREVISTAS', 'ENCAMINHADA_GESTOR', 'APROVADA_CONTRATACAO', 'CONTRATADA', 'FECHADA'],
      CANCELADA: ['ABERTA', 'CANCELADA'],
    }

    const flow = statusFlow[vd.status] ?? []
    const stepDays = Math.floor((Date.now() - vd.dataAbertura.getTime()) / flow.length / 86400000)
    for (let i = 1; i < flow.length; i++) {
      await prisma.vagaHistorico.create({
        data: {
          vagaId: vaga.id,
          userId: vd.analistaId,
          fromStatus: flow[i - 1] as any,
          toStatus: flow[i] as any,
          descricao: `Status alterado: ${flow[i - 1]} → ${flow[i]}`,
          createdAt: new Date(vd.dataAbertura.getTime() + i * stepDays * 86400000),
        },
      })
    }

    // Candidatos
    for (const c of cands ?? []) {
      await prisma.candidato.create({
        data: {
          vagaId: vaga.id,
          nome: c.nome,
          telefone: c.telefone,
          email: c.email,
          status: c.status,
          dataAprovacao: c.dataAprovacao ?? null,
          observacoes: null,
        },
      })
    }

    count++
  }

  console.log(`✅ ${count} vagas criadas com candidatos e histórico`)
  console.log('🎉 Seed de vagas concluído!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
