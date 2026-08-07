/** Inventário IPIP de 50 itens (Big Five / OCEAN) — domínio público. */

export type BigFiveFactor = 'E' | 'A' | 'C' | 'N' | 'O'

export interface BigFiveItem {
  n: number
  t: string
  f: BigFiveFactor
  r: boolean
}

export const BIG_FIVE_ITEMS: BigFiveItem[] = [
  { n: 1, t: 'Sou a vida de uma festa.', f: 'E', r: false },
  { n: 2, t: 'Sinto pouca preocupação pelos outros.', f: 'A', r: true },
  { n: 3, t: 'Estou sempre preparado(a).', f: 'C', r: false },
  { n: 4, t: 'Fico estressado(a) com facilidade.', f: 'N', r: false },
  { n: 5, t: 'Possuo um vocabulário rico.', f: 'O', r: false },
  { n: 6, t: 'Não falo muito.', f: 'E', r: true },
  { n: 7, t: 'Estou interessado(a) nas pessoas.', f: 'A', r: false },
  { n: 8, t: 'Deixo os meus pertences por aí.', f: 'C', r: true },
  { n: 9, t: 'Estou calmo(a) a maior parte do tempo.', f: 'N', r: true },
  { n: 10, t: 'Tenho dificuldade em entender ideias abstratas.', f: 'O', r: true },
  { n: 11, t: 'Sinto-me confortável no meio dos outros.', f: 'E', r: false },
  { n: 12, t: 'Insulto os outros.', f: 'A', r: true },
  { n: 13, t: 'Presto atenção aos detalhes.', f: 'C', r: false },
  { n: 14, t: 'Preocupo-me com as coisas.', f: 'N', r: false },
  { n: 15, t: 'Tenho uma imaginação vívida.', f: 'O', r: false },
  { n: 16, t: 'Prefiro manter-me em segundo plano.', f: 'E', r: true },
  { n: 17, t: 'Simpatizo com os sentimentos dos outros.', f: 'A', r: false },
  { n: 18, t: 'Faço uma confusão com as coisas.', f: 'C', r: true },
  { n: 19, t: 'Raramente me sinto triste.', f: 'N', r: true },
  { n: 20, t: 'Não me interesso por ideias abstratas.', f: 'O', r: true },
  { n: 21, t: 'Inicio conversas.', f: 'E', r: false },
  { n: 22, t: 'Não estou interessado(a) nos problemas dos outros.', f: 'A', r: true },
  { n: 23, t: 'Realizo as tarefas imediatamente.', f: 'C', r: false },
  { n: 24, t: 'Sou facilmente perturbado(a).', f: 'N', r: false },
  { n: 25, t: 'Tenho excelentes ideias.', f: 'O', r: false },
  { n: 26, t: 'Tenho pouco para dizer.', f: 'E', r: true },
  { n: 27, t: 'Tenho um coração mole.', f: 'A', r: false },
  { n: 28, t: 'Muitas vezes esqueço-me de colocar as coisas no seu devido lugar.', f: 'C', r: true },
  { n: 29, t: 'Fico preocupado(a) com facilidade.', f: 'N', r: false },
  { n: 30, t: 'Não tenho uma boa imaginação.', f: 'O', r: true },
  { n: 31, t: 'Falo com muitas pessoas diferentes em festas.', f: 'E', r: false },
  { n: 32, t: 'Não estou realmente interessado(a) nos outros.', f: 'A', r: true },
  { n: 33, t: 'Gosto de ordem.', f: 'C', r: false },
  { n: 34, t: 'Mudo de humor com frequência.', f: 'N', r: false },
  { n: 35, t: 'Sou rápido(a) a compreender as coisas.', f: 'O', r: false },
  { n: 36, t: 'Não gosto de chamar a atenção para mim.', f: 'E', r: true },
  { n: 37, t: 'Dedico tempo aos outros.', f: 'A', r: false },
  { n: 38, t: 'Fujo às minhas obrigações.', f: 'C', r: true },
  { n: 39, t: 'Tenho mudanças frequentes de humor.', f: 'N', r: false },
  { n: 40, t: 'Uso palavras difíceis.', f: 'O', r: false },
  { n: 41, t: 'Não me importo de ser o centro das atenções.', f: 'E', r: false },
  { n: 42, t: 'Sinto as emoções dos outros.', f: 'A', r: false },
  { n: 43, t: 'Sigo um planejamento.', f: 'C', r: false },
  { n: 44, t: 'Irrito-me com facilidade.', f: 'N', r: false },
  { n: 45, t: 'Passo tempo a refletir sobre as coisas.', f: 'O', r: false },
  { n: 46, t: 'Estou tranquilo(a) na presença de desconhecidos.', f: 'E', r: true },
  { n: 47, t: 'Faço com que as pessoas se sintam à vontade.', f: 'A', r: false },
  { n: 48, t: 'Sou exigente no meu trabalho.', f: 'C', r: false },
  { n: 49, t: 'Muitas vezes sinto-me triste.', f: 'N', r: false },
  { n: 50, t: 'Estou cheio(a) de ideias.', f: 'O', r: false },
]

