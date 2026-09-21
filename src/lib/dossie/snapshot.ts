import { prisma } from '@/lib/prisma'
import { decryptAdmissionText, decryptAdmissionValue, encryptAdmissionValue } from '@/lib/admission/security'
import type { Actor, DependenteSnap, Endereco, Sensivel, Snapshot } from './types'

const STATUS_LABEL: Record<string, string> = { Active: 'Ativo', Left: 'Desligado', Suspended: 'Suspenso', Inactive: 'Inativo' }
const GENDER_LABEL: Record<string, string> = { Male: 'Masculino', Female: 'Feminino', Other: 'Outro' }

/** Campo alterado por um aditivo → chave do Snapshot que ele passa a sobrepor a partir da vigência. */
export const AMENDMENT_FIELDS: Record<string, { field: keyof Snapshot | null; label: string }> = {
  CARGO: { field: 'cargo', label: 'Cargo' },
  SALARIO: { field: 'salario', label: 'Salário' },
  JORNADA: { field: 'jornada', label: 'Jornada' },
  HORARIO: { field: 'horario', label: 'Horário' },
  ESCALA: { field: 'escala', label: 'Escala' },
  UNIDADE: { field: 'unidade', label: 'Unidade' },
  SETOR: { field: 'setor', label: 'Setor' },
  CENTRO_CUSTO: { field: 'centroCusto', label: 'Centro de custo' },
  LOCAL_TRABALHO: { field: 'localTrabalho', label: 'Local de trabalho' },
  FUNCAO: { field: 'funcao', label: 'Função' },
  BENEFICIO: { field: null, label: 'Benefício' },
  DIVERSA: { field: null, label: 'Alteração contratual diversa' },
  OUTRO: { field: null, label: 'Outro' },
}

export function readSensivel(stored: unknown): Sensivel {
  const value = decryptAdmissionValue(stored)
  return value && typeof value === 'object' ? (value as Sensivel) : {}
}

export function packSensivel(value: Sensivel) {
  return encryptAdmissionValue(value)
}

export function formatEndereco(e: Endereco | undefined): string {
  if (!e) return ''
  const street = [e.logradouro, e.numero && `nº ${e.numero}`, e.complemento].filter(Boolean).join(', ')
  const city = [e.cidade, e.uf].filter(Boolean).join('/')
  return [street, e.bairro, city, e.cep && `CEP ${e.cep}`].filter(Boolean).join(' — ')
}

export function employerInfo(unitId?: string | null) {
  let configured: Record<string, { nome?: string; cnpj?: string; endereco?: string }> = {}
  try { configured = JSON.parse(process.env.ADMISSION_EMPLOYERS_BY_UNIT || '{}') }
  catch { configured = {} }
  const unit = unitId ? configured[unitId] : undefined
  return {
    nome: unit?.nome || process.env.ADMISSION_EMPLOYER_NAME || 'BENEFICÊNCIA HOSPITALAR DE CESÁRIO LANGE',
    cnpj: unit?.cnpj || process.env.ADMISSION_EMPLOYER_CNPJ || '50.351.626/0015-16',
    endereco: unit?.endereco || process.env.ADMISSION_EMPLOYER_ADDRESS || 'R. dos Jesuítas, 533, Cidade Industrial Satélite de São Paulo, Guarulhos/SP',
  }
}

export function toDependenteSnap(row: {
  id: string; nome: string; cpfCifrado: unknown; cpfMascarado: string | null; nascimento: Date; parentesco: string; sexo: string | null
  dependenteIr: boolean; salarioFamilia: boolean; planoSaude: boolean; inclusaoEm: Date; exclusaoEm: Date | null
}): DependenteSnap {
  const cpf = decryptAdmissionValue(row.cpfCifrado)
  return {
    id: row.id, nome: row.nome, cpf: typeof cpf === 'string' ? cpf : (row.cpfMascarado || ''),
    nascimento: row.nascimento.toISOString(), parentesco: row.parentesco, sexo: row.sexo || '',
    dependenteIr: row.dependenteIr, salarioFamilia: row.salarioFamilia, planoSaude: row.planoSaude,
    inclusaoEm: row.inclusaoEm.toISOString(), exclusaoEm: row.exclusaoEm?.toISOString() ?? null,
  }
}

/**
 * Monta o retrato atual do colaborador: espelho do ERPNext + complemento cadastral (perfil) +
 * aditivos já em vigência (o valor vigente é DERIVADO dos aditivos; nada é sobrescrito).
 * Nunca exige redigitar o que já existe no cadastro.
 */
