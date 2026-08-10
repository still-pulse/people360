import type { Role, TaskStatus, TaskPriority, EventType, VagaStatus, TipoVaga, PeriodoTrabalho, CandidatoStatus, TipoRequisicao, TipoContrato, TipoRecrutamento, ControleCandidatoStatus } from '@prisma/client'

export type { Role, TaskStatus, TaskPriority, EventType, VagaStatus, TipoVaga, PeriodoTrabalho, CandidatoStatus, TipoRequisicao, TipoContrato, TipoRecrutamento, ControleCandidatoStatus }

export interface UserSession {
  id: string
  name: string
  email: string
  role: Role
  unitId?: string | null
}

export interface UnitData {
  id: string
  name: string
  color: string
  description?: string | null
  active: boolean
}

export interface CalendarEventData {
  id: string
  title: string
  description?: string | null
  startDate: Date | string
  endDate: Date | string
  allDay: boolean
  eventType: EventType
  unitId?: string | null
  userId: string
  unit?: UnitData | null
  user?: { id: string; name: string }
}

export interface TaskData {
  id: string
  title: string
  description?: string | null
  status: TaskStatus
  priority: TaskPriority
  position: number
  dueDate?: Date | string | null
  responsibleId?: string | null
  unitId?: string | null
  createdAt: Date | string
  updatedAt: Date | string
  responsible?: { id: string; name: string } | null
  unit?: UnitData | null
  comments?: TaskCommentData[]
  history?: TaskHistoryData[]
}

export interface TaskCommentData {
  id: string
  taskId: string
  userId: string
  content: string
  createdAt: Date | string
  user?: { id: string; name: string }
}

export interface TaskHistoryData {
  id: string
  taskId: string
  userId: string
  fromStatus: TaskStatus
  toStatus: TaskStatus
  createdAt: Date | string
  user?: { id: string; name: string }
}

export interface PCDIndicatorData {
  id: string
  unitId: string
  year: number
  month: number
  totalEmployees: number
  metaPercentage: number
  currentPcd: number
  unit?: UnitData
}

export interface PcdWeeklySnapshotData {
  id: string
  unitId: string
  year: number
  month: number
  weekDate: string
  totalEmployees: number
  metaPercentage: number
  currentPcd: number
  unit?: UnitData
}

export interface ApprenticeIndicatorData {
  id: string
  unitId: string
  year: number
  month: number
  totalEmployees: number
  requiredCount: number
  currentCount: number
  unit?: UnitData
}

export interface TurnoverIndicatorData {
  id: string
  unitId: string
  year: number
  month: number
  admissions: number
  dismissals: number
  headcountStart: number
  headcountEnd: number
  unit?: UnitData
}

export interface AbsenteeismIndicatorData {
  id: string
  unitId: string
  year: number
  month: number
  totalCertificates: number
  totalDaysLost: number
  totalEmployees: number
  workingDaysInMonth: number
  unit?: UnitData
}

export interface HeadcountEntryData {
  id: string
  unitId: string
  positionId: string
  year: number
  month: number
  count: number
  unit?: UnitData
  position?: { id: string; name: string }
}

export interface PositionData {
  id: string
  name: string
  active: boolean
}

export interface DashboardStats {
  totalEmployees: number
  totalPcd: number
  totalApprentices: number
  turnoverRate: number
  absenteeismDays: number
  totalUnits: number
  pcdByUnit: { unitName: string; color: string; current: number; required: number }[]
  turnoverTrend: { month: string; [unitName: string]: number | string }[]
  headcountByUnit: { name: string; value: number; color: string }[]
}

export interface PositionData {
  id: string
  name: string
  codigoInterno?: string | null
  categoria?: string | null
  active: boolean
  createdAt: string
  updatedAt?: string
  aliases?: { id: string; alias: string }[]
  _count?: { vagas: number }
}

