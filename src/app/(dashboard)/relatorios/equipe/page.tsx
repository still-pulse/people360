'use client'

import { useState, useCallback } from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useSettings } from '@/components/providers/SettingsProvider'
import {
  CheckCircle2, Headphones, Users, ChevronDown, ChevronRight,
  Loader2, Calendar, FileSpreadsheet, FileText, AlertTriangle,
} from 'lucide-react'
import { formatDate } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'

const PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Baixa', MEDIUM: 'Média', HIGH: 'Alta', URGENT: 'Urgente',
}
const PRIORITY_COLOR: Record<string, string> = {
  LOW: '#94A3B8', MEDIUM: '#3B82F6', HIGH: '#F59E0B', URGENT: '#EF4444',
}
const CHAMADO_STATUS_LABEL: Record<string, string> = {
  RESOLVIDO: 'Resolvido', FECHADO: 'Fechado',
}
const CHAMADO_STATUS_COLOR: Record<string, string> = {
  RESOLVIDO: '#10B981', FECHADO: '#6B7280',
}

function getWeekRange(offset = 0) {
  const now = new Date()
  const day = now.getDay() === 0 ? 7 : now.getDay()
  const mon = new Date(now); mon.setDate(now.getDate() - day + 1 + offset * 7)
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  return { start: mon.toISOString().slice(0, 10), end: sun.toISOString().slice(0, 10) }
}

function getMonthRange(offset = 0) {
  const now   = new Date()
  const year  = now.getMonth() + offset < 0 ? now.getFullYear() - 1 : now.getFullYear()
  const month = ((now.getMonth() + offset) % 12 + 12) % 12
  const first = new Date(year, month, 1)
  const last  = new Date(year, month + 1, 0)
  return { start: first.toISOString().slice(0, 10), end: last.toISOString().slice(0, 10) }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR')
}

const SHORTCUTS = [
  { label: 'Esta semana',    fn: () => getWeekRange(0)   },
  { label: 'Semana passada', fn: () => getWeekRange(-1)  },
  { label: 'Este mês',       fn: () => getMonthRange(0)  },
  { label: 'Mês passado',    fn: () => getMonthRange(-1) },
]

interface TaskEntry {
  id: string; title: string; priority: string
  dueDate: string | null; completedAt: string
  unit: { name: string; color: string } | null
}
interface UserTasks { user: { id: string; name: string }; tasks: TaskEntry[] }
interface ChamadoEntry {
  id: string; titulo: string; status: string; prioridade: string; categoria: string
  updatedAt: string; resolvidoAt: string | null
  autor: { id: string; name: string }
  atribuido: { id: string; name: string } | null
  unit: { name: string; color: string } | null
}
interface OverdueUnit { name: string; color: string; count: number }

