import type { AdmissionTour, AdmissionTourStep } from './types'

const step = (
  element: AdmissionTourStep['element'],
  title: string,
  description: string,
  options: Pick<AdmissionTourStep, 'side' | 'align'> = {},
): AdmissionTourStep => ({ element, title, description, ...options })

export const admissionOverviewTour: AdmissionTour = {
  id: 'admission-overview',
  version: 1,
  name: 'Conhecendo a Admissão Digital',
  description: 'Entenda indicadores, pendências e os principais atalhos do módulo.',
  category: 'Primeiros passos',
  estimatedTime: 75,
  keywords: ['início', 'dashboard', 'indicadores', 'visão geral'],
  route: '/admissao-digital',
  onboarding: true,
  steps: [
    step('[data-admission-tour="overview-heading"]', 'Visão geral', 'Este painel resume o andamento de todas as admissões no período selecionado.'),
    step('[data-admission-tour="overview-actions"]', 'Ações rápidas', 'Atualize os dados, importe candidatos aprovados ou inicie uma nova admissão.', { side: 'bottom', align: 'end' }),
    step('[data-admission-tour="overview-indicators"]', 'Indicadores', 'Os cartões mostram volume, andamento, documentos, assinatura, conclusão e falhas no ERPNext.'),
    step('[data-admission-tour="overview-stages"]', 'Etapas e unidades', 'Compare a distribuição do trabalho por etapa e por unidade.'),
    step('[data-admission-tour="overview-attention"]', 'Exige atenção', 'Comece por estes processos: eles estão parados, possuem correção ou erro de integração.'),
    step('[data-admission-tour="overview-recent"]', 'Rastreabilidade', 'As atividades recentes ajudam a acompanhar o que aconteceu e quem executou cada ação.'),
  ],
}

export const admissionTours: AdmissionTour[] = [
  admissionOverviewTour,
  {
    id: 'admission-list', version: 1, name: 'Como localizar e acompanhar admissões',
    description: 'Use busca, filtros, tabela e ações em lote com segurança.', category: 'Operação', estimatedTime: 65,
    keywords: ['buscar', 'filtro', 'lista', 'status', 'lote'], route: '/admissao-digital/admissoes',
    steps: [
      step('[data-admission-tour="list-heading"]', 'Lista de admissões', 'Veja os processos permitidos para seu perfil e abra os detalhes de cada candidato.'),
      step('[data-admission-tour="list-filters"]', 'Busca e filtros', 'Pesquise candidato, CPF ou vaga e combine filtros de status, unidade, responsável e período.'),
      step('[data-admission-tour="list-table"]', 'Situação completa', 'A tabela reúne etapa, pendências, última atividade e situação da integração com o ERPNext.'),
      step('[data-admission-tour="list-pagination"]', 'Paginação', 'Os dados são carregados em páginas para manter o módulo rápido mesmo com muitos processos.'),
    ],
  },
  {
    id: 'admission-create', version: 1, name: 'Como criar uma nova admissão',
    description: 'Passe pelas cinco etapas e gere o link seguro do candidato.', category: 'Operação', estimatedTime: 100,
    keywords: ['nova admissão', 'candidato', 'contratação', 'link'], route: '/admissao-digital/admissoes/nova',
    steps: [
      step('[data-admission-tour="new-heading"]', 'Nova admissão', 'Use um candidato aprovado existente ou faça o cadastro manual.'),
      step('[data-admission-tour="new-stepper"]', 'Cinco etapas', 'Informe candidato, vaga, contratação, documentos e revise antes de criar.'),
      step('[data-admission-tour="new-form"]', 'Dados do processo', 'Os campos mudam conforme a etapa. Informações contratuais não podem ser alteradas pelo candidato.'),
      step('[data-admission-tour="new-actions"]', 'Salvar e avançar', 'Revise cada etapa. No final, o sistema cria um token seguro e informa a validade do link.'),
    ],
  },
  {
    id: 'admission-pending', version: 1, name: 'Como tratar pendências',
    description: 'Priorize processos parados em lista, kanban, unidade ou responsável.', category: 'Análise', estimatedTime: 55,
    keywords: ['pendência', 'kanban', 'prioridade', 'responsável'], route: '/admissao-digital/pendencias',
    steps: [
      step('[data-admission-tour="pending-heading"]', 'Painel de pendências', 'Aqui aparecem os processos que exigem intervenção do RH.'),
      step('[data-admission-tour="pending-views"]', 'Escolha a visualização', 'Alterne entre lista, kanban, unidade e responsável conforme sua rotina.'),
      step('[data-admission-tour="pending-content"]', 'Ação recomendada', 'Cada item informa motivo, tempo parado, prioridade, responsável e o próximo passo sugerido.'),
    ],
  },
  {
    id: 'admission-document-review', version: 1, name: 'Como revisar documentos',
    description: 'Analise, aprove, reprove ou solicite reenvio sem sair da fila.', category: 'Análise', estimatedTime: 75,
    keywords: ['documento', 'aprovar', 'reprovar', 'reenvio', 'fila'], route: '/admissao-digital/revisao',
    steps: [
      step('[data-admission-tour="review-queue"]', 'Fila de revisão', 'Selecione um documento enviado. A fila avança sem recarregar toda a página.'),
      step('[data-admission-tour="review-viewer"]', 'Visualizador seguro', 'Amplie ou gire o arquivo para conferir legibilidade e integridade.'),
      step('[data-admission-tour="review-actions"]', 'Decisão do revisor', 'Aprove ou informe um motivo obrigatório para reprovar ou solicitar reenvio.'),
    ],
  },
]

export function getAdmissionTour(id: string) {
  return admissionTours.find((tour) => tour.id === id)
}
