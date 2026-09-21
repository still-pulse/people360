export type Endereco = {
  cep?: string; logradouro?: string; numero?: string; complemento?: string
  bairro?: string; cidade?: string; uf?: string
}

/** Conteúdo do campo `ColaboradorPerfil.sensivel` (armazenado criptografado). */
export type Sensivel = {
  salario?: number | null
  pis?: string
  ctps?: { numero?: string; serie?: string; uf?: string; emissao?: string }
  banco?: { banco?: string; agencia?: string; conta?: string; digito?: string; tipo?: string }
  endereco?: Endereco
}

export type DependenteSnap = {
  id: string
  nome: string
  cpf: string
  nascimento: string
  parentesco: string
  sexo: string
  dependenteIr: boolean
  salarioFamilia: boolean
  planoSaude: boolean
  inclusaoEm: string
  exclusaoEm: string | null
}

/**
 * Retrato dos dados do colaborador usado para gerar documentos.
 * É gravado (criptografado) em cada documento no momento da geração: alterações futuras
 * de cargo, salário, etc. nunca reescrevem documentos já emitidos.
 */
export type Snapshot = {
  colaboradorId: string
  matricula: string
  nome: string
  nomeSocial: string
  cpf: string
  rg: string
  rgOrgao: string
  rgUf: string
  rgEmissao: string
  pis: string
  ctpsNumero: string
  ctpsSerie: string
  ctpsUf: string
  ctpsEmissao: string
  nascimento: string | null
  sexo: string
  estadoCivil: string
  nacionalidade: string
  naturalidade: string
  escolaridade: string
  nomeMae: string
  nomePai: string
  telefone: string
  email: string
  endereco: Endereco
  enderecoCompleto: string
  cargo: string
  funcao: string
  setor: string
  unidade: string
  centroCusto: string
  cbo: string
  tipoContrato: string
  salario: number | null
  jornada: string
  escala: string
  horario: string
  cargaHoraria: string
  sindicato: string
  localTrabalho: string
  admissao: string | null
  desligamento: string | null
  situacao: string
  gestor: string
  banco: { banco: string; agencia: string; conta: string }
  empregador: { nome: string; cnpj: string; endereco: string }
  dependentes: DependenteSnap[]
  ultimaAlteracao: string | null
  geradoEm: string
}

export type Actor = { id: string; name: string }
