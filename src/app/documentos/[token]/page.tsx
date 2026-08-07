'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams } from 'next/navigation'
import {
  Building2, CheckCircle2, XCircle, Clock, Send, Upload,
  FileText, Loader2, AlertTriangle, Eye,
} from 'lucide-react'

interface DocumentoArquivo { id: string; nomeOriginal: string; createdAt: string }
interface DocumentoItem {
  id: string
  status: 'PENDENTE' | 'ENVIADO' | 'APROVADO' | 'REJEITADO'
  motivoRejeicao: string | null
  tipo: { id: string; nome: string }
  arquivos: DocumentoArquivo[]
}
interface DocumentoLinkPublico {
  status: 'ATIVO' | 'EXPIRADO' | 'CONCLUIDO' | 'REVOGADO'
  expiresAt: string
  candidato: { nome: string }
  cargo: string
  itens: DocumentoItem[]
}

const ITEM_STATUS_META: Record<DocumentoItem['status'], { label: string; color: string; icon: React.ElementType }> = {
  PENDENTE:  { label: 'Pendente',           color: '#9CA3AF', icon: Clock },
  ENVIADO:   { label: 'Em análise pelo RH', color: '#3B82F6', icon: Send },
  APROVADO:  { label: 'Aprovado',           color: '#10B981', icon: CheckCircle2 },
  REJEITADO: { label: 'Precisa reenviar',   color: '#EF4444', icon: XCircle },
}

function ItemRow({ item, token, onUploaded }: { item: DocumentoItem; token: string; onUploaded: () => void }) {
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const meta = ITEM_STATUS_META[item.status]
  const Icon = meta.icon
  const arquivo = item.arquivos[0]
  const podeEnviar = item.status !== 'APROVADO'

  async function handleFile(file: File) {
    setError('')
    if (file.size > 15 * 1024 * 1024) { setError('Arquivo muito grande. Limite: 15 MB.'); return }
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Formato inválido. Envie PDF, JPG, PNG ou WEBP.'); return
    }
    setIsUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch(`/api/documentos-candidato/${token}/itens/${item.id}/upload`, { method: 'POST', body: fd })
    setIsUploading(false)
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error ?? 'Erro ao enviar arquivo.'); return }
    onUploaded()
  }

  return (
    <div className="border-b border-gray-100 last:border-0 py-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold mt-0.5"
            style={{ background: meta.color + '18', color: meta.color }}>
            <Icon className="w-3 h-3" /> {meta.label}
          </span>
          <div>
            <p className="text-sm font-medium text-gray-800">{item.tipo.nome}</p>
            {item.status === 'REJEITADO' && item.motivoRejeicao && (
              <p className="text-xs text-red-500 mt-0.5">Motivo: {item.motivoRejeicao}</p>
            )}
            {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {arquivo && (
            <a href={`/api/documentos-candidato/${token}/arquivo/${arquivo.id}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-medium text-[#15AFA4] hover:text-[#0d8c83]">
              <Eye className="w-3.5 h-3.5" /> {arquivo.nomeOriginal}
            </a>
          )}
          {podeEnviar && (
            <>
              <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
              <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {arquivo ? 'Reenviar' : 'Enviar'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default function DocumentosCandidatoPage() {
  const params = useParams()
  const token = params.token as string
  const [data, setData] = useState<DocumentoLinkPublico | null | undefined>(undefined)
  const [erro, setErro] = useState('')

  const load = useCallback(async () => {
    const res = await fetch(`/api/documentos-candidato/${token}`)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setErro(d.error ?? 'Link inválido.')
      setData(null)
      return
    }
    setData(await res.json())
  }, [token])

  useEffect(() => { load() }, [load])

  const aprovados = data?.itens.filter((i) => i.status === 'APROVADO').length ?? 0
  const total = data?.itens.length ?? 0

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">BHCL — Gestão de Pessoas</p>
            <p className="text-xs text-gray-500">Envio de documentos de contratação</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        {data === undefined && (
          <div className="h-40 bg-white rounded-2xl border border-gray-100 animate-pulse" />
        )}

        {data === null && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-3">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto" />
            <p className="text-sm font-medium text-gray-700">{erro}</p>
            <p className="text-xs text-gray-500">Se você acredita que isso é um engano, entre em contato com o RH que enviou este link.</p>
          </div>
        )}

        {data && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h1 className="text-lg font-bold text-gray-900">Olá, {data.candidato.nome.split(' ')[0]}!</h1>
              <p className="text-sm text-gray-500 mt-1">
                Envie abaixo os documentos necessários para a contratação na vaga de <strong>{data.cargo}</strong>.
              </p>

              {data.status === 'REVOGADO' && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 text-red-600 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Este link foi revogado. Fale com o RH para receber um novo.
                </div>
              )}
              {data.status === 'EXPIRADO' && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 text-amber-600 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Este link expirou. Fale com o RH para receber um novo.
                </div>
              )}
              {data.status === 'CONCLUIDO' && (
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-600 text-sm">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" /> Todos os documentos foram aprovados. Obrigado!
                </div>
              )}

              {(data.status === 'ATIVO' || data.status === 'CONCLUIDO') && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span>Progresso</span>
                    <span>{aprovados}/{total} aprovados</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${total ? (aprovados / total) * 100 : 0}%`, background: '#15AFA4' }} />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 px-1">
                No dia da consulta com o Médico do Trabalho, leve:
              </p>
              <ul className="text-xs text-gray-500 space-y-1 px-1 list-disc list-inside">
                <li>Carteira de vacinação atualizada</li>
                <li>Comprovante de vacinação contra COVID-19</li>
                <li>Cartão Nacional do SUS</li>
                <li>RG</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide pt-4 pb-1 px-1">
                Documentos para envio (cópias legíveis)
              </p>
              {data.itens.map((item) => (
                <ItemRow key={item.id} item={item} token={token} onUploaded={load} />
              ))}
            </div>

            <div className="flex items-center gap-2 justify-center pt-2 pb-6">
              <FileText className="w-3.5 h-3.5 text-gray-300" />
              <p className="text-xs text-gray-400">Seus documentos são armazenados de forma segura e o acesso é registrado para auditoria.</p>
            </div>
          </>
        )}
      </main>
    </div>
  )
}