export default function DesempenhoEquipePage() {
  const { settings } = useSettings()
  const today = new Date().toISOString().slice(0, 10)

  const [startDate, setStartDate]     = useState(getWeekRange(0).start)
  const [endDate, setEndDate]         = useState(getWeekRange(0).end)
  const [activeShortcut, setShortcut] = useState('Esta semana')
  const [loading, setLoading]         = useState(false)
  const [exporting, setExporting]     = useState<'excel' | 'pdf' | null>(null)
  const [data, setData]               = useState<{ tasks: UserTasks[]; chamados: ChamadoEntry[]; overdueByUnit: OverdueUnit[]; activeAnalysts: number } | null>(null)
  const [expandedUsers, setExpanded]  = useState<Set<string>>(new Set())

  function applyShortcut(s: typeof SHORTCUTS[number]) {
    const range = s.fn()
    setStartDate(range.start); setEndDate(range.end); setShortcut(s.label)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/reports/team?startDate=${startDate}&endDate=${endDate}`)
    if (res.ok) setData(await res.json())
    setLoading(false)
    setExpanded(new Set())
  }, [startDate, endDate])

  function toggleUser(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const totalTasks    = data?.tasks.reduce((s, u) => s + u.tasks.length, 0) ?? 0
  const totalChamados = data?.chamados.length ?? 0
  const periodLabel   = `${fmtDate(startDate)} a ${fmtDate(endDate)}`
  const companyLabel  = settings?.companyName || 'BHCL'

  // ── Excel ────────────────────────────────────────────────────────────────
  async function exportExcel() {
    if (!data) return
    setExporting('excel')
    const XLSX = await import('@/lib/xlsxSafe')
    const wb   = XLSX.utils.book_new()

    // Planilha 1 — Tarefas
    const taskRows: string[][] = [
      [companyLabel + ' — Desempenho da Equipe'],
      [`Período: ${periodLabel}`],
      [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      ['Analista', 'Tarefa', 'Prioridade', 'Unidade', 'Prazo', 'Concluída em'],
    ]
    for (const u of data.tasks) {
      for (const t of u.tasks) {
        taskRows.push([
          u.user.name,
          t.title,
          PRIORITY_LABEL[t.priority] ?? t.priority,
          t.unit?.name ?? '—',
          t.dueDate ? fmtDate(t.dueDate) : '—',
          fmtDate(t.completedAt),
        ])
      }
    }
    const ws1 = XLSX.utils.aoa_to_sheet(taskRows)
    ws1['!cols'] = [28, 42, 12, 22, 14, 16].map((wch) => ({ wch }))
    ws1['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, 'Tarefas Concluídas')

    // Planilha 2 — Chamados
    const chamadoRows: string[][] = [
      [companyLabel + ' — Chamados Respondidos'],
      [`Período: ${periodLabel}`],
      [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      ['Chamado', 'Solicitante', 'Unidade', 'Categoria', 'Prioridade', 'Status', 'Resolvido em'],
      ...data.chamados.map((c) => [
        c.titulo,
        c.autor.name,
        c.unit?.name ?? '—',
        c.categoria,
        c.prioridade,
        CHAMADO_STATUS_LABEL[c.status] ?? c.status,
        fmtDate(c.resolvidoAt ?? c.updatedAt),
      ]),
    ]
    const ws2 = XLSX.utils.aoa_to_sheet(chamadoRows)
    ws2['!cols'] = [40, 24, 22, 16, 12, 12, 16].map((wch) => ({ wch }))
    ws2['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
    ]
    XLSX.utils.book_append_sheet(wb, ws2, 'Chamados Respondidos')

    XLSX.writeFile(wb, `desempenho_equipe_${startDate}_${endDate}.xlsx`)
    setExporting(null)
  }

  // ── PDF Executivo ─────────────────────────────────────────────────────────
  async function exportPDF() {
    if (!data) return
    setExporting('pdf')
    const { default: jsPDF }    = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    let logoBase64: string | null = null
    try {
      const lr = await fetch('/api/settings/logo-base64')
      if (lr.ok) { const ld = await lr.json(); logoBase64 = ld.base64 ?? null }
    } catch {}

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W   = doc.internal.pageSize.getWidth()

    function addHeader(title: string) {
      doc.setFillColor(21, 175, 164)
      doc.rect(0, 0, W, 18, 'F')
      if (logoBase64) {
        try { doc.addImage(logoBase64, 8, 3, 24, 10, undefined, 'FAST') } catch {}
        doc.setFontSize(13); doc.setTextColor(255, 255, 255)
        doc.text(title, 36, 11)
      } else {
        doc.setFontSize(13); doc.setTextColor(255, 255, 255)
        doc.text(title, 10, 11)
      }
      doc.setFontSize(9); doc.setTextColor(220, 255, 252)
      doc.text(`Período: ${periodLabel}  ·  Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, W - 10, 11, { align: 'right' })
    }

    // ── Página 1: Capa / KPIs ──────────────────────────────────────────────
    addHeader(`${companyLabel} — Desempenho da Equipe`)

    const kpis = [
      { label: 'Tarefas Concluídas', value: String(totalTasks),    color: [16, 185, 129] as [number, number, number] },
      { label: 'Chamados Resolvidos', value: String(totalChamados), color: [99, 102, 241] as [number, number, number] },
      { label: 'Analistas Ativas',    value: String(data.activeAnalysts), color: [21, 175, 164] as [number, number, number] },
    ]
    kpis.forEach(({ label, value, color }, i) => {
      const x = 10 + i * 96
      doc.setFillColor(color[0], color[1], color[2])
      doc.roundedRect(x, 24, 88, 22, 3, 3, 'F')
      doc.setFontSize(22); doc.setTextColor(255, 255, 255)
      doc.text(value, x + 44, 34, { align: 'center' })
      doc.setFontSize(9)
      doc.text(label, x + 44, 41, { align: 'center' })
    })

    // Resumo por analista (tabela compacta na capa)
    const summaryHead = [['Analista', 'Tarefas Concluídas']]
    const summaryBody = data.tasks.map((u) => [u.user.name, String(u.tasks.length)])
    autoTable(doc, {
      startY: 52,
      head: summaryHead,
      body: summaryBody.length ? summaryBody : [['—', '0']],
      styles: { fontSize: 10, cellPadding: 3 },
      headStyles: { fillColor: [21, 175, 164], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 251] },
      columnStyles: { 0: { cellWidth: 80 }, 1: { cellWidth: 40, halign: 'center' } },
      tableWidth: 130,
      margin: { left: 10 },
    })

    // ── Página 2: Tarefas detalhadas ───────────────────────────────────────
    doc.addPage()
    addHeader(`${companyLabel} — Tarefas Concluídas por Analista`)

    const taskHead = [['Analista', 'Tarefa', 'Prioridade', 'Unidade', 'Prazo', 'Concluída em']]
    const taskBody: string[][] = []
    for (const u of data.tasks) {
      for (const t of u.tasks) {
        taskBody.push([
          u.user.name,
          t.title,
          PRIORITY_LABEL[t.priority] ?? t.priority,
          t.unit?.name ?? '—',
          t.dueDate ? fmtDate(t.dueDate) : '—',
          fmtDate(t.completedAt),
        ])
      }
    }
    autoTable(doc, {
      startY: 24,
      head: taskHead,
      body: taskBody.length ? taskBody : [['—', 'Nenhuma tarefa concluída no período', '', '', '', '']],
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [21, 175, 164], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 251] },
      columnStyles: {
        0: { cellWidth: 38 },
        1: { cellWidth: 80 },
        2: { cellWidth: 22 },
        3: { cellWidth: 42 },
        4: { cellWidth: 22 },
        5: { cellWidth: 26 },
      },
    })

    // ── Página 3: Chamados ─────────────────────────────────────────────────
    doc.addPage()
    addHeader(`${companyLabel} — Chamados Respondidos`)

    const chamHead = [['Chamado', 'Solicitante', 'Unidade', 'Categoria', 'Prioridade', 'Status', 'Resolvido em']]
    const chamBody = data.chamados.map((c) => [
      c.titulo,
      c.autor.name,
      c.unit?.name ?? '—',
      c.categoria,
      c.prioridade,
      CHAMADO_STATUS_LABEL[c.status] ?? c.status,
      fmtDate(c.resolvidoAt ?? c.updatedAt),
    ])
    autoTable(doc, {
      startY: 24,
      head: chamHead,
      body: chamBody.length ? chamBody : [['—', 'Nenhum chamado resolvido no período', '', '', '', '', '']],
      styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak' },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 251] },
      columnStyles: {
        0: { cellWidth: 72 },
        1: { cellWidth: 34 },
        2: { cellWidth: 34 },
        3: { cellWidth: 24 },
        4: { cellWidth: 20 },
        5: { cellWidth: 22 },
        6: { cellWidth: 24 },
      },
    })

    // Rodapé em todas as páginas
    const totalPages = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFontSize(8); doc.setTextColor(160, 160, 160)
      doc.text(`${companyLabel} · Confidencial · Página ${i} de ${totalPages}`, W / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' })
    }

    doc.save(`desempenho_equipe_${startDate}_${endDate}.pdf`)
    setExporting(null)
  }

  return (
    <>
      <Header title="Desempenho da Equipe" subtitle="Tarefas concluídas e chamados respondidos por período" />
      <div className="p-6 space-y-6">

        {/* Filtro de período */}
        <Card>
          <CardContent className="pt-5">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex gap-2 flex-wrap">
                {SHORTCUTS.map((s) => (
                  <button key={s.label} onClick={() => applyShortcut(s)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      activeShortcut === s.label
                        ? 'bg-[#15AFA4] text-white border-[#15AFA4]'
                        : 'bg-white text-gray-600 border-gray-200 hover:border-[#15AFA4] hover:text-[#15AFA4]'
                    }`}>
                    {s.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2 ml-auto flex-wrap">
                <Calendar className="w-4 h-4 text-gray-400" />
                <input type="date" value={startDate} max={endDate}
                  onChange={(e) => { setStartDate(e.target.value); setShortcut('') }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#15AFA4]" />
                <span className="text-gray-400 text-sm">até</span>
                <input type="date" value={endDate} min={startDate} max={today}
                  onChange={(e) => { setEndDate(e.target.value); setShortcut('') }}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#15AFA4]" />
                <Button onClick={load} isLoading={loading}
                  icon={loading ? undefined : <CheckCircle2 className="w-4 h-4" />}>
                  Gerar Relatório
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {data && (
          <>
            {/* KPIs + botões de exportação */}
            <div className="flex flex-wrap items-stretch gap-4">
              {[
                { label: 'Tarefas Concluídas', value: totalTasks,    icon: CheckCircle2, color: '#10B981' },
                { label: 'Chamados Resolvidos', value: totalChamados, icon: Headphones,   color: '#6366F1' },
                { label: 'Analistas Ativas',    value: data.activeAnalysts, icon: Users, color: '#15AFA4' },
              ].map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex items-center gap-4 flex-1 min-w-[160px]">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
                    <Icon className="w-5 h-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">{value}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                </div>
              ))}

              {/* Botões de exportação */}
              <div className="flex flex-col gap-2 justify-center">
                <Button variant="outline" size="sm"
                  icon={<FileSpreadsheet className="w-4 h-4 text-green-600" />}
                  isLoading={exporting === 'excel'}
                  onClick={exportExcel}
                  className="whitespace-nowrap">
                  Exportar Excel
                </Button>
                <Button variant="outline" size="sm"
                  icon={<FileText className="w-4 h-4 text-red-500" />}
                  isLoading={exporting === 'pdf'}
                  onClick={exportPDF}
                  className="whitespace-nowrap">
                  Relatório Executivo
                </Button>
              </div>
            </div>

            {/* Gráficos */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

              {/* Gráfico 1 — Tarefas concluídas por analista */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Tarefas Concluídas
                </p>
                {data.tasks.filter(u => u.user.id !== '__sem_responsavel__').length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Sem dados no período</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      layout="vertical"
                      data={data.tasks
                        .filter(u => u.user.id !== '__sem_responsavel__')
                        .map(u => ({ name: u.user.name.split(' ')[0], value: u.tasks.length, full: u.user.name }))}
                      margin={{ left: 8, right: 24, top: 4, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                      <Tooltip
                        formatter={(v: any, _: any, p: any) => [v, p.payload.full]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#10B981" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Gráfico 2 — Chamados respondidos por analista */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                  <Headphones className="w-4 h-4 text-[#6366F1]" /> Chamados Respondidos
                </p>
                {(() => {
                  const byUser = new Map<string, number>()
                  for (const c of data.chamados) {
                    const name = c.atribuido?.name ?? 'Sem responsável'
                    byUser.set(name, (byUser.get(name) ?? 0) + 1)
                  }
                  const chartData = Array.from(byUser.entries())
                    .map(([name, value]) => ({ name: name.split(' ')[0], value, full: name }))
                    .sort((a, b) => b.value - a.value)
                  return chartData.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-8">Sem dados no período</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart layout="vertical" data={chartData}
                        margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={72} />
                        <Tooltip
                          formatter={(v: any, _: any, p: any) => [v, p.payload.full]}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                        />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]} fill="#6366F1" />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                })()}
              </div>

              {/* Gráfico 3 — Tarefas atrasadas por unidade (estado atual) */}
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <p className="text-sm font-semibold text-gray-700 mb-1 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-[#EF4444]" /> Tarefas Atrasadas por Unidade
                </p>
                <p className="text-xs text-gray-400 mb-4">Estado atual — independente do período</p>
                {data.overdueByUnit.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-8">Nenhuma tarefa atrasada</p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart layout="vertical" data={data.overdueByUnit.map(u => ({ name: u.name, value: u.count, color: u.color }))}
                      margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip
                        formatter={(v: any) => [v, 'Tarefas atrasadas']}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb' }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {data.overdueByUnit.map((u, i) => <Cell key={i} fill={u.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

            </div>

            {/* Tarefas por analista */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" /> Tarefas Concluídas por Analista
              </h2>
              {data.tasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                  Nenhuma tarefa concluída no período
                </div>
              ) : (
                <div className="space-y-3">
                  {data.tasks.map((u) => {
                    const open = expandedUsers.has(u.user.id)
                    return (
                      <div key={u.user.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <button onClick={() => toggleUser(u.user.id)}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                          <div className="w-9 h-9 rounded-full bg-[#15AFA4]/10 flex items-center justify-center text-[#15AFA4] font-bold text-sm flex-shrink-0">
                            {u.user.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900">{u.user.name}</p>
                            <p className="text-xs text-gray-400">{u.tasks.length} tarefa{u.tasks.length !== 1 ? 's' : ''} concluída{u.tasks.length !== 1 ? 's' : ''}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold text-[#10B981]">{u.tasks.length}</span>
                            {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                          </div>
                        </button>
                        {open && (
                          <div className="border-t border-gray-100 overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50">
                                <tr>
                                  {['Tarefa', 'Prioridade', 'Unidade', 'Prazo', 'Concluída em'].map((h) => (
                                    <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {u.tasks.map((t) => {
                                  const overdue = t.dueDate && new Date(t.dueDate) < new Date(t.completedAt)
                                  return (
                                    <tr key={t.id} className="hover:bg-gray-50/50">
                                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">{t.title}</td>
                                      <td className="px-4 py-3">
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                          style={{ background: PRIORITY_COLOR[t.priority] + '18', color: PRIORITY_COLOR[t.priority] }}>
                                          {PRIORITY_LABEL[t.priority] ?? t.priority}
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        {t.unit ? (
                                          <span className="flex items-center gap-1.5 text-xs">
                                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: t.unit.color }} />
                                            {t.unit.name}
                                          </span>
                                        ) : <span className="text-gray-300">—</span>}
                                      </td>
                                      <td className="px-4 py-3 text-xs">
                                        {t.dueDate ? (
                                          <span className={overdue ? 'text-red-500 font-semibold' : 'text-gray-500'}>
                                            {formatDate(t.dueDate)}{overdue ? ' ⚠' : ''}
                                          </span>
                                        ) : <span className="text-gray-300">—</span>}
                                      </td>
                                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(t.completedAt)}</td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Chamados resolvidos */}
            <div>
              <h2 className="text-base font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <Headphones className="w-4 h-4 text-[#6366F1]" /> Chamados Respondidos no Período
              </h2>
              {data.chamados.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center text-gray-400 text-sm">
                  Nenhum chamado resolvido no período
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-100">
                        <tr>
                          {['Chamado', 'Solicitante', 'Unidade', 'Categoria', 'Prioridade', 'Status', 'Resolvido em'].map((h) => (
                            <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {data.chamados.map((c) => (
                          <tr key={c.id} className="hover:bg-gray-50/50">
                            <td className="px-4 py-3 font-medium text-gray-900 max-w-xs">{c.titulo}</td>
                            <td className="px-4 py-3 text-gray-600 text-xs">{c.autor.name}</td>
                            <td className="px-4 py-3">
                              {c.unit ? (
                                <span className="flex items-center gap-1.5 text-xs">
                                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.unit.color }} />
                                  {c.unit.name}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-500 text-xs">{c.categoria}</td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: PRIORITY_COLOR[c.prioridade] + '18', color: PRIORITY_COLOR[c.prioridade] }}>
                                {c.prioridade}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
                                style={{ background: CHAMADO_STATUS_COLOR[c.status] + '18', color: CHAMADO_STATUS_COLOR[c.status] }}>
                                {CHAMADO_STATUS_LABEL[c.status] ?? c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-xs text-gray-500">
                              {formatDate(c.resolvidoAt ?? c.updatedAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {!data && !loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <CheckCircle2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Selecione o período e clique em <strong>Gerar Relatório</strong></p>
          </div>
        )}
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center">
            <Loader2 className="w-8 h-8 text-[#15AFA4] animate-spin mx-auto" />
          </div>
        )}
      </div>
    </>
  )
}
