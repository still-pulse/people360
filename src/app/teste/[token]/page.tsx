'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { BIG_FIVE_ITEMS } from '@/lib/testes/bigfive'
import { DISC_QUESTIONS } from '@/lib/testes/disc'
import '../teste-public.css'

type PublicInfo = {
  tipo: 'BIG_FIVE' | 'DISC'
  status: string
  nome: string
  cargo: string | null
  expiresAt: string
  concluidoAt: string | null
  podeResponder: boolean
}

type Phase = 'loading' | 'error' | 'landing' | 'test' | 'done' | 'blocked'

const LIKERT_LABELS: [string, string][] = [
  ['1', 'Discordo totalmente'],
  ['2', 'Discordo'],
  ['3', 'Neutro'],
  ['4', 'Concordo'],
  ['5', 'Concordo totalmente'],
]

export default function TestePublicoPage() {
  const params = useParams()
  const token = String(params.token ?? '')

  const [info, setInfo] = useState<PublicInfo | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Big Five answers
  const [bfAnswers, setBfAnswers] = useState<(number | null)[]>(() => Array(50).fill(null))
  // DISC answers: 20 x 4
  const [discAnswers, setDiscAnswers] = useState<(number | null)[][]>(() =>
    Array.from({ length: 20 }, () => [null, null, null, null])
  )

  const load = useCallback(async () => {
    setPhase('loading')
    try {
      const res = await fetch(`/api/testes/publico/${token}`)
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Link inválido')
        setPhase('error')
        return
      }
      setInfo(data)
      if (data.status === 'CONCLUIDO') {
        setPhase('done')
      } else if (!data.podeResponder) {
        setErrorMsg(
          data.status === 'EXPIRADO'
            ? 'Este link expirou. Solicite um novo convite ao RH.'
            : 'Este link não está mais disponível.'
        )
        setPhase('blocked')
      } else {
        setPhase('landing')
      }
    } catch {
      setErrorMsg('Não foi possível carregar o teste. Tente novamente.')
      setPhase('error')
    }
  }, [token])

  useEffect(() => {
    if (token) load()
  }, [token, load])

  const bfDone = useMemo(() => bfAnswers.filter((a) => a !== null).length, [bfAnswers])
  const discDone = useMemo(() => {
    return discAnswers.filter((row) => {
      const vals = row.filter((v) => v !== null) as number[]
      return vals.length === 4 && new Set(vals).size === 4
    }).length
  }, [discAnswers])

  const progressPct =
    info?.tipo === 'BIG_FIVE' ? Math.round((bfDone / 50) * 100) : Math.round((discDone / 20) * 100)
  const progressLabel =
    info?.tipo === 'BIG_FIVE'
      ? `${bfDone} de 50 respondidas`
      : `${discDone} de 20 perguntas respondidas`
  const canSubmit = info?.tipo === 'BIG_FIVE' ? bfDone === 50 : discDone === 20

  async function startTest() {
    setPhase('test')
    fetch(`/api/testes/publico/${token}`, { method: 'PATCH' }).catch(() => {})
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function onBfAnswer(i: number, v: number) {
    setBfAnswers((prev) => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  function onDiscSelect(qi: number, oi: number, val: number | null) {
    setDiscAnswers((prev) => {
      const next = prev.map((row) => [...row])
      next[qi][oi] = val
      if (val !== null) {
        next[qi].forEach((v, idx) => {
          if (idx !== oi && v === val) next[qi][idx] = null
        })
      }
      return next
    })
  }

  async function submit() {
    if (!info || !canSubmit || submitting) return
    setSubmitting(true)
    setErrorMsg('')
    try {
      const answers = info.tipo === 'BIG_FIVE' ? bfAnswers : discAnswers
      const res = await fetch(`/api/testes/publico/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrorMsg(data.error || 'Erro ao enviar respostas')
        setSubmitting(false)
        return
      }
      setPhase('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      setErrorMsg('Falha de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const isBigFive = info?.tipo === 'BIG_FIVE'
  const title = isBigFive
    ? 'Avaliação de Personalidade — Big Five (OCEAN)'
    : 'Avaliação de Perfil Comportamental DISC'
  const bannerSrc = isBigFive ? '/testes/bigfive-0.webp' : '/testes/disc-0.webp'
  const heroSrc = isBigFive ? '/testes/bigfive-1.webp' : null

  if (phase === 'loading') {
    return (
      <div className="teste-public flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#00a8a8]" />
      </div>
    )
  }

  if (phase === 'error' || phase === 'blocked') {
    return (
      <div className="teste-public">
        <header className="header">
          <h1>Avaliação BHCL</h1>
          <p>Beneficência Hospitalar de Cesário Lange</p>
        </header>
        <div className="container">
          <div className="card state-box">
            <div className="state-icon warn">!</div>
            <h2>Link indisponível</h2>
            <p>{errorMsg}</p>
          </div>
        </div>
        <footer className="footer">
          <p>Unidade de Gestão de Pessoas · BHCL</p>
        </footer>
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="teste-public">
        <div className="hero-banner">
          <img className="banner-img" src={bannerSrc} alt="" />
        </div>
        <header className="header">
          <h1>{title}</h1>
          <p>Beneficência Hospitalar de Cesário Lange — Núcleo Alphaville</p>
        </header>
        <div className="container">
          <div className="card state-box fade-up">
            <div className="state-icon ok">✓</div>
            <h2>Avaliação enviada com sucesso</h2>
            <p>
              Obrigado, <strong>{info?.nome}</strong>! Suas respostas foram registradas.
              O RH receberá o resultado e entrará em contato se necessário.
            </p>
            <p style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
              Você já pode fechar esta página.
            </p>
          </div>
        </div>
        <footer className="footer">
          <p>Unidade de Gestão de Pessoas · Beneficência Hospitalar de Cesário Lange</p>
        </footer>
      </div>
    )
  }

  return (
    <div className="teste-public">
      <div className="hero-banner">
        <img className="banner-img" src={bannerSrc} alt="" />
      </div>
      <header className="header">
        <h1>{title}</h1>
        <p>Beneficência Hospitalar de Cesário Lange — Núcleo Alphaville</p>
      </header>

      <div className="container">
        {phase === 'landing' && (
          <div className="landing">
            {heroSrc && (
              <div className="hero-img-wrap fade-up">
                <img src={heroSrc} alt="5 dimensões, um perfil único" />
                <div className="hero-cta-overlay">
                  <span className="hint">
                    {isBigFive ? '50 perguntas · ~10 min' : '20 perguntas · ~15 min'} · resultado para o RH
                  </span>
                  <button type="button" className="cta-gold" onClick={startTest}>
                    {isBigFive ? 'Mapear minha personalidade →' : 'Iniciar avaliação DISC →'}
                  </button>
                </div>
              </div>
            )}

            {!heroSrc && (
              <div className="card fade-up" style={{ textAlign: 'center' }}>
                <h2 style={{ justifyContent: 'center' }}>Perfil comportamental DISC</h2>
                <p style={{ color: 'var(--muted)', marginBottom: '1.25rem' }}>
                  20 perguntas · ranqueie as opções de 4 (mais parecido) a 1 (menos parecido)
                </p>
                <button type="button" className="cta-teal" onClick={startTest}>
                  Iniciar avaliação DISC →
                </button>
              </div>
            )}

            <div className="fade-up">
              <div className="section-label">Como funciona</div>
              <h3 className="section-title">Simples, seguro e confidencial</h3>
              <div className="how-box" style={{ marginTop: 0 }}>
                <div className="how-steps">
                  <div className="how-step">
                    <div className="step-num">1</div>
                    <h4>Responda com sinceridade</h4>
                    <p>Não há resposta certa ou errada — o objetivo é mapear o seu estilo.</p>
                  </div>
                  <div className="how-step">
                    <div className="step-num">2</div>
                    <h4>Envie ao final</h4>
                    <p>As respostas vão direto para o RH da BHCL, de forma segura.</p>
                  </div>
                  <div className="how-step">
                    <div className="step-num">3</div>
                    <h4>Privacidade</h4>
                    <p>O relatório detalhado fica disponível apenas para a equipe de RH.</p>
                  </div>
                </div>
              </div>
            </div>

            {isBigFive && (
              <div className="fade-up">
                <div className="section-label">O que é o Big Five</div>
                <h3 className="section-title">Cinco dimensões da personalidade</h3>
                <div className="receive-grid">
                  <div className="receive-card">
                    <div className="num">E</div>
                    <h4>Extroversão</h4>
                    <p>Energia social e presença entre pessoas.</p>
                  </div>
                  <div className="receive-card">
                    <div className="num">A</div>
                    <h4>Agradabilidade</h4>
                    <p>Empatia, cooperação e confiança no grupo.</p>
                  </div>
                  <div className="receive-card">
                    <div className="num">C</div>
                    <h4>Conscienciosidade</h4>
                    <p>Metas, ordem, disciplina e entrega.</p>
                  </div>
                  <div className="receive-card">
                    <div className="num">N</div>
                    <h4>Neuroticismo</h4>
                    <p>Sensibilidade a estresse e oscilações.</p>
                  </div>
                  <div className="receive-card">
                    <div className="num">O</div>
                    <h4>Abertura</h4>
                    <p>Curiosidade, imaginação e o novo.</p>
                  </div>
                </div>
              </div>
            )}

            <div className="start-cta-bar fade-up">
              <p>
                Pronto, {info?.nome.split(' ')[0]}? Vamos começar.
              </p>
              <button type="button" className="cta-teal" onClick={startTest}>
                Começar o teste →
              </button>
            </div>
          </div>
        )}

        {phase === 'test' && info && (
          <>
            <div className="card" id="infoCard">
              <h2>👤 Seus dados</h2>
              <div className="form-grid">
                <div className="form-group">
                  <label>Nome Completo</label>
                  <input type="text" value={info.nome} disabled />
                </div>
                <div className="form-group">
                  <label>Função / Cargo</label>
                  <input type="text" value={info.cargo || '—'} disabled />
                </div>
              </div>
            </div>

            <div className="intro">
              {isBigFive ? (
                <>
                  <strong>Como funciona:</strong> Responda 50 afirmações de <strong>1</strong> (discordo
                  totalmente) a <strong>5</strong> (concordo totalmente). Seja sincero(a) — cerca de 10
                  minutos.
                  <div className="factors-mini">
                    <span className="factor-chip e">E Extroversão</span>
                    <span className="factor-chip a">A Agradabilidade</span>
                    <span className="factor-chip c">C Conscienciosidade</span>
                    <span className="factor-chip n">N Neuroticismo</span>
                    <span className="factor-chip o">O Abertura</span>
                  </div>
                </>
              ) : (
                <>
                  <strong>Como funciona:</strong> Em cada pergunta, ranqueie as 4 opções usando{' '}
                  <strong>4</strong> (mais se identifica) até <strong>1</strong> (menos se identifica),{' '}
                  <em>sem repetir números</em> na mesma pergunta.
                </>
              )}
            </div>

            <div className="progress-wrap">
              <div className="progress-bar-bg">
                <div className="progress-bar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="progress-text">
                <span>{progressLabel}</span>
                <span>{progressPct}%</span>
              </div>
            </div>

            {isBigFive &&
              BIG_FIVE_ITEMS.map((item, i) => (
                <div key={item.n} className={`q-card${bfAnswers[i] != null ? ' done' : ''}`}>
                  <div className="q-text">
                    <span className="q-num">{item.n}</span>
                    <span>{item.t}</span>
                  </div>
                  <div className="likert">
                    {LIKERT_LABELS.map(([v, l]) => (
                      <label key={v}>
                        <input
                          type="radio"
                          name={`q${i}`}
                          value={v}
                          checked={bfAnswers[i] === Number(v)}
                          onChange={() => onBfAnswer(i, Number(v))}
                        />
                        <span className="dot" />
                        <span className="lbl">{l}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

            {!isBigFive &&
              DISC_QUESTIONS.map((item, qi) => {
                const vals = discAnswers[qi].filter((v) => v !== null) as number[]
                const complete = vals.length === 4 && new Set(vals).size === 4
                const hasError = vals.length > 0 && !complete
                return (
                  <div
                    key={qi}
                    className={`question-card${complete ? ' complete' : ''}${hasError ? ' error' : ''}`}
                  >
                    <div className="q-header">
                      <div className="q-num">{qi + 1}</div>
                      <div className="q-text" style={{ marginBottom: 0 }}>
                        {item.q}
                      </div>
                    </div>
                    <div>
                      {item.opts.map((opt, oi) => (
                        <div className="option-row" key={oi}>
                          <select
                            className={discAnswers[qi][oi] != null ? 'has-value' : ''}
                            value={discAnswers[qi][oi] ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value
                              onDiscSelect(qi, oi, raw === '' ? null : Number(raw))
                            }}
                          >
                            <option value="">—</option>
                            <option value="4">4</option>
                            <option value="3">3</option>
                            <option value="2">2</option>
                            <option value="1">1</option>
                          </select>
                          <span className="option-text">{opt}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

            {errorMsg && (
              <div className="card" style={{ borderColor: '#fca5a5', color: '#b91c1c' }}>
                {errorMsg}
              </div>
            )}

            <div className="btn-group">
              <button
                type="button"
                className="btn btn-primary"
                disabled={!canSubmit || submitting}
                onClick={submit}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Enviando…
                  </>
                ) : isBigFive ? (
                  '📊 Enviar meu mapa Big Five'
                ) : (
                  '📊 Enviar avaliação DISC'
                )}
              </button>
            </div>
          </>
        )}
      </div>

      <footer className="footer">
        <p>Unidade de Gestão de Pessoas · Beneficência Hospitalar de Cesário Lange — Núcleo Alphaville</p>
        <p style={{ marginTop: '0.25rem' }}>
          {isBigFive
            ? 'Big Five (OCEAN) · Autoconhecimento e Desenvolvimento de Pessoas'
            : 'DISC · Perfil Comportamental'}
        </p>
      </footer>
    </div>
  )
}