export type BigFiveLevel = 'alta' | 'moderada' | 'baixa'

export interface BigFiveFactorScore {
  raw: number
  max: number
  pct: number
  level: BigFiveLevel
}

export type BigFiveScores = Record<BigFiveFactor, BigFiveFactorScore>

export const BIG_FIVE_LABELS: Record<BigFiveFactor, string> = {
  E: 'Extroversão',
  A: 'Agradabilidade',
  C: 'Conscienciosidade',
  N: 'Neuroticismo',
  O: 'Abertura',
}

export const BIG_FIVE_COLORS: Record<BigFiveFactor, string> = {
  E: '#22c55e',
  A: '#f59e0b',
  C: '#3b82f6',
  N: '#ef4444',
  O: '#a855f7',
}

export const BIG_FIVE_INTERP: Record<
  BigFiveFactor,
  {
    nome: string
    desc: string
    alta: { texto: string; forcas: string; atencao: string }
    moderada: { texto: string; forcas: string; atencao: string }
    baixa: { texto: string; forcas: string; atencao: string }
  }
> = {
  E: {
    nome: 'Extroversão',
    desc: 'Mede de onde vem a sua energia social: o quanto você busca interação, estímulo e presença entre pessoas.',
    alta: {
      texto: 'Tende a ser comunicativo(a), energizado(a) por pessoas e ambientes estimulantes. Facilidade para criar conexões e presença marcante.',
      forcas: 'Comunicação espontânea; redes de relacionamento; presença e influência social.',
      atencao: 'Pode precisar de pausas sozinho(a); risco de dispersão em ambientes muito agitados.',
    },
    moderada: {
      texto: 'Equilibra momentos sociais e momentos mais reservados. Adapta-se bem conforme o contexto.',
      forcas: 'Flexibilidade social; consegue liderar e também observar.',
      atencao: 'Em contextos extremos (muito isolados ou muito sociais) pode sentir desconforto passageiro.',
    },
    baixa: {
      texto: 'Tende a ser mais reservado(a), com energia renovada em ambientes calmos e relações mais profundas.',
      forcas: 'Escuta e observação apuradas; profundidade nas relações e nas ideias.',
      atencao: 'Pode ser percebido(a) como distante; convém comunicar necessidades de espaço.',
    },
  },
  A: {
    nome: 'Agradabilidade',
    desc: 'Mede orientação para as pessoas: empatia, cooperação, confiança e disposição de considerar o grupo.',
    alta: {
      texto: 'Tende a ser empático(a), cooperativo(a) e confiante nos outros. Valoriza harmonia e relações positivas.',
      forcas: 'Empatia genuína; talento para equipe e mediação.',
      atencao: 'Risco de colocar as necessidades dos outros acima das suas; dificuldade em dizer não.',
    },
    moderada: {
      texto: 'Equilibra cooperação e assertividade. Sabe colaborar e também defender posições.',
      forcas: 'Equilíbrio entre empatia e objetividade.',
      atencao: 'Em conflitos intensos, pode oscilar entre ceder demais e endurecer.',
    },
    baixa: {
      texto: 'Tende a ser mais direto(a), competitivo(a) e cético(a). Prioriza a franqueza e a própria agenda.',
      forcas: 'Franqueza clara; imunidade a manipulação emocional; foco em resultados.',
      atencao: 'Pode ser visto(a) como áspero(a); investir em escuta melhora a influência.',
    },
  },
  C: {
    nome: 'Conscienciosidade',
    desc: 'Mede relação com metas, ordem e disciplina: planejamento, organização, persistência e controle de impulsos.',
    alta: {
      texto: 'Organizado(a), disciplinado(a) e orientado(a) a metas. Cumpre o que promete e valoriza qualidade.',
      forcas: 'Disciplina e constância; organização que multiplica produtividade.',
      atencao: 'Risco de rigidez ou perfeccionismo excessivo; dificuldade com mudanças bruscas.',
    },
    moderada: {
      texto: 'Equilibra estrutura e flexibilidade. Planeja quando precisa e improvisa quando faz sentido.',
      forcas: 'Adaptabilidade com responsabilidade.',
      atencao: 'Em prazos longos, pode procrastinar; em prazos curtos, entregar com qualidade.',
    },
    baixa: {
      texto: 'Tende a ser mais espontâneo(a), flexível e menos apegado(a) a rotinas rígidas.',
      forcas: 'Adaptabilidade a imprevistos; capacidade de improviso.',
      atencao: 'Prazos e detalhes podem sofrer; sistemas externos de organização ajudam.',
    },
  },
  N: {
    nome: 'Neuroticismo',
    desc: 'Mede sensibilidade a emoções negativas: frequência e intensidade de estresse, preocupação e oscilações de humor. Alto = mais sensível; baixo = mais estável.',
    alta: {
      texto: 'Sente emoções com mais intensidade e tem radar fino para riscos e problemas em formação.',
      forcas: 'Sensibilidade que percebe o que outros ignoram; motivação para se proteger e melhorar.',
      atencao: 'Estresse e preocupação podem consumir energia; técnicas de regulação emocional são valiosas.',
    },
    moderada: {
      texto: 'Reage emocionalmente de forma proporcional à maioria das situações, com boa recuperação.',
      forcas: 'Equilíbrio emocional na maior parte do tempo.',
      atencao: 'Em períodos de alta pressão, convém reforçar pausas e apoio.',
    },
    baixa: {
      texto: 'Tende a ser calmo(a) sob pressão e recupera-se rápido após contratempos. Estabilidade emocional marcada.',
      forcas: 'Calma genuína; resiliência; clareza sob estresse.',
      atencao: 'Pode subestimar sinais de alerta emocionais em si ou nos outros.',
    },
  },
  O: {
    nome: 'Abertura a Experiências',
    desc: 'Mede relação com o novo e o abstrato: curiosidade intelectual, imaginação, estética e disposição para questionar o convencional.',
    alta: {
      texto: 'Curioso(a), criativo(a) e aberto(a) a ideias e experiências novas. Gosta de refletir e inovar.',
      forcas: 'Criatividade e pensamento original; aprendizado rápido e contínuo.',
      atencao: 'Pode dispersar-se em muitas ideias; nem todo ambiente valoriza experimentação.',
    },
    moderada: {
      texto: 'Equilibra inovação e pragmatismo. Aceita o novo quando faz sentido e mantém o que funciona.',
      forcas: 'Flexibilidade cognitiva com pé no chão.',
      atencao: 'Em culturas muito conservadoras ou muito disruptivas, pode sentir atrito.',
    },
    baixa: {
      texto: 'Prefere o concreto, o testado e o familiar. Foco no que funciona e domínio no seu território.',
      forcas: 'Pragmatismo; profundidade e expertise no conhecido.',
      atencao: 'Mudanças grandes podem gerar resistência; exposição gradual ao novo ajuda.',
    },
  },
}

