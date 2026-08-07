/** Questionário DISC — 20 perguntas com ranqueamento 1–4 sem repetição. */

export interface DiscQuestion {
  q: string
  opts: [string, string, string, string]
}

export const DISC_QUESTIONS: DiscQuestion[] = [
  { q: 'Quando eu erro no trabalho geralmente:', opts: ['Tento corrigir imediatamente.', 'Busco ajuda com minha equipe para corrigir o erro.', 'Mantenho a calma e busco a solução.', 'Fico me remoendo.'] },
  { q: 'Qual das seguintes áreas você sente que é mais o seu ponto forte?', opts: ['Tomar decisões rapidamente e agir com firmeza.', 'Lidar com relações públicas e interações sociais.', 'Ter a habilidade de se adaptar bem em equipes diversas.', 'Priorizar a qualidade e a pontualidade para se sentir seguro.'] },
  { q: 'O que é mais importante para você em uma situação?', opts: ['Sentir-se seguro e confortável.', 'Ter controle e dominar a situação.', 'Ser notado e receber atenção.', 'Fazer as coisas de maneira correta e precisa.'] },
  { q: 'Qual destas características melhor descreve seu comportamento em situações sociais ou profissionais?', opts: ['Brincalhão, gosta de chamar a atenção das pessoas.', 'Empreendedor, demonstra força de vontade e iniciativa.', 'Generoso, é flexível e se adapta facilmente aos outros.', 'Cuidadoso, toma decisões com cautela e atenção aos detalhes.'] },
  { q: 'Onde você geralmente se sente mais confortável e confiante?', opts: ['Estou próximo de amigos e pessoas conhecidas.', 'Estou liderando uma situação ou grupo.', 'Faço parte de uma equipe colaborativa.', 'Quando tudo está organizado e sob controle.'] },
  { q: 'Como você normalmente reage diante de conflitos ou desentendimentos?', opts: ['Sinto receio e posso ficar magoado com facilidade.', 'Resolvo rapidamente o problema.', 'Às vezes, posso agir de forma assertiva para resolver a situação.', 'Prefiro me manter em silêncio e me afastar da situação.'] },
  { q: 'Como você normalmente aborda a comunicação e a expressão de sentimentos?', opts: ['Tendo a ser diplomático e cuidadoso ao escolher minhas palavras.', 'Raramente expresso abertamente o que estou sentindo.', 'Prefiro abordar as coisas de forma indireta para evitar magoar os outros.', 'Falo de forma direta e franca, dizendo as coisas como elas são.'] },
  { q: 'Qual é a sua atitude predominante quando se depara com mudanças ou novas situações?', opts: ['Sinto-me desconfortável e prefiro a estabilidade.', 'Encaro as mudanças com um olhar positivo e curioso.', 'Rapidamente me ajusto e me adapto às mudanças.', 'Levo tempo para me acostumar e avaliar as mudanças.'] },
  { q: 'Qual das seguintes situações você considera mais desconfortável ou desafiadora?', opts: ['Lidar com a sensação de perda.', 'Enfrentar mudanças repentinas e inesperadas.', 'Ficar isolado ou sem a companhia de outros.', 'Reconhecer que está errado em determinada situação.'] },
  { q: 'Qual é a sua atitude predominante em relação às compras e gastos?', opts: ['Tenho atração por ofertas e descontos e frequentemente compro.', 'Sinto prazer ao fazer compras, muitas vezes comprando coisas não essenciais.', 'Sou decidido e só gasto dinheiro quando encontro exatamente o que desejo.', 'Tenho dificuldade em tomar decisões e escolher produtos.'] },
  { q: 'Qual das seguintes emoções você mais frequentemente demonstra ou sente?', opts: ['Medo de errar.', 'Otimismo.', 'Insegurança.', 'Irritação.'] },
  { q: 'Quando você está trabalhando em um projeto, que tipo de abordagem descreve melhor a sua maneira de agir?', opts: ['Prezando pela exatidão, sendo cuidadoso e assegurando que tudo está correto.', 'Realizando o trabalho com entusiasmo, buscando diversão e espalhando alegria.', 'Focando no resultado final, tomando decisões diretas e determinadas.', 'Buscando estabilidade, agindo com paciência e organizando as etapas do projeto.'] },
  { q: 'No ambiente de trabalho, o que você valoriza mais?', opts: ['Uma rotina previsível e estruturada.', 'A aprovação e o reconhecimento dos outros.', 'Ter controle sobre as situações e decisões.', 'Regras claras e bem definidas para orientar ações.'] },
  { q: 'Como você geralmente interage e se relaciona com os outros?', opts: ['Prefiro estar com pessoas que sejam fáceis de conviver e evito conflitos.', 'Tendo a animar e trazer alegria a pessoas que estejam tristes.', 'Gosto de realizar várias tarefas simultaneamente.', 'Prefiro interagir com pessoas resolvendo problemas que requerem raciocínio e encontrando soluções.'] },
  { q: 'Qual dessas descrições melhor reflete sua abordagem em um ambiente de trabalho?', opts: ['Prefiro trabalhar em grupo.', 'Tenho dificuldade em aceitar instruções ou ser direcionado por outros.', 'Realizo meu melhor trabalho quando não estou sob pressão.', 'Fico desconfortável com desorganização e falta de pontualidade.'] },
  { q: 'Qual destas características melhor reflete sua abordagem em situações sociais e de trabalho?', opts: ['Humilde, compreensivo com as pessoas.', 'Carismático, atraindo os outros com sua desenvoltura.', 'Tem atitude, sendo persuasivo e convincente.', 'Sistemático, mantendo um olhar cético e precaução.'] },
  { q: 'O que mais desperta a sua motivação e interesse na vida?', opts: ['Enfrentar desafios, explorar novas ideias e criar coisas novas.', 'Experimentar surpresas agradáveis, se divertir com amigos e ter momentos inesperados.', 'Receber carinho e aceitação de pessoas ao seu redor.', 'Buscar constantemente aprendizado, sabedoria e adquirir novos conhecimentos.'] },
  { q: 'Qual característica te descreve mais?', opts: ['Sou determinado.', 'Sou pacífico.', 'Sou alegre.', 'Sou pontual.'] },
  { q: 'Qual destas características melhor descreve sua personalidade?', opts: ['Auto-suficiente e ambicioso.', 'Preciso e exato.', 'Cooperativo e adaptável.', 'Despreocupado e popular.'] },
  { q: 'Como você geralmente se comporta e se sente em relação a situações cotidianas?', opts: ['Sou tranquilo e passivo, preferindo uma abordagem mais calma.', 'Sou alegre e otimista na maioria das vezes.', 'Sou ativo e enérgico, buscando ação e movimento.', 'Sou responsável e observador, priorizando a responsabilidade e atenção aos detalhes.'] },
]

