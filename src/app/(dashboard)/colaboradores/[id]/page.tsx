'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  ArrowLeft, RefreshCw, ExternalLink, Briefcase,
  User, Accessibility, Clock, Mail, Phone, Contact, MapPin,
} from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { EmployeeDocumentHistory } from '@/components/colaboradores/EmployeeDocumentHistory'
import { DossieTab } from '@/components/colaboradores/dossie/DossieTab'
import { BadgeProfileCard } from '@/components/badges/BadgeManager'

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

function Field({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <div className={cn('text-sm text-gray-900 mt-1 break-words', mono && 'font-mono')}>{value || <span className="text-gray-400">Não informado</span>}</div>
    </div>
  )
}

function SectionCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-3 mb-5">
        <div className="w-9 h-9 rounded-xl bg-[#15AFA4]/10 text-[#0d8c83] flex items-center justify-center flex-shrink-0">{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
        </div>
      </div>
      {children}
    </Card>
  )
}

function ProfilePhoto({ id, name, imageUrl, canUseDossiePhoto }: { id: string; name: string; imageUrl?: string | null; canUseDossiePhoto: boolean }) {
  const sources = [canUseDossiePhoto ? `/api/colaboradores/${id}/dossie/foto` : null, imageUrl].filter((value): value is string => !!value)
  const [sourceIndex, setSourceIndex] = useState(0)
  const src = sources[sourceIndex]
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).slice(0, 2).join('').toUpperCase()
  if (!src) return <div className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl bg-gradient-to-br from-[#15AFA4] to-[#0d8c83] flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">{initials}</div>
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={name} onError={() => setSourceIndex((index) => index + 1)} className="w-20 h-24 sm:w-24 sm:h-28 rounded-2xl object-cover border border-gray-100 flex-shrink-0" />
}

function formatCpf(value?: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  return digits.length === 11 ? digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4') : value
}

function formatPhone(value?: string | null) {
  if (!value) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length === 11) return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  if (digits.length === 10) return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  return value
}

function formatMonthlyHours(value?: string | null) {
  if (!value) return null
  return /hora/i.test(value) ? value : `${value} horas`
}

const GENDER_LABEL: Record<string, string> = { Female: 'Feminino', Male: 'Masculino', Other: 'Outro', Feminino: 'Feminino', Masculino: 'Masculino' }