export async function buildSnapshot(colaboradorId: string, asOf: Date = new Date()): Promise<Snapshot | null> {
  const colaborador = await prisma.colaborador.findUnique({
    where: { id: colaboradorId },
    include: {
      unit: { select: { id: true, name: true } },
      perfil: true,
      dependentes: { where: { exclusaoEm: null }, orderBy: { nascimento: 'asc' } },
      aditivos: { where: { vigencia: { lte: asOf }, documento: { is: { status: 'VIGENTE' } } }, orderBy: [{ vigencia: 'asc' }, { createdAt: 'asc' }] },
    },
  })
  if (!colaborador) return null
  const perfil = colaborador.perfil
  const sensivel = readSensivel(perfil?.sensivel)
  const endereco = sensivel.endereco ?? {}

  const snap: Snapshot = {
    colaboradorId: colaborador.id,
    matricula: colaborador.matricula || colaborador.erpnextId,
    nome: colaborador.employeeName,
    nomeSocial: perfil?.nomeSocial || '',
    cpf: colaborador.cpf || '',
    rg: colaborador.rg || '',
    rgOrgao: perfil?.rgOrgao || '',
    rgUf: perfil?.rgUf || '',
    rgEmissao: perfil?.rgEmissao || '',
    pis: sensivel.pis || '',
    ctpsNumero: sensivel.ctps?.numero || '',
    ctpsSerie: sensivel.ctps?.serie || '',
    ctpsUf: sensivel.ctps?.uf || '',
    ctpsEmissao: sensivel.ctps?.emissao || '',
    nascimento: colaborador.dateOfBirth?.toISOString() ?? null,
    sexo: GENDER_LABEL[colaborador.gender || ''] || colaborador.gender || '',
    estadoCivil: perfil?.estadoCivil || '',
    nacionalidade: perfil?.nacionalidade || '',
    naturalidade: colaborador.naturalidade || '',
    escolaridade: perfil?.escolaridade || '',
    nomeMae: perfil?.nomeMae || '',
    nomePai: perfil?.nomePai || '',
    telefone: colaborador.cellNumber || '',
    email: colaborador.personalEmail || colaborador.companyEmail || '',
    endereco,
    enderecoCompleto: formatEndereco(endereco),
    cargo: colaborador.designation || '',
    funcao: perfil?.funcao || colaborador.designation || '',
    setor: colaborador.department || colaborador.secao || '',
    unidade: colaborador.unit?.name || colaborador.company || '',
    centroCusto: perfil?.centroCusto || '',
    cbo: perfil?.cbo || '',
    tipoContrato: colaborador.employmentType || '',
    salario: sensivel.salario ?? null,
    jornada: perfil?.jornada || '',
    escala: perfil?.escala || '',
    horario: perfil?.horario || '',
    cargaHoraria: colaborador.cargaHoraria || '',
    sindicato: perfil?.sindicato || '',
    localTrabalho: perfil?.localTrabalho || '',
    admissao: colaborador.dateOfJoining?.toISOString() ?? null,
    desligamento: colaborador.relievingDate?.toISOString() ?? null,
    situacao: STATUS_LABEL[colaborador.status] || colaborador.status,
    gestor: colaborador.reportsToName || '',
    banco: { banco: sensivel.banco?.banco || '', agencia: sensivel.banco?.agencia || '', conta: [sensivel.banco?.conta, sensivel.banco?.digito].filter(Boolean).join('-') },
    empregador: employerInfo(colaborador.unit?.id),
    dependentes: colaborador.dependentes.map(toDependenteSnap),
    ultimaAlteracao: null,
    geradoEm: asOf.toISOString(),
  }

  // Overlay dos aditivos em vigência, em ordem cronológica.
  for (const amendment of colaborador.aditivos) {
    const target = AMENDMENT_FIELDS[amendment.tipoAlteracao]?.field
    snap.ultimaAlteracao = amendment.vigencia.toISOString()
    if (!target) continue
    if (target === 'salario') {
      const value = Number(decryptAdmissionText(amendment.valorNovo))
      if (Number.isFinite(value)) snap.salario = value
    } else {
      ;(snap as Record<string, unknown>)[target] = decryptAdmissionText(amendment.valorNovo) ?? ''
    }
  }
  return snap
}

/** Lista os rótulos dos campos obrigatórios ainda vazios (para validação com mensagem clara). */
export function missing(snap: Snapshot, required: { key: keyof Snapshot; label: string }[]): string[] {
  return required.filter(({ key }) => {
    const value = snap[key]
    return value == null || value === '' || (typeof value === 'object' && !Array.isArray(value) && Object.values(value as object).every((v) => !v))
  }).map(({ label }) => label)
}

export function packSnapshot(snapshot: Snapshot) {
  return encryptAdmissionValue(snapshot)
}

export function unpackSnapshot(stored: unknown): Snapshot | null {
  const value = decryptAdmissionValue(stored)
  return value && typeof value === 'object' ? (value as Snapshot) : null
}

export type { Actor }