export interface VagaData {
  id: string
  titulo: string
  unidadeId?: string | null
  municipio?: string | null
  cargo: string
  cargoId?: string | null
  cargo_rel?: { id: string; name: string } | null
  controleCandidatoId?: string | null
  controleCandidato?: { id: string; nome: string; telefone?: string | null; funcao?: string } | null
  setor?: string | null
  quantidade: number
  tipoVaga: TipoVaga
  periodoTrabalho?: PeriodoTrabalho | null
  cargaHoraria?: string | null
  horarioTrabalho?: string | null
  escala?: string | null
  plantaoColaboradorSaiu?: string | null
  salarioMin?: number | null
  salarioMax?: number | null
  tipoRequisicao?: TipoRequisicao | null
  tipoContrato?: TipoContrato | null
  tipoRecrutamento?: TipoRecrutamento | null
  nomeColaboradorSaiu?: string | null
  nomeColaborador?: string | null
  disponibilidadeHorario?: string | null
  vagaPcd?: boolean
  gestorRequisitante?: string | null
  setorRequisitante?: string | null
  numProcessoAdmissao?: string | null
  numProtocoloOnvio?: string | null
  requisicaoNextId?: string | null
  /** Status lido do ERPNext (Pending, Open & Approved, Rejected, …) */
  erpnextStatus?: string | null
  erpnextSyncedAt?: string | null
  dataAbertura: string
  dataPrevistaFechamento?: string | null
  dataFechamento?: string | null
  dataInicioIntegracao?: string | null
  status: VagaStatus
  observacoes?: string | null
  position: number
  createdAt: string
  updatedAt: string
  unit?: { id: string; name: string; color: string } | null
  analistas?: { id: string; name: string }[]
  candidatos?: CandidatoData[]
  historico?: VagaHistoricoData[]
  _count?: { candidatos: number }
}

export interface CandidatoData {
  id: string
  vagaId: string
  nome: string
  telefone?: string | null
  email?: string | null
  dataAprovacao?: string | null
  status: CandidatoStatus
  observacoes?: string | null
  cvFileName?: string | null
  cvOriginalName?: string | null
  createdAt: string
  updatedAt: string
}

export interface VagaHistoricoData {
  id: string
  vagaId: string
  userId?: string | null
  fromStatus?: VagaStatus | null
  toStatus?: VagaStatus | null
  descricao?: string | null
  createdAt: string
  user?: { id: string; name: string } | null
}

export const VAGA_STATUS_LABELS: Record<string, string> = {
  PENDENTE_APROVACAO: 'Pendente de Aprovação',
  REJEITADA: 'Rejeitada',
  ABERTA: 'Aberta',
  DIVULGACAO: 'Divulgação',
  TRIAGEM: 'Triagem',
  ENTREVISTAS: 'Entrevistas',
  ENCAMINHADA_GESTOR: 'Enc. ao Gestor',
  APROVADA_CONTRATACAO: 'Aprovada',
  ADMISSAO_EM_ANDAMENTO: 'Admissão em Andamento',
  CONTRATADA: 'Contratada',
  FECHADA: 'Fechada',
  CANCELADA: 'Cancelada',
}

export const VAGA_STATUS_COLORS: Record<string, string> = {
  PENDENTE_APROVACAO: '#F59E0B',
  REJEITADA: '#EF4444',
  ABERTA: '#15AFA4',
  DIVULGACAO: '#3B82F6',
  TRIAGEM: '#8B5CF6',
  ENTREVISTAS: '#F59E0B',
  ENCAMINHADA_GESTOR: '#F97316',
  APROVADA_CONTRATACAO: '#06B6D4',
  ADMISSAO_EM_ANDAMENTO: '#6366F1',
  CONTRATADA: '#10B981',
  FECHADA: '#6B7280',
  CANCELADA: '#EF4444',
}

export type AprovacaoTipo = 'SOLICITACAO_INFO' | 'RESPOSTA' | 'APROVACAO' | 'REJEICAO'

export const APROVACAO_TIPO_LABELS: Record<AprovacaoTipo, string> = {
  SOLICITACAO_INFO: 'Solicitação de Informações',
  RESPOSTA: 'Resposta da Analista',
  APROVACAO: 'Aprovação',
  REJEICAO: 'Rejeição',
}

