export type Perfil = {
  nomeSocial: string; funcao: string; cbo: string; centroCusto: string; sindicato: string
  jornada: string; escala: string; horario: string; localTrabalho: string
  estadoCivil: string; nacionalidade: string; escolaridade: string
  nomeMae: string; nomePai: string; rgOrgao: string; rgUf: string; rgEmissao: string
  salario: number | null; pis: string
  ctps: { numero: string; serie: string; uf: string; emissao: string }
  banco: { banco: string; agencia: string; conta: string; digito: string; tipo: string }
  endereco: { cep: string; logradouro: string; numero: string; complemento: string; bairro: string; cidade: string; uf: string }
  admissionId: string | null
}

export type Overview = {
  colaborador: {
    id: string; nome: string; matricula: string; cpf: string; cargo: string; setor: string; unidade: string; centroCusto: string
    admissao: string | null; tipoContrato: string; jornada: string; escala: string; horario: string; situacao: string
    gestor: string; ultimaAlteracao: string | null; salario: number | null; temFoto: boolean
  }
  contadores: { documentos: number; aditivos: number; dependentes: number; avaliacoes: number }
  perfil: Perfil
  admissaoVinculada: boolean
  admissao: { pendentes: { documentos: number; assinados: number; dependentes: number } }
  permissoes: Record<string, boolean>
  selecaoDossie: { id: string; label: string }[]
}

export type CatalogField = { key: string; label: string; type: 'text' | 'textarea' | 'date' | 'number' | 'select'; required: boolean; options: { value: string; label: string }[] | null; help: string | null; default: string }
export type CatalogType = { tipo: string; titulo: string; categoria: string; descricao: string; flow: string | null; missing: string[]; autoFilled: string[]; fields: CatalogField[]; signatures: string[] }

export type AvaliacaoModelo = {
  escala: { valor: string; rotulo: string }[]
  criterios: { id: string; rotulo: string; descricao: string }[]
  decisoes: { valor: string; rotulo: string }[]
  periodos: number[]
}
export type AutoModelo = {
  escalaSimNao: { valor: string; rotulo: string }[]
  escala: { valor: string; rotulo: string }[]
  perguntas: { id: string; rotulo: string; tipo: 'sim_nao' | 'escala' | 'texto' }[]
}

export type Catalog = {
  types: CatalogType[]
  dependentesIr: number
  dependentesSf: number
  aditivo: { tipos: { value: string; label: string; livre: boolean }[]; atual: Record<string, string> }
  avaliacao: { gerencial: AvaliacaoModelo; autoavaliacao: AutoModelo; sugestoes: Record<string, { inicio: string | null; fim: string | null }> }
  categoriasAnexo: string[]
  parentescos: string[]
}

export type DocRow = {
  id: string; tipo: string; categoria: string; titulo: string; origem: 'GERADO' | 'ANEXADO'; status: string; versao: number
  vigenciaInicio: string | null; vigenciaFim: string | null; geradoEm: string | null; createdAt: string; criadoPorNome: string | null
  arquivoNome: string | null; arquivoTamanho: number | null; arquivoMime: string | null; temArquivo: boolean
  origemDocumentoId: string | null; assinaturas: { role: string; label: string; status: string }[] | null
  observacao: string | null; canceladoEm: string | null; motivoCancelamento: string | null
}

export type DocDetail = DocRow & {
  dados: Record<string, string> | null; hash: string | null; templateKey: string | null; templateVersion: number | null; canceladoPorNome: string | null
  versoes: { id: string; versao: number; status: string; createdAt: string }[]
  eventos: { id: string; tipo: string; titulo: string; motivo: string | null; em: string; por: string | null }[]
}

export type AditivoRow = {
  id: string; numero: number; tipoAlteracao: string; campoAlterado: string; vigencia: string; motivo: string
  anterior: string; novo: string; documentoId: string | null; status: string | null; criadoPorNome: string | null; createdAt: string
}

export type DependenteRow = {
  id: string; nome: string; cpf: string; cpfMascarado: string | null; nascimento: string; parentesco: string; sexo: string
  dependenteIr: boolean; salarioFamilia: boolean; planoSaude: boolean; inclusaoEm: string; exclusaoEm: string | null; ativo: boolean
}

export type AvaliacaoRow = {
  id: string; tipo: 'GERENCIAL' | 'AUTOAVALIACAO'; periodoDias: number | null; periodoInicio: string | null; periodoFim: string | null
  avaliadorNome: string | null; decisao: string | null; status: string; dataAvaliacao: string; criadoPorNome: string | null
}

export type TimelineItem = {
  id: string; tipo: string; tipoLabel: string; dataEvento: string; titulo: string; anterior: string | null; novo: string | null
  motivo: string | null; documentoId: string | null; documentoTitulo: string | null; responsavelNome: string | null; sintetico?: boolean
}