/** Para cada pergunta, índice da opção (0–3) que pontua D/I/S/C */
export const DISC_SCORE_MAP: { D: number; I: number; S: number; C: number }[] = [
  { D: 0, I: 1, S: 2, C: 3 },
  { D: 0, I: 1, S: 2, C: 3 },
  { D: 1, I: 2, S: 0, C: 3 },
  { D: 1, I: 0, S: 2, C: 3 },
  { D: 1, I: 0, S: 2, C: 3 },
  { D: 1, I: 0, S: 3, C: 2 },
  { D: 1, I: 2, S: 0, C: 3 },
  { D: 2, I: 1, S: 0, C: 3 },
  { D: 0, I: 1, S: 2, C: 3 },
  { D: 0, I: 1, S: 3, C: 2 },
  { D: 3, I: 1, S: 2, C: 0 },
  { D: 2, I: 1, S: 3, C: 0 },
  { D: 2, I: 1, S: 0, C: 3 },
  { D: 2, I: 1, S: 0, C: 3 },
  { D: 1, I: 0, S: 2, C: 3 },
  { D: 2, I: 1, S: 0, C: 3 },
  { D: 0, I: 1, S: 2, C: 3 },
  { D: 0, I: 2, S: 1, C: 3 },
  { D: 0, I: 3, S: 2, C: 1 },
  { D: 2, I: 1, S: 0, C: 3 },
]

export type DiscLetter = 'D' | 'I' | 'S' | 'C'
export type DiscProfileKey = 'Dominante' | 'Influência' | 'Estabilidade' | 'Conformidade'