export interface VagaAprovacaoComentarioData {
  id: string
  vagaId: string
  userId: string
  tipo: AprovacaoTipo
  mensagem: string
  createdAt: string
  user: { id: string; name: string }
}

export const TIPO_VAGA_LABELS: Record<TipoVaga, string> = {
  EFETIVO: 'Efetivo',
  TEMPORARIO: 'Temporário',
  ESTAGIO: 'Estágio',
  PJ: 'PJ',
  OUTROS: 'Outros',
}

export const PERIODO_LABELS: Record<PeriodoTrabalho, string> = {
  DIURNO: 'Diurno',
  NOTURNO: 'Noturno',
  MISTO: 'Misto',
  PLANTAO: 'Plantão',
}

export const TIPO_REQUISICAO_LABELS: Record<TipoRequisicao, string> = {
  SUBSTITUICAO: 'Substituição',
  AUMENTO_QUADRO: 'Aumento de Quadro',
}

export const TIPO_CONTRATO_LABELS: Record<TipoContrato, string> = {
  DETERMINADO: 'Determinado',
  INDETERMINADO: 'Indeterminado',
}

export const TIPO_RECRUTAMENTO_LABELS: Record<TipoRecrutamento, string> = {
  INTERNO: 'Interno',
  EXTERNO: 'Externo',
}

export const CANDIDATO_STATUS_LABELS: Record<CandidatoStatus, string> = {
  EM_PROCESSO: 'Em Processo',
  APROVADO: 'Aprovado',
  AGUARDANDO_ADMISSAO: 'Ag. Admissão',
  ADMITIDO: 'Admitido',
  DESISTENTE: 'Desistente',
  REPROVADO: 'Reprovado',
}

export const CANDIDATO_STATUS_COLORS: Record<CandidatoStatus, string> = {
  EM_PROCESSO: '#3B82F6',
  APROVADO: '#15AFA4',
  AGUARDANDO_ADMISSAO: '#F59E0B',
  ADMITIDO: '#10B981',
  DESISTENTE: '#94A3B8',
  REPROVADO: '#EF4444',
}

export const MONTHS_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'A Fazer',
  IN_PROGRESS: 'Em Andamento',
  WAITING: 'Aguardando Retorno',
  DONE: 'Concluído',
}

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: 'Baixa',
  MEDIUM: 'Média',
  HIGH: 'Alta',
  URGENT: 'Urgente',
}

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  PROCESSO_SELETIVO: 'Processo Seletivo',
  REUNIAO: 'Reunião',
  TREINAMENTO: 'Treinamento',
  VISITA: 'Visita',
  OUTRO: 'Outro',
}

// ─── Controle de Candidatos ──────────────────────────────────────────────────

export interface ControleCandidatoData {
  id: string
  nome: string
  telefone?: string | null
  funcao: string
  dataProcesso: string
  municipio?: string | null
  status: ControleCandidatoStatus
  observacoes?: string | null
  createdAt: string
  updatedAt: string
  analistas: { id: string; name: string }[]
}

export const CONTROLE_CANDIDATO_STATUS_LABELS: Record<ControleCandidatoStatus, string> = {
  REPROVADO: 'Reprovado',
  BANCO_TALENTOS: 'Banco de Talentos',
  CONTRATADO: 'Contratado',
  DESISTIU: 'Desistiu',
}

export interface CandidatosMonthSnapshotData {
  id: string
  year: number
  month: number
  reprovado: number
  bancoTalentos: number
  contratado: number
  desistiu: number
  total: number
  createdAt: string
  createdBy?: { id: string; name: string } | null
}

export const CONTROLE_CANDIDATO_STATUS_COLORS: Record<ControleCandidatoStatus, string> = {
  REPROVADO: '#EF4444',
  BANCO_TALENTOS: '#F59E0B',
  CONTRATADO: '#15AFA4',
  DESISTIU: '#94A3B8',
}

