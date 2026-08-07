import {
  LogIn, LogOut, Plus, Pencil, Trash2, MoveRight, Upload, X,
  ShieldCheck, ShieldOff, KeyRound, UserCheck, UserX, RefreshCw,
  CheckCircle2, MessageSquare, Link2, Link2Off, Eye, Mail,
} from 'lucide-react'

export const ACTION_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  LOGIN:            { label: 'Login',           icon: LogIn,       color: 'text-green-600 bg-green-50' },
  LOGOUT:           { label: 'Logout',          icon: LogOut,      color: 'text-gray-600 bg-gray-100' },
  LOGIN_FAILED:     { label: 'Falha de login',  icon: X,           color: 'text-red-600 bg-red-50' },
  CREATE:           { label: 'Criação',         icon: Plus,        color: 'text-blue-600 bg-blue-50' },
  UPDATE:           { label: 'Edição',          icon: Pencil,      color: 'text-amber-600 bg-amber-50' },
  DELETE:           { label: 'Exclusão',        icon: Trash2,      color: 'text-red-600 bg-red-50' },
  MOVE:             { label: 'Movimentação',    icon: MoveRight,   color: 'text-purple-600 bg-purple-50' },
  UPLOAD:           { label: 'Upload',          icon: Upload,      color: 'text-teal-600 bg-teal-50' },
  REMOVE:           { label: 'Remoção arquivo', icon: X,           color: 'text-orange-600 bg-orange-50' },
  ENABLE:           { label: 'Ativação',        icon: UserCheck,   color: 'text-green-600 bg-green-50' },
  DISABLE:          { label: 'Desativação',     icon: UserX,       color: 'text-red-600 bg-red-50' },
  PASSWORD_CHANGED: { label: 'Senha alterada',  icon: KeyRound,    color: 'text-amber-600 bg-amber-50' },
  MFA_ENABLED:      { label: 'MFA ativado',     icon: ShieldCheck, color: 'text-green-600 bg-green-50' },
  MFA_DISABLED:     { label: 'MFA desativado',  icon: ShieldOff,   color: 'text-red-600 bg-red-50' },
  APPROVE:          { label: 'Aprovação',       icon: CheckCircle2, color: 'text-green-600 bg-green-50' },
  REJECT:           { label: 'Rejeição',        icon: X,           color: 'text-red-600 bg-red-50' },
  COMMENT:          { label: 'Comentário',      icon: MessageSquare, color: 'text-blue-600 bg-blue-50' },
  GENERATE_LINK:    { label: 'Link gerado',      icon: Link2,       color: 'text-teal-600 bg-teal-50' },
  RENEW_LINK:       { label: 'Link renovado',    icon: RefreshCw,   color: 'text-blue-600 bg-blue-50' },
  REVOKE_LINK:      { label: 'Link revogado',    icon: Link2Off,    color: 'text-red-600 bg-red-50' },
  VIEW_FILE:        { label: 'Arquivo visualizado', icon: Eye,      color: 'text-gray-600 bg-gray-100' },
  SEND:             { label: 'E-mail enviado',    icon: Mail,        color: 'text-teal-600 bg-teal-50' },
}

export function getActionMeta(action: string) {
  return ACTION_META[action] ?? { label: action, icon: RefreshCw, color: 'text-gray-600 bg-gray-100' }
}

export function ActionBadge({ action }: { action: string }) {
  const meta = getActionMeta(action)
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold ${meta.color}`}>
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  )
}

// Tradução de nomes de campos para exibição amigável no histórico de alterações
export const FIELD_LABELS: Record<string, string> = {
  // Comuns
  name: 'Nome', email: 'E-mail', role: 'Perfil', active: 'Ativo', unitId: 'Unidade',
  // Tarefas
  title: 'Título', description: 'Descrição', status: 'Status', priority: 'Prioridade', dueDate: 'Prazo',
  // Vagas
  titulo: 'Título', cargo: 'Cargo', setor: 'Setor', quantidade: 'Quantidade', municipio: 'Município',
  tipoVaga: 'Tipo de Vaga', periodoTrabalho: 'Período', cargaHoraria: 'Carga Horária',
  horarioTrabalho: 'Horário', escala: 'Escala', salarioMin: 'Salário Mín.', salarioMax: 'Salário Máx.',
  tipoRequisicao: 'Tipo de Requisição', tipoContrato: 'Contrato', tipoRecrutamento: 'Recrutamento',
  nomeColaboradorSaiu: 'Colaborador Substituído', nomeColaborador: 'Novo Colaborador',
  disponibilidadeHorario: 'Disponibilidade', vagaPcd: 'Vaga PCD', gestorRequisitante: 'Gestor Requisitante',
  setorRequisitante: 'Setor Requisitante', numProcessoAdmissao: '1Doc Admissão',
  numProtocoloOnvio: 'Onvio', requisicaoNextId: 'Next (RP)', analistaId: 'Analista',
  dataAbertura: 'Abertura', dataPrevistaFechamento: 'Prazo Previsto', dataFechamento: 'Fechamento',
  dataInicioIntegracao: 'Início/Integração', observacoes: 'Observações', unidadeId: 'Unidade',
  plantaoColaboradorSaiu: 'Plantão (Saiu)',
}

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key
}

export function formatAuditValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não'
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—'
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  }
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