export const DISC_PROFILE_BY_LETTER: Record<DiscLetter, DiscProfileKey> = {
  D: 'Dominante',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
}

export const DISC_LABELS: Record<DiscLetter, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
}

export const DISC_COLORS: Record<DiscLetter, string> = {
  D: '#ef4444',
  I: '#f59e0b',
  S: '#10b981',
  C: '#3b82f6',
}

export const DISC_LAUDOS: Record<DiscProfileKey, string> = {
  Dominante: `As pessoas com esse perfil são objetivas e diretas, não perdem tempo com detalhes e concentram todos os esforços na realização de uma tarefa, superando oposições para alcançar resultados. São determinadas e raramente desistem de um objetivo, mesmo quando ele parece se provar inatingível ou desnecessário. Os desafios e a ambição são geralmente os motores que impulsionam este perfil a seguir em diante, que além disso precisam de alguma liberdade de ação para que se desenvolvam.

É um perfil que demonstra mais interesse por evidências quantitativas e raciocínio lógico, frequentemente mostra sinais de extroversão. Valoriza nos outros a capacidade de concluir uma tarefa rapidamente, a força e a influência. Tratando-se de comunicação, ela é direta e, por isso, muitas vezes pode ser vista como assertiva ou até áspera.`,

  Influência: `Pessoas com um perfil predominantemente Influência são mais extrovertidas, exercem influência e empatia sobre os demais e tendem a ser criativas e comunicativas. São pessoas mais emocionais e que possuem grande habilidade em influenciar pessoas. São animadas, entusiasmadas, extrovertidas e motivadoras. Sabem persuadir, se comunicar e manter o otimismo. Ocasionalmente, essas pessoas iniciam projetos e não os terminam, devido à sua excitação inicial diante de uma atividade.

Quando se trata de equipe, pessoas deste perfil podem ser utilizadas como instrumentos de sociabilização, influenciando, participando, compartilhando ideais, energizando e persuadindo, tornando seus membros mais unidos e gerando um ambiente mais leve, onde a comunicação se dá de maneira mais natural.

O candidato deste perfil tende a ser mais subjetivo quanto às suas metas, demonstrando mais interesse por evidências qualitativas e fatores humanos.`,

  Estabilidade: `O perfil Estabilidade (também conhecido como Planejador) caracteriza pessoas de natureza mais calma e centrada. Gostam de manter uma rotina previsível e se perdem em ambientes de mudanças muito constantes. Para alguns, podem parecer mais lentas que o habitual; no entanto, essa é uma de suas principais qualidades.

Todo o tempo gasto na execução de tarefas as ajuda a entregá-las com mais perfeição. São pessoas bastante empáticas e criam forte conexão com seus colegas de trabalho.

Os principais desafios deste perfil estão relacionados a lidar com situações que fogem ao seu controle. Um imprevisto, uma mudança de última hora nos planos ou a necessidade de entregar as tarefas em um prazo muito curto não são fáceis para elas. Por valorizarem a perfeição e a harmonia, podem ser menos seguras e autoconfiantes em ambientes de alta pressão — ponto este para ser trabalhado e desenvolvido.`,

  Conformidade: `Qualidade e exatidão são palavras-chave do perfil Conformidade (também conhecido como Analista). Justamente por não querer entregar nada menos do que o melhor, seu comportamento pode ser rígido.

Quem apresenta esse perfil comportamental procura a perfeição em suas entregas e é motivado por altos padrões e eficiência em tudo que faz. Gostam de estudar e se desenvolver constantemente para poder falar com propriedade sobre determinado assunto.

Em alguns casos, a busca pelo trabalho perfeito pode gerar lentidão e pessimismo. O profissional pode se sentir indeciso em seguir por um ou outro caminho, visto que é bastante crítico consigo mesmo.

Quando estão sob pressão costumam se fechar e se calar. O desequilíbrio gerado pela falta de saber como agir em um determinado momento pode levar a pessoa a se retirar da situação para ir em busca da resposta correta.`,
}

export const DISC_TRAITS: Record<
  DiscProfileKey,
  { caracteristicas: string[]; naoGosta: string[]; necessidades: string[] }