// ─── Pareceres de R&S ────────────────────────────────────────────────────────

export type ParecerResultado = 'APROVADO' | 'APROVADO_COM_RESTRICOES' | 'REPROVADO' | 'BANCO_TALENTOS'
export type TipoVinculoParecer = 'CLT' | 'ESTAGIO' | 'APRENDIZ' | 'PCD'

export interface ParecerCompetencias {
  curiosidade: number
  lideranca: number
  trabalhoEquipe: number
  visaoSistemica: number
  comunicacao: number
  relacaoInterpessoal: number
  negociacao: number
  desenvolver: number
  focoResultado: number
  flexibilidade: number
  criatividade: number
  empreendedorismo: number
  focoCliente: number
  compliance: number
}

export interface ParecerData {
  id: string
  codigo: string
  revisao: string
  razaoSocial: string
  cnpj: string
  unitId?: string | null
  controleCandidatoId?: string | null
  candidatoNome: string
  cargo: string
  dataAvaliacao: string
  idade?: number | null
  tipoVinculo: TipoVinculoParecer
  apresentacao: string[]
  verbalizacao: string[]
  tecnicas: string[]
  tecnicasOutros?: string | null
  traitEI: number
  traitNS: number
  traitTF: number
  traitJP: number
  traitAT: number
  competencias: ParecerCompetencias | Record<string, number>
  analiseTexto?: string | null
  resultado?: ParecerResultado | null
  dataAssinatura?: string | null
  elaboradorId?: string | null
  createdAt: string
  updatedAt: string
  unit?: { id: string; name: string; color: string } | null
  elaborador?: { id: string; name: string } | null
  controleCandidato?: {
    id: string
    nome: string
    funcao: string
    telefone?: string | null
    municipio?: string | null
    status: ControleCandidatoStatus
  } | null
}

export const PARECER_RESULTADO_LABELS: Record<ParecerResultado, string> = {
  APROVADO: 'Aprovado',
  APROVADO_COM_RESTRICOES: 'Aprovado com restrições',
  REPROVADO: 'Reprovado',
  BANCO_TALENTOS: 'Banco de Talentos/Futuras Vagas',
}

export const PARECER_RESULTADO_COLORS: Record<ParecerResultado, string> = {
  APROVADO: '#10B981',
  APROVADO_COM_RESTRICOES: '#F59E0B',
  REPROVADO: '#EF4444',
  BANCO_TALENTOS: '#3B82F6',
}

export const TIPO_VINCULO_PARECER_LABELS: Record<TipoVinculoParecer, string> = {
  CLT: 'CLT',
  ESTAGIO: 'Estágio',
  APRENDIZ: 'Aprendiz',
  PCD: 'PCD',
}

/**
 * Pares exclusivos de apresentação (um ou outro, ou nenhum).
 * left = polo “positivo/esquerdo” · right = polo oposto.
 */
export const PARECER_APRESENTACAO_PARES = [
  { id: 'ei', left: 'Extrovertido', right: 'Introvertido' },
  { id: 'ce', left: 'Calmo/Tranquilo', right: 'Agitado' },
  { id: 'et', left: 'Espontâneo', right: 'Tímido' },
  { id: 'ad', left: 'Atencioso', right: 'Desfocado' },
  { id: 'er', left: 'Educado', right: 'Ríspido' },
  { id: 'ra', left: 'Receptivo', right: 'Ansioso' },
] as const

/** Lista flat (compatível com registros antigos) */
export const PARECER_APRESENTACAO = PARECER_APRESENTACAO_PARES.flatMap((p) => [p.left, p.right])

/**
 * Pares exclusivos de verbalização (um ou outro, ou nenhum).
 * O item “Tranquila/segura” é opcional isolado.
 */
