'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import {
  Upload, Trash2, X, FileText, Image as ImageIcon, Plus, Filter, Video, Pencil, Download,
} from 'lucide-react'

// ─── Types ───────────────────────────────────────────────────────────────────

type Categoria = 'DIVULGACAO_VAGA' | 'CONTRATACAO' | 'DIVULGACAO_INTERNA' | 'PARCERIA'

interface Arquivo {
  id: string
  nome: string
  url: string
  tamanho: number
  tipo: string
  tipoDoc: string | null
}

interface Evidencia {
  id: string
  categoria: Categoria
  year: number
  month: number
  unitId: string | null
  descricao: string | null
  nomePCD: string | null
  arquivos: Arquivo[]
  createdAt: string
  unit: { id: string; name: string } | null
  createdBy: { name: string } | null
}

interface Unit {
  id: string
  name: string
}

// ─── Constants ───────────────────────────────────────────────────────────────

const CATEGORIAS: { key: Categoria; label: string; desc: string; hasUnit: boolean }[] = [
  {
    key: 'DIVULGACAO_VAGA',
    label: 'Divulgação de Vagas',
    desc: 'LinkedIn, redes, jornal, portais',
    hasUnit: false,
  },
  {
    key: 'CONTRATACAO',
    label: 'Contratação PCD',
    desc: 'Ficha de registro e laudo médico',
    hasUnit: true,
  },
  {
    key: 'DIVULGACAO_INTERNA',
    label: 'Divulgação Interna',
    desc: 'WhatsApp, e-mails, campanhas internas',
    hasUnit: true,
  },
  {
    key: 'PARCERIA',
    label: 'Parcerias',
    desc: 'Ações e parcerias institucionais',
    hasUnit: true,
  },
]

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const ACCENT = '#15AFA4'

function fmtSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ─── File thumbnail ───────────────────────────────────────────────────────────

function FileThumbnail({ arq, onDelete }: { arq: Arquivo; onDelete?: () => void }) {
  const isImage = arq.tipo.startsWith('image/')
  const isVideo = arq.tipo.startsWith('video/')
  const isPdf   = arq.tipo === 'application/pdf'
  return (
    <div className="relative group flex flex-col items-center gap-1 w-20">
      <a
        href={arq.url}
        target="_blank"
        rel="noreferrer"
        className="block w-16 h-16 rounded-lg overflow-hidden border border-gray-200 bg-gray-50 flex items-center justify-center hover:border-[#15AFA4] transition-colors"
      >
        {isImage ? (
          <img src={arq.url} alt={arq.nome} className="w-full h-full object-cover" />
        ) : isVideo ? (
          <video src={arq.url} className="w-full h-full object-cover" muted playsInline />
        ) : isPdf ? (
          <FileText className="text-red-400" size={28} />
        ) : (
          <Video className="text-blue-400" size={28} />
        )}
      </a>
      <span className="text-[10px] text-gray-500 truncate w-20 text-center">{arq.nome}</span>
      {onDelete && (
        <button
          onClick={onDelete}
          className="absolute -top-1 -right-1 hidden group-hover:flex w-5 h-5 rounded-full bg-red-500 text-white items-center justify-center shadow"
          title="Remover arquivo"
        >
          <X size={10} />
        </button>
      )}
    </div>
  )
}

// ─── Evidence card ────────────────────────────────────────────────────────────

