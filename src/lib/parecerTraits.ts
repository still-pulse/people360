export type TraitValues = {
  traitEI: number
  traitNS: number
  traitTF: number
  traitJP: number
  traitAT: number
}

function clamp(n: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

/**
 * Calcula o perfil comportamental (0–100, polo direito) a partir de
 * "Apresentou-se de Forma" e "Verbalização".
 *
 * Escala:
 *  traitEI — Extravertido (0) ↔ Introvertido (100)
 *  traitNS — Intuitivo (0) ↔ Observador (100)
 *  traitTF — Pensamento (0) ↔ Sentimento (100)
 *  traitJP — Julgamento (0) ↔ Prospecção (100)
 *  traitAT — Assertivo (0) ↔ Turbulento (100)
 */
export function calcularTraços(
  apresentacao: string[] = [],
  verbalizacao: string[] = []
): TraitValues {
  const has = (s: string) => apresentacao.includes(s)
  const hasV = (s: string) => verbalizacao.includes(s)

  // Base neutra
  let EI = 50
  let NS = 50
  let TF = 50
  let JP = 50
  let AT = 50

  // ── Apresentação (pares exclusivos — pesos fortes) ───────────────────────
  // Extrovertido ↔ Introvertido
  if (has('Extrovertido')) EI -= 32
  if (has('Introvertido')) EI += 32

  // Calmo/Tranquilo ↔ Agitado
  if (has('Calmo/Tranquilo')) {
    AT -= 22
    JP -= 10
  }
  if (has('Agitado')) {
    AT += 22
    JP += 12
  }

  // Espontâneo ↔ Tímido
  if (has('Espontâneo')) {
    EI -= 12
    JP += 18
    AT -= 6
  }
  if (has('Tímido')) {
    EI += 14
    AT += 10
    JP -= 6
  }

  // Atencioso ↔ Desfocado
  if (has('Atencioso')) {
    NS += 18
    TF += 14
    JP -= 8
  }
  if (has('Desfocado')) {
    NS -= 12
    JP += 16
    AT += 8
  }

  // Educado ↔ Ríspido
  if (has('Educado')) {
    TF += 16
    AT -= 8
  }
  if (has('Ríspido')) {
    TF -= 20
    AT += 10
  }

  // Receptivo ↔ Ansioso
  if (has('Receptivo')) {
    TF += 12
    AT -= 10
    EI -= 6
  }
  if (has('Ansioso')) {
    AT += 24
    EI += 6
  }

  // ── Verbalização ─────────────────────────────────────────────────────────
  if (hasV('Facilidade para expressar seu ponto de vista / Verbalização Clara e Objetiva')) {
    EI -= 14
    AT -= 12
    JP -= 6
  }
  if (hasV('Dificuldade para expressar seu ponto de vista / Verbalização Confusa')) {
    EI += 14
    AT += 12
    JP += 6
  }
  if (hasV('Facilidade para ouvir')) {
    TF += 14
    NS += 12
  }
  if (hasV('Falta habilidade para ouvir')) {
    TF -= 12
    NS -= 8
  }
  if (hasV('Tranquila/segura')) {
    AT -= 18
    JP -= 8
  }

  // Se nada foi marcado, permanece 50/50
  return {
    traitEI: clamp(EI),
    traitNS: clamp(NS),
    traitTF: clamp(TF),
    traitJP: clamp(JP),
    traitAT: clamp(AT),
  }
}

/** Alterna um lado de um par exclusivo: seleciona left/right ou limpa se clicar de novo. */
export function toggleExclusivePair(
  current: string[],
  left: string,
  right: string,
  chosen: string
): string[] {
  const without = current.filter((x) => x !== left && x !== right)
  if (current.includes(chosen)) return without
  return [...without, chosen]
}
