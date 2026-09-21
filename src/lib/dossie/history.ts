import { prisma } from '@/lib/prisma'
import { logOrThrow } from '@/lib/audit'
import { encryptAdmissionText } from '@/lib/admission/security'
import type { Actor } from './types'

export const HISTORY_TYPES: Record<string, string> = {
  ADMISSAO: 'Admissão',
  PRORROGACAO: 'Prorrogação do contrato de experiência',
  EFETIVACAO: 'Efetivação',
  SALARIO: 'Alteração salarial',
  CARGO: 'Alteração de cargo',
  FUNCAO: 'Alteração de função',
  JORNADA: 'Alteração de jornada',
  HORARIO: 'Alteração de horário',
  ESCALA: 'Alteração de escala',
  UNIDADE: 'Transferência de unidade',
  SETOR: 'Alteração de setor',
  CENTRO_CUSTO: 'Alteração de centro de custo',
  LOCAL_TRABALHO: 'Alteração de local de trabalho',
  ADITIVO: 'Aditivo contratual',
  DOCUMENTO: 'Documento',
  AVALIACAO: 'Avaliação',
  DEPENDENTE: 'Dependentes',
  CADASTRO: 'Atualização cadastral',
  OUTRO: 'Outro',
}

/** Linha do tempo funcional: append-only. Não existe update/delete de histórico. */
export async function addHistorico(input: {
  colaboradorId: string
  tipo: keyof typeof HISTORY_TYPES | string
  dataEvento: Date
  titulo: string
  anterior?: string | null
  novo?: string | null
  motivo?: string | null
  documentoId?: string | null
  aditivoId?: string | null
  actor?: Actor | null
}) {
  return prisma.colaboradorHistorico.create({
    data: {
      colaboradorId: input.colaboradorId, tipo: input.tipo, dataEvento: input.dataEvento, titulo: input.titulo,
      anterior: encryptAdmissionText(input.anterior), novo: encryptAdmissionText(input.novo), motivo: encryptAdmissionText(input.motivo),
      documentoId: input.documentoId ?? null, aditivoId: input.aditivoId ?? null,
      responsavelId: input.actor?.id ?? null, responsavelNome: input.actor?.name ?? null,
    },
  })
}

/** Auditoria global (quem criou/alterou/cancelou/gerou/exportou). Nunca grava PII em `details`. */
export async function auditDossie(input: {
  actor: Actor & { role?: string }
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'UPLOAD' | 'VIEW_FILE' | 'APPROVE' | 'REJECT'
  entity: string
  entityId?: string | null
  colaboradorId: string
  ip?: string | null
  details?: Record<string, unknown>
}) {
  await logOrThrow({
    userId: input.actor.id, userName: input.actor.name, userRole: input.actor.role ?? null,
    action: input.action, entity: `Colaborador/${input.entity}`, entityId: input.entityId ?? input.colaboradorId,
    entityName: input.colaboradorId, details: input.details ?? null, ip: input.ip ?? null,
  })
}