function EvidenciaCard({ ev, onDelete, onEdit, canEdit }: { ev: Evidencia; onDelete: () => void; onEdit: () => void; canEdit: boolean }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <span className="text-xs font-medium px-2 py-0.5 rounded-full text-white" style={{ background: ACCENT }}>
            {MONTHS[ev.month - 1]}/{ev.year}
          </span>
          {ev.unit && (
            <span className="ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {ev.unit.name}
            </span>
          )}
          {ev.nomePCD && (
            <p className="mt-1.5 text-sm font-semibold text-gray-800">{ev.nomePCD}</p>
          )}
          {ev.descricao && (
            <p className="mt-1 text-xs text-gray-500 whitespace-pre-wrap">{ev.descricao}</p>
          )}
        </div>
        {canEdit && (
          <div className="shrink-0 flex items-center gap-1">
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-gray-400 hover:text-[#15AFA4] hover:bg-teal-50 transition-colors"
              title="Editar evidência"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
              title="Excluir evidência"
            >
              <Trash2 size={14} />
            </button>
          </div>
        )}
      </div>

      {ev.arquivos.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {ev.arquivos.map(arq => (
            <FileThumbnail key={arq.id} arq={arq} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Sem arquivos anexados.</p>
      )}

      {ev.createdBy && (
        <p className="text-[10px] text-gray-400 mt-auto">
          Por {ev.createdBy.name} em {new Date(ev.createdAt).toLocaleDateString('pt-BR')}
        </p>
      )}
    </div>
  )
}

// ─── Upload drop zone ─────────────────────────────────────────────────────────

interface DropZoneProps {
  label: string
  files: File[]
  onChange: (files: File[]) => void
  multiple?: boolean
  tipoDoc?: string
}

function DropZone({ label, files, onChange, multiple = true }: DropZoneProps) {
  const ref = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  function handleFiles(newFiles: File[]) {
    if (multiple) onChange([...files, ...newFiles])
    else onChange(newFiles.slice(0, 1))
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-gray-700">{label}</label>
      <div
        className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-colors ${
          drag ? 'border-[#15AFA4] bg-teal-50' : 'border-gray-200 hover:border-[#15AFA4]'
        }`}
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault()
          setDrag(false)
          handleFiles(Array.from(e.dataTransfer.files))
        }}
      >
        <Upload size={20} className="mx-auto mb-1 text-gray-400" />
        <p className="text-xs text-gray-500">
          {multiple ? 'Arraste ou clique para adicionar arquivos' : 'Arraste ou clique para selecionar'}
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG, PDF, MP4, MOV, WebM — máx. 200 MB</p>
        <input
          ref={ref}
          type="file"
          accept="image/*,application/pdf,video/*"
          multiple={multiple}
          className="hidden"
          onChange={e => handleFiles(Array.from(e.target.files ?? []))}
        />
      </div>
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-1 bg-gray-100 rounded-lg text-xs">
              {f.type.startsWith('image/') ? (
                <ImageIcon size={12} className="text-blue-400" />
              ) : f.type.startsWith('video/') ? (
                <Video size={12} className="text-purple-400" />
              ) : (
                <FileText size={12} className="text-red-400" />
              )}
              <span className="max-w-[120px] truncate">{f.name}</span>
              <span className="text-gray-400">({fmtSize(f.size)})</span>
              <button
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="ml-0.5 text-gray-400 hover:text-red-500"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function EvidenciasPCDPage() {
  const { data: session } = useSession()
  const canEdit = session?.user?.role !== 'JURIDICO'

  const [activeTab, setActiveTab] = useState<Categoria>('DIVULGACAO_VAGA')
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState<string>('')
  const [unitId, setUnitId] = useState<string>('')
  const [evidencias, setEvidencias] = useState<Evidencia[]>([])
  const [units, setUnits] = useState<Unit[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingCategoria, setEditingCategoria] = useState<Categoria>('DIVULGACAO_VAGA')

  // Modal form state
  const [fYear, setFYear] = useState(new Date().getFullYear())
  const [fMonth, setFMonth] = useState(new Date().getMonth() + 1)
  const [fUnitId, setFUnitId] = useState('')
  const [fDescricao, setFDescricao] = useState('')
  const [fNomePCD, setFNomePCD] = useState('')
  const [fFiles, setFFiles] = useState<File[]>([])
  const [fFicha, setFFicha] = useState<File[]>([])
  const [fLaudo, setFLaudo] = useState<File[]>([])
  const [fExistingArquivos, setFExistingArquivos] = useState<Arquivo[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const cat = CATEGORIAS.find(c => c.key === activeTab)!

  useEffect(() => {
    fetch('/api/units')
      .then(r => r.json())
      .then(d => setUnits(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const fetchEvidencias = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ categoria: activeTab, year: String(year) })
    if (month) params.set('month', month)
    if (unitId) params.set('unitId', unitId)
    const res = await fetch(`/api/pcd/evidencias?${params}`)
    const data = await res.json()
    setEvidencias(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [activeTab, year, month, unitId])

  useEffect(() => {
    setUnitId('')
    setMonth('')
    fetchEvidencias()
  }, [activeTab])

  useEffect(() => {
    fetchEvidencias()
  }, [year, month, unitId])

  function openModal() {
    setEditingId(null)
    setFYear(year)
    setFMonth(month ? parseInt(month) : new Date().getMonth() + 1)
    setFUnitId(unitId || '')
    setFDescricao('')
    setFNomePCD('')
    setFFiles([])
    setFFicha([])
    setFLaudo([])
    setError('')
    setModalOpen(true)
  }

  function openEditModal(ev: Evidencia) {
    setEditingId(ev.id)
    setEditingCategoria(ev.categoria)
    setFYear(ev.year)
    setFMonth(ev.month)
    setFUnitId(ev.unitId || '')
    setFDescricao(ev.descricao || '')
    setFNomePCD(ev.nomePCD || '')
    setFFiles([])
    setFFicha([])
    setFLaudo([])
    setFExistingArquivos([...ev.arquivos])
    setError('')
    setModalOpen(true)
  }

  async function removeExistingArquivo(arqId: string) {
    await fetch(`/api/pcd/arquivos/${arqId}`, { method: 'DELETE' })
    setFExistingArquivos(prev => prev.filter(a => a.id !== arqId))
    setEvidencias(prev => prev.map(e =>
      e.id === editingId
        ? { ...e, arquivos: e.arquivos.filter(a => a.id !== arqId) }
        : e
    ))
  }

  const CHUNK_SIZE = 20 * 1024 * 1024 // 20MB — bem abaixo do limite de upload da Cloudflare

  async function uploadFile(file: File, tipoDoc?: string) {
    if (file.size <= CHUNK_SIZE) {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload/pcd-evidencia', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      const data = await res.json()
      return { ...data, tipoDoc: tipoDoc ?? null }
    }

    const uploadId = crypto.randomUUID()
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    let data: { url: string; nome: string; tamanho: number; tipo: string } | null = null

    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE
      const chunk = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))
      const fd = new FormData()
      fd.append('chunk', chunk)
      fd.append('uploadId', uploadId)
      fd.append('chunkIndex', String(i))
      fd.append('totalChunks', String(totalChunks))
      fd.append('fileName', file.name)
      fd.append('fileType', file.type)
      fd.append('fileSize', String(file.size))
      const res = await fetch('/api/upload/pcd-evidencia/chunk', { method: 'POST', body: fd })
      if (!res.ok) throw new Error(await res.text())
      data = await res.json()
    }

    return { ...data!, tipoDoc: tipoDoc ?? null }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fYear || !fMonth) { setError('Preencha ano e mês.'); return }
    if (cat.hasUnit && !fUnitId) { setError('Selecione uma unidade.'); return }
    if (!editingId && activeTab === 'CONTRATACAO' && !fNomePCD) { setError('Informe o nome do colaborador PCD.'); return }

    setSubmitting(true)
    setError('')
    try {
      if (editingId) {
        const editCat = CATEGORIAS.find(c => c.key === editingCategoria)!
        const novosArquivos: Array<{ url: string; nome: string; tamanho: number; tipo: string; tipoDoc: string | null }> = []
        if (editingCategoria === 'CONTRATACAO') {
          for (const f of fFicha) novosArquivos.push(await uploadFile(f, 'ficha_registro'))
          for (const f of fLaudo) novosArquivos.push(await uploadFile(f, 'laudo_medico'))
        } else {
          for (const f of fFiles) novosArquivos.push(await uploadFile(f))
        }
        const res = await fetch(`/api/pcd/evidencias/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            year: fYear,
            month: fMonth,
            unitId: editCat.hasUnit ? fUnitId || null : null,
            descricao: fDescricao || null,
            nomePCD: editingCategoria === 'CONTRATACAO' ? fNomePCD || null : null,
            novosArquivos: novosArquivos.length ? novosArquivos : undefined,
          }),
        })
        if (!res.ok) throw new Error('Erro ao atualizar evidência.')
        const updated: Evidencia = await res.json()
        setEvidencias(prev => prev.map(e => e.id === editingId ? updated : e))
      } else {
        const arquivos: Array<{ url: string; nome: string; tamanho: number; tipo: string; tipoDoc: string | null }> = []
        if (activeTab === 'CONTRATACAO') {
          for (const f of fFicha) arquivos.push(await uploadFile(f, 'ficha_registro'))
          for (const f of fLaudo) arquivos.push(await uploadFile(f, 'laudo_medico'))
        } else {
          for (const f of fFiles) arquivos.push(await uploadFile(f))
        }
        const res = await fetch('/api/pcd/evidencias', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            categoria: activeTab,
            year: fYear,
            month: fMonth,
            unitId: cat.hasUnit ? fUnitId || null : null,
            descricao: fDescricao || null,
            nomePCD: activeTab === 'CONTRATACAO' ? fNomePCD : null,
            arquivos,
          }),
        })
        if (!res.ok) throw new Error('Erro ao salvar evidência.')
        await fetchEvidencias()
      }
      setModalOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido.')
    } finally {
      setSubmitting(false)
    }
  }

  async function deleteEvidencia(id: string) {
    if (!confirm('Excluir esta evidência e todos os seus arquivos?')) return
    await fetch(`/api/pcd/evidencias/${id}`, { method: 'DELETE' })
    setEvidencias(prev => prev.filter(e => e.id !== id))
  }

  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    setDownloading(true)
    try {
      const params = new URLSearchParams({ categoria: activeTab, year: String(year) })
      if (month) params.set('month', month)
      if (unitId) params.set('unitId', unitId)
      const res = await fetch(`/api/pcd/evidencias/download?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Erro ao gerar ZIP.' }))
        alert(err.error ?? 'Erro ao gerar ZIP.')
        return
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="?([^"]+)"?/)
      const fileName = match ? match[1] : 'evidencias.zip'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i)

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Evidências PCD</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Gestão e arquivo de evidências para conformidade PCD
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleDownload}
            disabled={downloading || evidencias.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 bg-white text-gray-700 hover:border-[#15AFA4] hover:text-[#15AFA4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Baixar evidências como ZIP"
          >
            {downloading ? (
              <div className="w-4 h-4 border-2 border-[#15AFA4] border-t-transparent rounded-full animate-spin" />
            ) : (
              <Download size={16} />
            )}
            {downloading ? 'Gerando...' : 'Baixar ZIP'}
          </button>
          {canEdit && (
            <button
              onClick={openModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium shadow hover:opacity-90 transition-opacity"
              style={{ background: ACCENT }}
            >
              <Plus size={16} />
              Nova Evidência
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
        {CATEGORIAS.map(c => (
          <button
            key={c.key}
            onClick={() => setActiveTab(c.key)}
            className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === c.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <span className="hidden sm:inline">{c.label}</span>
            <span className="sm:hidden">{c.label.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Tab description */}
      <p className="text-sm text-gray-500 -mt-2">{cat.desc}</p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center p-4 bg-white rounded-xl border border-gray-200">
        <Filter size={16} className="text-gray-400 shrink-0" />

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Ano:</label>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#15AFA4]"
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap">Mês:</label>
          <select
            value={month}
            onChange={e => setMonth(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#15AFA4]"
          >
            <option value="">Todos</option>
            {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>

        {cat.hasUnit && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-500 whitespace-nowrap">Unidade:</label>
            <select
              value={unitId}
              onChange={e => setUnitId(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:border-[#15AFA4]"
            >
              <option value="">Todas</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        )}

        {(month || unitId) && (
          <button
            onClick={() => { setMonth(''); setUnitId('') }}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <X size={12} /> Limpar filtros
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <div className="w-8 h-8 border-2 border-[#15AFA4] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : evidencias.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-3">
          <FileText size={40} className="opacity-30" />
          <p className="text-sm">Nenhuma evidência encontrada para os filtros selecionados.</p>
          {canEdit && (
            <button
              onClick={openModal}
              className="text-sm font-medium flex items-center gap-1.5"
              style={{ color: ACCENT }}
            >
              <Plus size={14} /> Adicionar primeira evidência
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {evidencias.map(ev => (
            <EvidenciaCard key={ev.id} ev={ev} onDelete={() => deleteEvidencia(ev.id)} onEdit={() => openEditModal(ev)} canEdit={canEdit} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">
                  {editingId ? 'Editar Evidência' : 'Nova Evidência'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">{cat.label}</p>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
              {/* Year + Month */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Ano *</label>
                  <select
                    value={fYear}
                    onChange={e => setFYear(parseInt(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#15AFA4]"
                  >
                    {years.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Mês *</label>
                  <select
                    value={fMonth}
                    onChange={e => setFMonth(parseInt(e.target.value))}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#15AFA4]"
                  >
                    {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                  </select>
                </div>
              </div>

              {/* Unit (for categories that need it) */}
              {cat.hasUnit && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Unidade *</label>
                  <select
                    value={fUnitId}
                    onChange={e => setFUnitId(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#15AFA4]"
                  >
                    <option value="">Selecione a unidade...</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              )}

              {/* Nome PCD for CONTRATACAO */}
              {activeTab === 'CONTRATACAO' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Nome do Colaborador PCD *</label>
                  <input
                    type="text"
                    value={fNomePCD}
                    onChange={e => setFNomePCD(e.target.value)}
                    placeholder="Nome completo"
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#15AFA4]"
                  />
                </div>
              )}

              {/* Description */}
              {activeTab !== 'CONTRATACAO' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Descrição</label>
                  <textarea
                    value={fDescricao}
                    onChange={e => setFDescricao(e.target.value)}
                    placeholder="Contexto ou observação sobre a evidência..."
                    rows={2}
                    className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-[#15AFA4] resize-none"
                  />
                </div>
              )}

              {/* Arquivos existentes no modo edição */}
              {editingId && fExistingArquivos.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Arquivos atuais</label>
                  <div className="flex flex-wrap gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                    {fExistingArquivos.map(arq => (
                      <FileThumbnail
                        key={arq.id}
                        arq={arq}
                        onDelete={() => removeExistingArquivo(arq.id)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Adicionar novos arquivos */}
              {editingId && editingCategoria === 'CONTRATACAO' ? (
                <>
                  <DropZone label="Adicionar Ficha de Registro" files={fFicha} onChange={setFFicha} multiple={false} tipoDoc="ficha_registro" />
                  <DropZone label="Adicionar Laudo Médico" files={fLaudo} onChange={setFLaudo} multiple={false} tipoDoc="laudo_medico" />
                </>
              ) : editingId ? (
                <DropZone label="Adicionar novos arquivos" files={fFiles} onChange={setFFiles} multiple />
              ) : activeTab === 'CONTRATACAO' ? (
                <>
                  <DropZone label="Ficha de Registro" files={fFicha} onChange={setFFicha} multiple={false} tipoDoc="ficha_registro" />
                  <DropZone label="Laudo Médico" files={fLaudo} onChange={setFLaudo} multiple={false} tipoDoc="laudo_medico" />
                </>
              ) : (
                <DropZone label="Arquivos de Evidência" files={fFiles} onChange={setFFiles} multiple />
              )}

              {error && (
                <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-medium shadow hover:opacity-90 transition-opacity disabled:opacity-60"
                  style={{ background: ACCENT }}
                >
                  {submitting ? 'Salvando...' : editingId ? 'Salvar Alterações' : 'Salvar Evidência'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