export const PARECER_VERBALIZACAO_PARES = [
  {
    id: 'expressar',
    left: 'Facilidade para expressar seu ponto de vista / Verbalização Clara e Objetiva',
    right: 'Dificuldade para expressar seu ponto de vista / Verbalização Confusa',
    leftShort: 'Expressão clara e objetiva',
    rightShort: 'Expressão confusa / dificuldade',
  },
  {
    id: 'ouvir',
    left: 'Facilidade para ouvir',
    right: 'Falta habilidade para ouvir',
    leftShort: 'Facilidade para ouvir',
    rightShort: 'Falta habilidade para ouvir',
  },
] as const

export const PARECER_VERBALIZACAO_EXTRA = 'Tranquila/segura' as const

/** Lista flat (compatível com registros antigos) */
export const PARECER_VERBALIZACAO = [
  ...PARECER_VERBALIZACAO_PARES.flatMap((p) => [p.left, p.right]),
  PARECER_VERBALIZACAO_EXTRA,
] as const

/** Técnicas utilizadas */
export const PARECER_TECNICAS = [
  'Entrevista por Competência Individual',
  'Dinâmica em grupo (foco competências)',
  'Entrevista por Competência em grupo',
  'Redação',
  'DISC',
  'Provas conhecimento específicos da área',
  'Polígrafo',
] as const

export type ParecerCompetenciaItem = { key: keyof ParecerCompetencias; label: string; short: string }

/** Grupo 1 — radar e lista da esquerda (comportamento / entrega) */
export const PARECER_COMPETENCIAS_G1: ParecerCompetenciaItem[] = [
  { key: 'curiosidade', label: 'Curiosidade e Espírito de Pesquisa', short: 'Curiosidade' },
  { key: 'trabalhoEquipe', label: 'Trabalho em Equipe', short: 'Equipe' },
  { key: 'comunicacao', label: 'Comunicação', short: 'Comunicação' },
  { key: 'negociacao', label: 'Negociação', short: 'Negociação' },
  { key: 'focoResultado', label: 'Foco no Resultado', short: 'Resultado' },
  { key: 'criatividade', label: 'Criatividade e Inovação', short: 'Criatividade' },
  { key: 'focoCliente', label: 'Foco no Cliente', short: 'Cliente' },
]

/** Grupo 2 — radar e lista da direita (liderança / sistema) */
export const PARECER_COMPETENCIAS_G2: ParecerCompetenciaItem[] = [
  { key: 'lideranca', label: 'Liderança & Coaching', short: 'Liderança' },
  { key: 'visaoSistemica', label: 'Visão Sistêmica', short: 'Visão Sist.' },
  { key: 'relacaoInterpessoal', label: 'Relação Interpessoal', short: 'Interpessoal' },
  { key: 'desenvolver', label: 'Desenvolver, Aplicar e Difundir', short: 'Desenvolver' },
  { key: 'flexibilidade', label: 'Flexibilidade & Adaptabilidade', short: 'Flexibilidade' },
  { key: 'empreendedorismo', label: 'Empreendedorismo', short: 'Empreend.' },
  { key: 'compliance', label: 'Compliance', short: 'Compliance' },
]

/** Competências de suporte (escala 1–5) — lista completa */
export const PARECER_COMPETENCIAS: ParecerCompetenciaItem[] = [
  ...PARECER_COMPETENCIAS_G1,
  ...PARECER_COMPETENCIAS_G2,
]

export const EMPTY_COMPETENCIAS: ParecerCompetencias = {
  curiosidade: 3,
  lideranca: 3,
  trabalhoEquipe: 3,
  visaoSistemica: 3,
  comunicacao: 3,
  relacaoInterpessoal: 3,
  negociacao: 3,
  desenvolver: 3,
  focoResultado: 3,
  flexibilidade: 3,
  criatividade: 3,
  empreendedorismo: 3,
  focoCliente: 3,
  compliance: 3,
}

