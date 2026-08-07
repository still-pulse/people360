'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { TraitBars, buildTypeCode } from '@/components/pareceres/TraitBars'
import { CompetenciasRadar } from '@/components/pareceres/CompetenciasRadar'
import {
  ParecerData,
  PARECER_RESULTADO_LABELS,
  PARECER_RESULTADO_COLORS,
  TIPO_VINCULO_PARECER_LABELS,
  PARECER_APRESENTACAO_PARES,
  type ParecerCompetencias,
} from '@/types'
import { formatDate, cn } from '@/lib/utils'
import { ArrowLeft, Edit2, Trash2, Printer, Mail, MessageCircle } from 'lucide-react'

function onlyDigits(v: string) {
  return v.replace(/\D/g, '')
}

function buildWhatsappLink(parecer: ParecerData, resultadoLabel: string, url: string) {
  const msg = `Parecer de Recrutamento — ${parecer.candidatoNome}\nCargo: ${parecer.cargo}\nResultado: ${resultadoLabel}\n\nAcesse o parecer completo: ${url}`
  const telefone = onlyDigits(parecer.controleCandidato?.telefone || '')
  const phonePart = telefone ? (telefone.length <= 11 ? `55${telefone}` : telefone) : ''
  return `https://wa.me/${phonePart}?text=${encodeURIComponent(msg)}`
}

