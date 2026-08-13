/** Status de recrutamento ainda sem admissão iniciada. */
export const VAGA_STATUS_RECRUTAMENTO = [
  'ABERTA',
  'DIVULGACAO',
  'TRIAGEM',
  'ENTREVISTAS',
  'ENCAMINHADA_GESTOR',
  'APROVADA_CONTRATACAO',
] as const

export const CANDIDATO_STATUS_APROVADO = ['APROVADO', 'AGUARDANDO_ADMISSAO', 'ADMITIDO'] as const

export function devePromoverParaAdmissao(status: string): boolean {
  return (VAGA_STATUS_RECRUTAMENTO as readonly string[]).includes(status)
}