/** Dimensões do perfil comportamental (estilo 16personalities) */
export const PARECER_TRAITS = [
  {
    key: 'traitEI' as const,
    left: 'Extravertido',
    right: 'Introvertido',
    color: '#4299E1',
    leftKey: 'E',
    rightKey: 'I',
  },
  {
    key: 'traitNS' as const,
    left: 'Intuitivo',
    right: 'Observador',
    color: '#D69E2E',
    leftKey: 'N',
    rightKey: 'S',
  },
  {
    key: 'traitTF' as const,
    left: 'Pensamento',
    right: 'Sentimento',
    color: '#48BB78',
    leftKey: 'T',
    rightKey: 'F',
  },
  {
    key: 'traitJP' as const,
    left: 'Julgamento',
    right: 'Prospecção',
    color: '#9F7AEA',
    leftKey: 'J',
    rightKey: 'P',
  },
  {
    key: 'traitAT' as const,
    left: 'Assertivo',
    right: 'Turbulento',
    color: '#F56565',
    leftKey: 'A',
    rightKey: 'T',
  },
]

export const COMPETENCIA_NIVEIS = [
  { value: 1, label: 'Inferior' },
  { value: 2, label: 'Médio Inferior' },
  { value: 3, label: 'Médio' },
  { value: 4, label: 'Médio Superior' },
  { value: 5, label: 'Superior' },
] as const

// ─── Controle de Admissão ────────────────────────────────────────────────────

export interface AdmissaoItem {
  id: string
  vagaId: string
  titulo: string
  cargo: string
  cargoRaw: string
  colaboradorNome: string
  telefone?: string | null
  email?: string | null
  municipio?: string | null
  setor?: string | null
  tipoVaga: TipoVaga
  tipoRequisicao?: TipoRequisicao | null
  tipoContrato?: TipoContrato | null
  tipoRecrutamento?: TipoRecrutamento | null
  vagaPcd?: boolean
  quantidade: number
  status: VagaStatus
  dataAbertura: string
  dataPrevistaFechamento?: string | null
  dataFechamento?: string | null
  dataInicioIntegracao?: string | null
  dataInicioEfetiva?: string | null
  dataInicioKey?: string | null
  diasAberturaAteInicio?: number | null
  numProcessoAdmissao?: string | null
  numProtocoloOnvio?: string | null
  gestorRequisitante?: string | null
  nomeColaboradorSaiu?: string | null
  observacoes?: string | null
  unit?: { id: string; name: string; color: string } | null
  analistas?: { id: string; name: string }[]
  controleCandidato?: { id: string; nome: string; telefone?: string | null; funcao?: string; status?: string } | null
  candidatos?: { id: string; nome: string; telefone?: string | null; email?: string | null; status: string; dataAprovacao?: string | null }[]
  createdAt: string
  updatedAt: string
}

export interface AdmissaoDashboardData {
  year: number
  month: number
  kpis: {
    totalContratados: number
    emAdmissao: number
    comDataInicio: number
    semDataInicio: number
    mediaDiasAteInicio: number | null
    pcd: number
    inicioHoje: number
    inicioProximos7: number
    inicioProximos30: number
    vsMesAnterior: number
    mesAnteriorTotal: number
    totalAno: number
  }
  porDia: { day: number; label: string; count: number; names: string[] }[]
  porMes: { month: number; label: string; labelFull: string; count: number }[]
  porUnidade: { name: string; color: string; value: number }[]
  porCargo: { cargo: string; count: number }[]
  porTipoVaga: { tipo: string; count: number }[]
  porTipoRequisicao: { tipo: string; count: number }[]
  porAnalista: { name: string; count: number }[]
  proximosInicios: {
    id: string
    colaboradorNome: string
    cargo: string
    dataInicio: string | null
    dataInicioKey: string | null
    unit?: { id: string; name: string; color: string } | null
    status: string
    municipio?: string | null
    titulo: string
  }[]
  recentes: {
    id: string
    colaboradorNome: string
    cargo: string
    dataInicio: string | null
    dataInicioKey: string | null
    dataFechamento?: string | null
    unit?: { id: string; name: string; color: string } | null
    status: string
    tipoVaga: string
    vagaPcd?: boolean
    numProcessoAdmissao?: string | null
    analistas?: { id: string; name: string }[]
  }[]
  rankingDias: {
    day: number
    dateKey: string
    label: string
    count: number
    names: string[]
  }[]
}