function level(pct: number): BigFiveLevel {
  if (pct >= 70) return 'alta'
  if (pct >= 40) return 'moderada'
  return 'baixa'
}

export function scoreBigFiveFactor(factor: BigFiveFactor, answers: number[]): BigFiveFactorScore {
  let sum = 0
  let count = 0
  BIG_FIVE_ITEMS.forEach((item, i) => {
    if (item.f !== factor) return
    let v = answers[i]
    if (item.r) v = 6 - v
    sum += v
    count++
  })
  const max = count * 5
  const pct = Math.round((sum / max) * 100)
  return { raw: sum, max, pct, level: level(pct) }
}

export function calculateBigFive(answers: number[]): {
  scores: BigFiveScores
  predominante: { factor: BigFiveFactor; label: string; pct: number }
} {
  if (answers.length !== 50 || answers.some((a) => a == null || a < 1 || a > 5)) {
    throw new Error('Respostas Big Five inválidas: espere 50 valores entre 1 e 5.')
  }
  const factors: BigFiveFactor[] = ['E', 'A', 'C', 'N', 'O']
  const scores = {} as BigFiveScores
  for (const f of factors) {
    scores[f] = scoreBigFiveFactor(f, answers)
  }
  // Predominante: maior pct (exceto empate — ordem OCEAN)
  let top: BigFiveFactor = 'E'
  for (const f of factors) {
    if (scores[f].pct > scores[top].pct) top = f
  }
  return {
    scores,
    predominante: { factor: top, label: BIG_FIVE_LABELS[top], pct: scores[top].pct },
  }
}

export function validateBigFiveAnswers(answers: unknown): answers is number[] {
  return (
    Array.isArray(answers) &&
    answers.length === 50 &&
    answers.every((a) => typeof a === 'number' && Number.isInteger(a) && a >= 1 && a <= 5)
  )
}