export default function ParecerDetalhePage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const { data: session } = useSession()
  const [parecer, setParecer] = useState<ParecerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showEmailModal, setShowEmailModal] = useState(false)
  const [emailTo, setEmailTo] = useState('')
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailError, setEmailError] = useState('')

  const canEdit = session?.user?.role !== 'JURIDICO'
  const canDelete =
    canEdit &&
    (session?.user?.role === 'ADMIN' || parecer?.elaborador?.id === session?.user?.id)

  useEffect(() => {
    fetch(`/api/pareceres/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Erro')
        return r.json()
      })
      .then(setParecer)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleDelete() {
    if (!parecer || !confirm(`Excluir o parecer de "${parecer.candidatoNome}"?`)) return
    const res = await fetch(`/api/pareceres/${id}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json()
      alert(d.error || 'Erro ao excluir')
      return
    }
    router.push('/pareceres')
  }

  async function handleSendEmail() {
    if (!emailTo.trim()) {
      setEmailError('Informe o e-mail do destinatário')
      return
    }
    setSendingEmail(true)
    setEmailError('')
    try {
      const res = await fetch(`/api/pareceres/${id}/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: emailTo.trim() }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || 'Erro ao enviar e-mail')
      setShowEmailModal(false)
      setEmailTo('')
      alert('E-mail enviado com sucesso.')
    } catch (e: any) {
      setEmailError(e.message)
    } finally {
      setSendingEmail(false)
    }
  }

  // CSS de impressão: esconde sidebar/header/ações, mostra só o conteúdo do parecer
  useEffect(() => {
    const el = document.createElement('style')
    el.id = 'parecer-print-css'
    el.textContent = `
      @media print {
        aside, header, .print-hide { display: none !important; }
        main { margin-left: 0 !important; }
        body { background: white !important; }
      }
    `
    document.head.appendChild(el)
    return () => { document.getElementById('parecer-print-css')?.remove() }
  }, [])

  if (loading) {
    return (
      <>
        <Header title="Parecer" subtitle="Carregando..." />
        <div className="p-6 text-sm text-gray-400">Carregando parecer...</div>
      </>
    )
  }

  if (error || !parecer) {
    return (
      <>
        <Header title="Parecer" subtitle="Não encontrado" />
        <div className="p-6">
          <p className="text-sm text-red-600 mb-4">{error || 'Parecer não encontrado'}</p>
          <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.push('/pareceres')}>
            Voltar
          </Button>
        </div>
      </>
    )
  }

  const typeCode = buildTypeCode({
    traitEI: parecer.traitEI,
    traitNS: parecer.traitNS,
    traitTF: parecer.traitTF,
    traitJP: parecer.traitJP,
    traitAT: parecer.traitAT,
  })

  const resultadoLabel = parecer.resultado ? PARECER_RESULTADO_LABELS[parecer.resultado] : 'Em análise'
  const parecerUrl = typeof window !== 'undefined' ? window.location.href : ''
  const whatsappLink = buildWhatsappLink(parecer, resultadoLabel, parecerUrl)

  return (
    <>
      <Header
        title={parecer.candidatoNome}
        subtitle={`Parecer R&S · ${parecer.cargo}`}
      />
      <div className="p-6 space-y-5 max-w-5xl">
        <div className="flex items-center justify-between gap-3 flex-wrap print-hide">
          <Button variant="ghost" size="sm" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.push('/pareceres')}>
            Voltar
          </Button>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" icon={<Printer className="w-3.5 h-3.5" />} onClick={() => window.print()}>
              Imprimir
            </Button>
            <Button variant="outline" size="sm" icon={<Mail className="w-3.5 h-3.5" />} onClick={() => setShowEmailModal(true)}>
              E-mail
            </Button>
            <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" icon={<MessageCircle className="w-3.5 h-3.5" />}>
                WhatsApp
              </Button>
            </a>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                icon={<Edit2 className="w-3.5 h-3.5" />}
                onClick={() => router.push(`/pareceres/${id}/editar`)}
              >
                Editar
              </Button>
            )}
            {canDelete && (
              <Button variant="danger" size="sm" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={handleDelete}>
                Excluir
              </Button>
            )}
          </div>
        </div>

        {/* Resumo */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs text-gray-400 font-mono mb-1">{parecer.codigo} · Rev. {parecer.revisao}</p>
                <h2 className="text-xl font-bold text-gray-900">{parecer.candidatoNome}</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {parecer.cargo}
                  {parecer.idade != null ? ` · ${parecer.idade} anos` : ''}
                  {' · '}
                  {TIPO_VINCULO_PARECER_LABELS[parecer.tipoVinculo]}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Avaliação em {formatDate(parecer.dataAvaliacao)}
                  {parecer.elaborador ? ` · Elaborado por ${parecer.elaborador.name}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="font-mono text-sm font-bold px-3 py-1.5 rounded-xl bg-gray-900 text-white">
                  {typeCode}
                </span>
                {parecer.resultado && (
                  <span
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                    style={{ background: PARECER_RESULTADO_COLORS[parecer.resultado] }}
                  >
                    {PARECER_RESULTADO_LABELS[parecer.resultado]}
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 pt-5 border-t border-gray-100 text-sm">
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Razão Social</p>
                <p className="text-gray-700 font-medium">{parecer.razaoSocial}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">CNPJ</p>
                <p className="text-gray-700 font-medium">{parecer.cnpj}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 mb-0.5">Unidade</p>
                <p className="text-gray-700 font-medium">
                  {parecer.unit ? (
                    <span className="inline-flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: parecer.unit.color }} />
                      {parecer.unit.name}
                    </span>
                  ) : '—'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Traços — resultado visual */}
        <Card>
          <CardContent className="pt-5">
            <TraitBars
              readOnly
              values={{
                traitEI: parecer.traitEI,
                traitNS: parecer.traitNS,
                traitTF: parecer.traitTF,
                traitJP: parecer.traitJP,
                traitAT: parecer.traitAT,
              }}
            />
            {parecer.dataAvaliacao && (
              <p className="text-xs text-gray-400 mt-4 pt-3 border-t border-gray-100">
                Teste realizado: {formatDate(parecer.dataAvaliacao)}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Competências radar */}
        <Card>
          <CardContent className="pt-5">
            <CompetenciasRadar
              readOnly
              values={(parecer.competencias || {}) as ParecerCompetencias}
            />
          </CardContent>
        </Card>

        {/* Apresentação & Verbalização */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHeader>
              <CardTitle>Apresentou-se de Forma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {PARECER_APRESENTACAO_PARES.map((pair) => {
                const leftOn = parecer.apresentacao?.includes(pair.left)
                const rightOn = parecer.apresentacao?.includes(pair.right)
                if (!leftOn && !rightOn) return null
                return (
                  <div
                    key={pair.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-gray-100 px-3 py-2 text-sm"
                  >
                    <span className={cn('font-medium', leftOn ? 'text-[#0d8c83]' : 'text-gray-300')}>
                      {pair.left}
                    </span>
                    <span className="text-[10px] text-gray-400 uppercase">ou</span>
                    <span className={cn('font-medium text-right', rightOn ? 'text-[#0d8c83]' : 'text-gray-300')}>
                      {pair.right}
                    </span>
                  </div>
                )
              })}
              {!parecer.apresentacao?.length && (
                <p className="text-sm text-gray-400">Nenhum marcado</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Verbalização</CardTitle>
            </CardHeader>
            <CardContent>
              {parecer.verbalizacao?.length ? (
                <ul className="space-y-2">
                  {parecer.verbalizacao.map((v) => (
                    <li key={v} className="text-sm text-gray-700 flex gap-2">
                      <span className="text-[#15AFA4] font-bold">✓</span>
                      {v}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-gray-400">Nenhum marcado</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Técnicas */}
        <Card>
          <CardHeader>
            <CardTitle>Técnicas Utilizadas</CardTitle>
          </CardHeader>
          <CardContent>
            {parecer.tecnicas?.length || parecer.tecnicasOutros ? (
              <div className="flex flex-wrap gap-2">
                {parecer.tecnicas?.map((t) => (
                  <span key={t} className="px-3 py-1 rounded-full text-xs font-medium bg-violet-50 text-violet-700 border border-violet-200">
                    {t}
                  </span>
                ))}
                {parecer.tecnicasOutros && (
                  <span className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                    Outros: {parecer.tecnicasOutros}
                  </span>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Nenhuma técnica registrada</p>
            )}
          </CardContent>
        </Card>

        {/* Análise */}
        <Card>
          <CardHeader>
            <CardTitle>Análise Seleção — Parecer do Candidato</CardTitle>
          </CardHeader>
          <CardContent>
            {parecer.analiseTexto ? (
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap leading-relaxed">
                {parecer.analiseTexto}
              </div>
            ) : (
              <p className="text-sm text-gray-400">Sem análise registrada</p>
            )}
            <p className="text-[11px] text-gray-400 mt-6 pt-4 border-t border-gray-100 italic">
              *Os resultados indicados nesta avaliação não devem ser considerados imutáveis, sendo suscetíveis a mudanças a partir das experiências vividas pelo avaliado. O laudo é um documento confidencial, seu conteúdo não pode ser exposto.
            </p>
            {parecer.dataAssinatura && (
              <p className="text-xs text-gray-500 mt-4">
                Assinatura do Analista Selecionador — Data: {formatDate(parecer.dataAssinatura)}
                {parecer.elaborador ? ` · ${parecer.elaborador.name}` : ''}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Modal open={showEmailModal} onClose={() => setShowEmailModal(false)} title="Enviar parecer por e-mail" size="sm">
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">
            Será enviado um resumo do parecer de <strong>{parecer.candidatoNome}</strong> com um link de acesso ao documento completo.
          </p>
          <Input
            label="E-mail do destinatário"
            type="email"
            placeholder="nome@empresa.com"
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            error={emailError}
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowEmailModal(false)}>
              Cancelar
            </Button>
            <Button size="sm" isLoading={sendingEmail} onClick={handleSendEmail}>
              Enviar
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