export default function ColaboradorDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const search = useSearchParams()
  const { data: session } = useSession()
  // Dossiê contém dados sensíveis: aba exclusiva do RH (o backend também valida o papel).
  const canDossie = ['ADMIN', 'ANALYST'].includes(session?.user?.actualRole ?? session?.user?.role ?? '')
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

  const statusLabel = STATUS_LABEL[data.status] || data.status
  const phone = formatPhone(data.cellNumber)
  const manager = data.reportsToName || data.reportsTo

  return (
    <>
      <Header
        title={data.employeeName}
        subtitle={`${STATUS_LABEL[data.status] || data.status} · ${data.designation || 'Sem cargo'}`}
      />

      <div className="p-4 sm:p-6 space-y-5 min-w-0 max-w-7xl">
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
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="p-5 sm:p-6 flex flex-wrap items-center gap-4 sm:gap-5">
              <ProfilePhoto id={data.id} name={data.employeeName} imageUrl={data.imageUrl} canUseDossiePhoto={canDossie} />
              <div className="min-w-0 flex-1 basis-64">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-xl font-semibold text-gray-900 break-words">{data.employeeName}</h1>
                  <span className={cn(
                    'text-xs font-semibold px-2.5 py-1 rounded-full',
                    data.status === 'Active' ? 'bg-green-50 text-green-700 ring-1 ring-green-200' :
                    data.status === 'Left' ? 'bg-gray-100 text-gray-600 ring-1 ring-gray-200' :
                    'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
                  )}>{statusLabel}</span>
                </div>
                <p className="text-sm font-medium text-gray-700 mt-1.5">{data.designation || 'Cargo não informado'}</p>
                <p className="text-xs text-gray-400 mt-1">Matrícula {data.matricula || '—'} · Código ERPNext {data.erpnextId}</p>
                {data.pcd && <span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg ring-1 ring-blue-100"><Accessibility className="w-3.5 h-3.5" />Pessoa com deficiência{data.tipoDeficiencia ? ` · ${data.tipoDeficiencia}` : ''}</span>}
              </div>
              {data.syncedAt && <div className="text-xs text-gray-400 flex items-center gap-1.5 sm:self-start"><Clock className="w-3.5 h-3.5" />Atualizado em {new Date(data.syncedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })}</div>}
            </div>
            <div className="border-t border-gray-100 px-5 sm:px-6 py-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 bg-gray-50/60">
              <Field label="Unidade" value={data.unit?.name} />
              <Field label="Departamento" value={data.department} />
              <Field label="Admissão" value={data.dateOfJoining ? formatDate(data.dateOfJoining) : null} />
              <Field label="Tipo de vínculo" value={data.employmentType} />
            </div>
          </Card>

          <div className="grid xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.8fr)] gap-5 items-start">
            <div className="space-y-5 min-w-0">
              <SectionCard icon={<Briefcase className="w-4 h-4" />} title="Informações profissionais" description="Dados do vínculo e da alocação atual no ERPNext.">
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-5">
                  <Field label="Cargo" value={data.designation} />
                  <Field label="Empresa" value={data.company} />
                  <Field label="Seção" value={data.secao} />
                  <Field label="Carga horária mensal" value={formatMonthlyHours(data.cargaHoraria)} />
                  <Field label="Matrícula" value={data.matricula} />
                  <Field label="Gestor imediato" value={manager} />
                  {data.relievingDate && <Field label="Desligamento" value={formatDate(data.relievingDate)} />}
                </div>
              </SectionCard>

              <SectionCard icon={<User className="w-4 h-4" />} title="Contato" description="Canais pessoais e corporativos do colaborador.">
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                  <Field label="Celular" value={phone ? <a href={`tel:${(data.cellNumber || '').replace(/\D/g, '')}`} className="inline-flex items-center gap-2 text-[#0d8c83] hover:underline"><Phone className="w-3.5 h-3.5" />{phone}</a> : null} />
                  <Field label="E-mail pessoal" value={data.personalEmail ? <a href={`mailto:${data.personalEmail}`} className="inline-flex max-w-full items-start gap-2 text-[#0d8c83] hover:underline break-all"><Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{data.personalEmail}</a> : null} />
                  <Field label="E-mail corporativo" value={data.companyEmail ? <a href={`mailto:${data.companyEmail}`} className="inline-flex max-w-full items-start gap-2 text-[#0d8c83] hover:underline break-all"><Mail className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />{data.companyEmail}</a> : null} />
                </div>
              </SectionCard>
            </div>

            <div className="space-y-5 min-w-0">
              <SectionCard icon={<Contact className="w-4 h-4" />} title="Dados pessoais" description="Identificação e informações demográficas.">
                <div className="grid grid-cols-2 gap-x-5 gap-y-5">
                  <Field label="Nascimento" value={data.dateOfBirth ? formatDate(data.dateOfBirth) : null} />
                  <Field label="Gênero" value={data.gender ? (GENDER_LABEL[data.gender] || data.gender) : null} />
                  <Field label="CPF" value={formatCpf(data.cpf)} mono />
                  <Field label="RG" value={data.rg} mono />
                  <Field label="Etnia" value={data.etnia} />
                  <Field label="Naturalidade" value={data.naturalidade ? <span className="inline-flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 text-gray-400 flex-shrink-0" />{data.naturalidade}</span> : null} />
                </div>
              </SectionCard>

              {canDossie && <BadgeProfileCard employeeId={data.id} employeeName={data.employeeName} />}
            </div>
          </div>

          {canDossie && <EmployeeDocumentHistory employeeId={data.id} />}
        </div>
        )}
      </div>
    </>
  )
}
