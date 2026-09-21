'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft, RefreshCw, ExternalLink, Briefcase,
  Calendar, User, Accessibility, Clock,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { DossieTab } from '@/components/colaboradores/dossie/DossieTab'

interface ColaboradorDetail {
  id: string
  erpnextId: string
  employeeName: string
  status: string
  company?: string | null
  department?: string | null
  designation?: string | null
  cellNumber?: string | null
  personalEmail?: string | null
  companyEmail?: string | null
  dateOfJoining?: string | null
  dateOfBirth?: string | null
  gender?: string | null
  reportsTo?: string | null
  reportsToName?: string | null
  imageUrl?: string | null
  employmentType?: string | null
  relievingDate?: string | null
  matricula?: string | null
  cpf?: string | null
  rg?: string | null
  secao?: string | null
  pcd?: boolean
  tipoDeficiencia?: string | null
  etnia?: string | null
  cargaHoraria?: string | null
  naturalidade?: string | null
  syncedAt?: string
  erpnextUrl?: string | null
  unit?: { id: string; name: string; color: string } | null
}

const STATUS_LABEL: Record<string, string> = {
  Active: 'Ativo',
  Left: 'Desligado',
  Suspended: 'Suspenso',
  Inactive: 'Inativo',
}

function Field({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null
  return (
    <div>
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={cn('text-sm text-gray-900 mt-0.5', mono && 'font-mono')}>{value}</p>
    </div>
  )
}

export default function ColaboradorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const search = useSearchParams()
  const { data: session } = useSession()
  // Dossiê contém dados sensíveis: aba exclusiva do RH (o backend também valida o papel).
  const canDossie = ['ADMIN', 'ANALYST'].includes(session?.user?.role ?? '')
  const [aba, setAba] = useState<'perfil' | 'dossie'>(search.get('aba') === 'dossie' ? 'dossie' : 'perfil')
  const changeAba = (next: 'perfil' | 'dossie') => {
    setAba(next)
    window.history.replaceState(null, '', next === 'dossie' ? `?aba=dossie` : window.location.pathname)
  }

  const [data, setData] = useState<ColaboradorDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    const res = await fetch(`/api/colaboradores/${id}${refresh ? '?refresh=1' : ''}`)
    if (res.ok) setData(await res.json())
    else setData(null)
    setLoading(false)
    setRefreshing(false)
  }, [id])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <>
        <Header title="Colaborador" />
        <div className="p-12 text-center text-gray-400">Carregando…</div>
      </>
    )
  }

  if (!data) {
    return (
      <>
        <Header title="Não encontrado" />
        <div className="p-6">
          <Button variant="outline" onClick={() => router.push('/colaboradores')} icon={<ArrowLeft className="w-4 h-4" />}>
            Voltar
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header
        title={data.employeeName}
        subtitle={`${STATUS_LABEL[data.status] || data.status} · ${data.designation || 'Sem cargo'}`}
      />

      <div className={cn('p-6 space-y-5', aba === 'dossie' && canDossie ? 'max-w-6xl' : 'max-w-5xl')}>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push('/colaboradores')} icon={<ArrowLeft className="w-4 h-4" />}>
            Lista
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => load(true)}
            icon={<RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />}
          >
            Atualizar do ERPNext
          </Button>
          {data.erpnextUrl && (
            <a
              href={data.erpnextUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex"
            >
              <Button variant="outline" size="sm" icon={<ExternalLink className="w-4 h-4" />}>
                Abrir no ERPNext
              </Button>
            </a>
          )}
        </div>

        {canDossie && (
          <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
            {([['perfil', 'Perfil'], ['dossie', 'Dossiê']] as const).map(([key, label]) => (
              <button key={key} onClick={() => changeAba(key)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${aba === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        )}

        {aba === 'dossie' && canDossie ? <DossieTab colaboradorId={data.id} /> : (
        <div className="grid md:grid-cols-[200px_1fr] gap-5">
          {/* Foto / status */}
          <Card className="p-4 flex flex-col items-center text-center gap-3">
            {data.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageUrl}
                alt={data.employeeName}
                className="w-36 h-36 rounded-2xl object-cover border border-gray-100"
              />
            ) : (
              <div className="w-36 h-36 rounded-2xl bg-gradient-to-br from-[#15AFA4] to-[#0d8c83] flex items-center justify-center text-white text-3xl font-bold">
                {data.employeeName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
              </div>
            )}
            <span className={cn(
              'text-xs font-semibold px-2.5 py-1 rounded-full',
              data.status === 'Active' ? 'bg-green-50 text-green-700' :
              data.status === 'Left' ? 'bg-gray-100 text-gray-600' :
              'bg-amber-50 text-amber-700',
            )}>
              {STATUS_LABEL[data.status] || data.status}
            </span>
            <p className="text-[11px] text-gray-400 font-mono break-all">{data.erpnextId}</p>
            {data.pcd && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-1 rounded-lg">
                <Accessibility className="w-3.5 h-3.5" /> PCD
                {data.tipoDeficiencia ? ` · ${data.tipoDeficiencia}` : ''}
              </span>
            )}
          </Card>

          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Briefcase className="w-3.5 h-3.5" /> Vínculo
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Cargo" value={data.designation} />
                <Field label="Tipo de vínculo" value={data.employmentType} />
                <Field label="Unidade (People)" value={data.unit?.name} />
                <Field label="Company (ERPNext)" value={data.company} />
                <Field label="Departamento" value={data.department} />
                <Field label="Seção" value={data.secao} />
                <Field label="Carga horária mensal" value={data.cargaHoraria} />
                <Field label="Matrícula" value={data.matricula} />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Datas
              </p>
              <div className="grid sm:grid-cols-3 gap-4">
                <Field label="Admissão" value={data.dateOfJoining ? formatDate(data.dateOfJoining) : null} />
                <Field label="Nascimento" value={data.dateOfBirth ? formatDate(data.dateOfBirth) : null} />
                <Field label="Desligamento" value={data.relievingDate ? formatDate(data.relievingDate) : null} />
              </div>
            </Card>

            <Card className="p-5 space-y-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Contato e documentos
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Celular" value={data.cellNumber} />
                <Field label="E-mail pessoal" value={data.personalEmail} />
                <Field label="E-mail corporativo" value={data.companyEmail} />
                <Field label="Gênero" value={data.gender} />
                <Field label="CPF" value={data.cpf} mono />
                <Field label="RG" value={data.rg} mono />
                <Field label="Etnia" value={data.etnia} />
                <Field label="Naturalidade" value={data.naturalidade} />
                <Field label="Gestor (ID ERPNext)" value={data.reportsTo} mono />
              </div>
            </Card>

            {data.syncedAt && (
              <p className="text-[11px] text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Sincronizado em{' '}
                {new Date(data.syncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
              </p>
            )}
          </div>
        </div>
        )}
      </div>
    </>
  )
}