> = {
  Dominante: {
    caracteristicas: ['Objetivo e direto', 'Determinado', 'Orientado a resultados', 'Assertivo', 'Competitivo', 'Independente'],
    naoGosta: ['Indecisão', 'Detalhes excessivos', 'Falta de autonomia', 'Rotina sem desafios'],
    necessidades: ['Liberdade de ação', 'Desafios', 'Resultados concretos', 'Poder de decisão'],
  },
  Influência: {
    caracteristicas: ['Comunicativo', 'Otimista', 'Carismático', 'Persuasivo', 'Entusiasta', 'Sociável'],
    naoGosta: ['Isolamento', 'Rotina monótona', 'Rejeição social', 'Detalhes e burocracia'],
    necessidades: ['Reconhecimento', 'Interação social', 'Ambiente leve', 'Liberdade de expressão'],
  },
  Estabilidade: {
    caracteristicas: ['Calmo', 'Tranquilo', 'Paciente', 'Leal', 'Colaborativo', 'Equilibrado', 'Observador'],
    naoGosta: ['Mudanças frequentes', 'Impaciência', 'Pressão excessiva e competição', 'Falta de harmonia'],
    necessidades: ['Segurança', 'Sentimento de pertencimento', 'Ambiente estável', 'Apoio mútuo', 'Não sofrer pressão excessiva'],
  },
  Conformidade: {
    caracteristicas: ['Preciso', 'Analítico', 'Cuidadoso', 'Organizado', 'Confiável', 'Perfeccionista'],
    naoGosta: ['Desorganização', 'Erros', 'Ambiguidades', 'Pressão por velocidade sem qualidade'],
    necessidades: ['Clareza de regras', 'Tempo para análise', 'Ambiente estruturado', 'Qualidade e precisão'],
  },
}

export interface DiscScores {
  scores: Record<DiscLetter, number>
  pcts: Record<DiscLetter, number>
  perfil: string
  perfilPrincipal: DiscProfileKey
  perfilSecundario: DiscProfileKey | null
  ranking: { letter: DiscLetter; key: DiscProfileKey; score: number; pct: number }[]
}

/** answers: 20 perguntas × 4 opções com valores 1–4 únicos por pergunta */
export function calculateDisc(answers: number[][]): DiscScores {
  if (!validateDiscAnswers(answers)) {
    throw new Error('Respostas DISC inválidas: cada pergunta deve ter 1, 2, 3 e 4 sem repetição.')
  }

  const scores: Record<DiscLetter, number> = { D: 0, I: 0, S: 0, C: 0 }
  answers.forEach((opts, qi) => {
    const map = DISC_SCORE_MAP[qi]
    scores.D += opts[map.D]
    scores.I += opts[map.I]
    scores.S += opts[map.S]
    scores.C += opts[map.C]
  })

  const total = scores.D + scores.I + scores.S + scores.C
  const pcts: Record<DiscLetter, number> = {
    D: total ? scores.D / total : 0,
    I: total ? scores.I / total : 0,
    S: total ? scores.S / total : 0,
    C: total ? scores.C / total : 0,
  }

  const ranking = (['D', 'I', 'S', 'C'] as DiscLetter[])
    .map((letter) => ({
      letter,
      key: DISC_PROFILE_BY_LETTER[letter],
      score: scores[letter],
      pct: pcts[letter],
    }))
    .sort((a, b) => b.score - a.score)

  const top = ranking[0]
  const second = ranking[1]
  const isClose = top.score - second.score <= 4 && second.score > 0
  const perfil = isClose ? `${top.key} / ${second.key}` : top.key

  return {
    scores,
    pcts,
    perfil,
    perfilPrincipal: top.key,
    perfilSecundario: isClose ? second.key : null,
    ranking,
  }
}

export function validateDiscAnswers(answers: unknown): answers is number[][] {
  if (!Array.isArray(answers) || answers.length !== 20) return false
  return answers.every((row) => {
    if (!Array.isArray(row) || row.length !== 4) return false
    if (!row.every((v) => typeof v === 'number' && [1, 2, 3, 4].includes(v))) return false
    return new Set(row).size === 4
  })
}
