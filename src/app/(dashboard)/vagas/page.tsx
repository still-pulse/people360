'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Briefcase, CheckCircle2, Clock, UserCheck, AlertTriangle,
  TrendingUp, BarChart2, Building2, ExternalLink, FileSpreadsheet, FileText,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { VAGA_STATUS_LABELS, VAGA_STATUS_COLORS } from '@/types'
import { formatDate } from '@/lib/utils'
import { useSettings } from '@/components/providers/SettingsProvider'

interface DashboardData {
  kpis: {
    total: number; abertas: number; admissaoEmAndamento: number; emAndamento: number
    contratadas: number; fechadas: number; aVencer: number
  }
  porUnidade: { name: string; color: string; value: number }[]
  statusCounts: { status: string; count: number }[]
  porAnalista: { name: string; abertas: number; total: number }[]
  porCargo: { cargo: string; count: number }[]
  vagasAVencer: {
    id: string; titulo: string; cargo: string
    unitName: string; unitColor: string; dataPrevista: string; status: string
  }[]
}

export default function VagasDashboardPage() {
  const { data: session } = useSession()
  const router  = useRouter()
  const isAdmin = session?.user?.role === 'ADMIN'
  const { settings } = useSettings()
  const [data, setData]         = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [exporting, setExporting] = useState<'excel' | 'pdf' | null>(null)

  useEffect(() => {
    fetch('/api/vagas/dashboard')
      .then((r) => r.json())
      .then((d) => { setData(d); setIsLoading(false) })
  }, [])

  const companyLabel = settings?.companyName || 'BHCL'
  const geradoEm = new Date().toLocaleDateString('pt-BR')

  // ── Excel ────────────────────────────────────────────────────────────────
  async function exportExcel() {
    if (!data) return
    setExporting('excel')
    const xlsxMod = await import('xlsx')
    const XLSX = (xlsxMod as any).default ?? xlsxMod
    const wb   = XLSX.utils.book_new()

    function sheet(title: string, rows: string[][], colWidths: number[]) {
      const ws = XLSX.utils.aoa_to_sheet([
        [companyLabel + ' — ' + title],
        [`Gerado em: ${geradoEm}`],
        [],
        ...rows,
      ])
      ws['!cols'] = colWidths.map((wch) => ({ wch }))
      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: colWidths.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: colWidths.length - 1 } },
      ]
      return ws
    }

    // KPIs
    XLSX.utils.book_append_sheet(wb, sheet(
      'Controle de Vagas — KPIs',
      [
        ['Indicador', 'Valor'],
        ['Total de Vagas',        String(data.kpis.total)],
        ['Abertas',               String(data.kpis.abertas)],
        ['Admissão em Andamento', String(data.kpis.admissaoEmAndamento)],
        ['Contratadas',           String(data.kpis.contratadas)],
        ['Vencem em 7 dias',      String(data.kpis.aVencer)],
        ['Fechadas / Canceladas', String(data.kpis.fechadas)],
      ],
      [36, 12],
    ), 'KPIs')

    // Por Status
    XLSX.utils.book_append_sheet(wb, sheet(
      'Vagas por Status',
      [
        ['Status', 'Qtd'],
        ...data.statusCounts.map((s) => [
          VAGA_STATUS_LABELS[s.status as keyof typeof VAGA_STATUS_LABELS] ?? s.status,
          String(s.count),
        ]),
      ],
      [32, 10],
    ), 'Por Status')

    // Por Unidade
    XLSX.utils.book_append_sheet(wb, sheet(
      'Em Andamento por Unidade',
      [
        ['Unidade', 'Vagas em Andamento'],
        ...data.porUnidade.map((u) => [u.name, String(u.value)]),
      ],
      [36, 22],
    ), 'Por Unidade')

    // Por Cargo
    XLSX.utils.book_append_sheet(wb, sheet(
      'Vagas por Cargo (Top 6)',
      [
        ['Cargo', 'Vagas em Andamento'],
        ...data.porCargo.map((c) => [c.cargo, String(c.count)]),
      ],
      [36, 22],
    ), 'Por Cargo')

    // Por Analista
    XLSX.utils.book_append_sheet(wb, sheet(
      'Vagas por Analista',
      [
        ['Analista', 'Em Aberto', 'Total'],
        ...data.porAnalista.map((a) => [a.name, String(a.abertas), String(a.total)]),
      ],
      [36, 14, 10],
    ), 'Por Analista')

    // Próximas do Prazo
    XLSX.utils.book_append_sheet(wb, sheet(
      'Próximas do Prazo (7 dias)',
      [
        ['Cargo', 'Unidade', 'Prazo Previsto', 'Status'],
        ...data.vagasAVencer.map((v) => [
          v.cargo, v.unitName, formatDate(v.dataPrevista),
          VAGA_STATUS_LABELS[v.status as keyof typeof VAGA_STATUS_LABELS] ?? v.status,
        ]),
      ],
      [36, 28, 18, 20],
    ), 'Próximas do Prazo')

    XLSX.writeFile(wb, `controle_vagas_${new Date().toISOString().slice(0, 10)}.xlsx`)
    setExporting(null)
  }

  // ── PDF Executivo ─────────────────────────────────────────────────────────
  async function exportPDF() {
    if (!data) return
    setExporting('pdf')
    const { default: jsPDF }     = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    // Carrega logo e converte: pixels visíveis → branco, pixels transparentes → teal
    // Garante logo branco sobre cabeçalho teal independente das cores originais do PNG
    let logoData: string | null = null
    try {
      const res = await fetch('https://people360.ossbhcl.org.br/api/uploads/logos/logo-1780430840483.png')
      if (res.ok) {
        const blob    = await res.blob()
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(blob)
        })
        const img = new Image()
        await new Promise<void>((resolve) => { img.onload = () => resolve(); img.src = dataUrl })
        const canvas = document.createElement('canvas')
        canvas.width  = img.width  || 300
        canvas.height = img.height || 120
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0)
        // Manipula pixels: visíveis → branco | transparentes → teal #15AFA4
        const id = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const d  = id.data
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] > 64) {
            d[i] = 255; d[i+1] = 255; d[i+2] = 255; d[i+3] = 255
          } else {
            d[i] = 21;  d[i+1] = 175; d[i+2] = 164; d[i+3] = 255
          }
        }
        ctx.putImageData(id, 0, 0)
        logoData = canvas.toDataURL('image/jpeg', 0.95)
      }
    } catch {}

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    // A4 landscape: W=297mm, H=210mm
    const W = 297, H = 210
    const M = 10  // margem lateral

    const TEAL   : [number,number,number] = [21, 175, 164]
    const BLUE   : [number,number,number] = [59, 130, 246]
    const INDIGO : [number,number,number] = [99, 102, 241]
    const GREEN  : [number,number,number] = [16, 185, 129]
    const RED    : [number,number,number] = [239, 68, 68]
    const GRAY   : [number,number,number] = [100, 116, 132]
    const LIGHT  : [number,number,number] = [235, 237, 240]
    const DARK   : [number,number,number] = [30, 40, 50]

    function hex2rgb(hex: string): [number,number,number] {
      return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)]
    }

    function sectionTitle(text: string, x: number, y: number) {
      doc.setFont('helvetica','bold'); doc.setFontSize(10); doc.setTextColor(...DARK)
      doc.text(text, x, y)
      doc.setDrawColor(...TEAL); doc.setLineWidth(0.4)
      doc.line(x, y + 1.5, x + doc.getTextWidth(text), y + 1.5)
    }

    // Barra horizontal: label à esquerda (right-aligned), trilha + barra, valor à direita
    function drawBar(
      barX: number, y: number, barMaxW: number,
      value: number, maxVal: number,
      color: [number,number,number],
      label: string, valueStr: string,
    ) {
      const filled = maxVal > 0 ? Math.max((value / maxVal) * barMaxW, value > 0 ? 1.5 : 0) : 0
      doc.setFillColor(...LIGHT); doc.roundedRect(barX, y, barMaxW, 5, 1.5, 1.5, 'F')
      if (filled > 0) { doc.setFillColor(...color); doc.roundedRect(barX, y, filled, 5, 1.5, 1.5, 'F') }
      doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(70, 80, 95)
      doc.text(label, barX - 3, y + 4, { align: 'right' })
      doc.setFont('helvetica','bold'); doc.setTextColor(...color)
      doc.text(valueStr, barX + barMaxW + 3, y + 4)
    }

    function pageHeader(title: string, subtitle: string) {
      doc.setFillColor(...TEAL); doc.rect(0, 0, W, 22, 'F')
      const logoX = M, logoY = 4, logoH = 14
      if (logoData) {
        try { doc.addImage(logoData, logoX, logoY, logoH * 1.0, logoH, undefined, 'FAST') } catch {}
        doc.setFontSize(15); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
        doc.text(title, logoX + logoH + 6, 12)
        doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(210,255,252)
        doc.text(subtitle, logoX + logoH + 6, 18.5)
      } else {
        doc.setFontSize(15); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
        doc.text(title, M, 12)
        doc.setFontSize(8.5); doc.setFont('helvetica','normal'); doc.setTextColor(210,255,252)
        doc.text(subtitle, M, 18.5)
      }
      doc.setFontSize(8); doc.setTextColor(220,255,252); doc.setFont('helvetica','normal')
      doc.text(`Gerado em ${geradoEm}`, W - M, 14, { align: 'right' })
    }

    function pageFooter(page: number, total: number) {
      doc.setFontSize(7); doc.setTextColor(160,160,160); doc.setFont('helvetica','normal')
      doc.text(`${companyLabel}  ·  Confidencial  ·  Página ${page} de ${total}`, W/2, H - 4, { align: 'center' })
    }

    // ════════════════════════════════════════════════════════════════════
    // PÁGINA 1 — KPIs + Status + Prazo
    // ════════════════════════════════════════════════════════════════════
    pageHeader(`${companyLabel} — Controle de Vagas`, 'Dashboard executivo de recrutamento e seleção')

    // 5 KPI cards
    const kpiDefs = [
      { label: 'Total de Vagas',        value: data.kpis.total,               color: TEAL   },
      { label: 'Abertas',               value: data.kpis.abertas,             color: BLUE   },
      { label: 'Admissão em Andamento', value: data.kpis.admissaoEmAndamento, color: INDIGO },
      { label: 'Contratadas',           value: data.kpis.contratadas,         color: GREEN  },
      { label: 'Vencem em 7 dias',      value: data.kpis.aVencer,
        color: data.kpis.aVencer > 0 ? RED : GRAY },
    ]
    const cW = 50, cH = 26, cY = 27, cGap = 5.5
    const cTotalW = kpiDefs.length * cW + (kpiDefs.length - 1) * cGap
    const cX0 = (W - cTotalW) / 2
    kpiDefs.forEach(({ label, value, color }, i) => {
      const cx = cX0 + i * (cW + cGap)
      doc.setFillColor(...color); doc.roundedRect(cx, cY, cW, cH, 3, 3, 'F')
      doc.setFontSize(21); doc.setTextColor(255,255,255); doc.setFont('helvetica','bold')
      doc.text(String(value), cx + cW/2, cY + 14, { align: 'center' })
      doc.setFontSize(7); doc.setFont('helvetica','normal')
      doc.text(label, cx + cW/2, cY + 22, { align: 'center' })
    })

    // Tabela: Distribuição por Status (esquerda)
    sectionTitle('Distribuição por Status', M, 63)
    autoTable(doc, {
      startY: 67,
      head: [['Status', 'Qtd']],
      body: data.statusCounts.map((s) => [
        VAGA_STATUS_LABELS[s.status as keyof typeof VAGA_STATUS_LABELS] ?? s.status,
        String(s.count),
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: TEAL, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,251] },
      columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 16, halign: 'center' } },
      tableWidth: 83, margin: { left: M },
    })

    // Tabela: Próximas do Prazo (direita)
    sectionTitle('Próximas do Prazo (7 dias)', 108, 63)
    autoTable(doc, {
      startY: 67,
      head: [['Cargo', 'Unidade', 'Prazo']],
      body: data.vagasAVencer.length > 0
        ? data.vagasAVencer.map((v) => [v.cargo, v.unitName, formatDate(v.dataPrevista)])
        : [['—', 'Nenhuma vaga vencendo nos próximos 7 dias', '']],
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: RED, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248,250,251] },
      columnStyles: { 0: { cellWidth: 65 }, 1: { cellWidth: 80 }, 2: { cellWidth: 24 } },
      tableWidth: 179, margin: { left: 108 },
    })

    // ════════════════════════════════════════════════════════════════════
    // PÁGINA 2 — Gráficos
    // Layout: A4 landscape 297×210mm, margens 10mm
    // Coluna esq: x=10..143  (133mm)  sep x=147  col dir: x=151..287 (136mm)
    //   barras esq: label até x=68 (58mm), bar 68→132 (64mm), valor a partir 135
    //   barras dir: label até x=207 (56mm), bar 207→271 (64mm), valor a partir 274
    // Analista (full width): label até x=75 (65mm), bar 75→255 (180mm), valor 258
    // ════════════════════════════════════════════════════════════════════
    doc.addPage()
    pageHeader(`${companyLabel} — Controle de Vagas`, 'Análise por Unidade, Cargo e Analista')

    const ROW_H   = 10   // espaço entre barras
    const BAR_H   = 5    // altura da barra
    const Y_START = 35   // início das barras após título

    // ─── Coluna esquerda: Em Andamento por Unidade ───────────────────────
    // barX=68, maxW=64 → termina em 132, valor em 135 + ~6 → 141 < 143 ✓
    {
      const barX = 68, maxW = 64
      sectionTitle('Em Andamento por Unidade', M, 29)
      const maxVal = Math.max(...data.porUnidade.map((u) => u.value), 1)
      if (data.porUnidade.length === 0) {
        doc.setFontSize(8); doc.setTextColor(160,160,160); doc.text('Sem dados', barX, Y_START + 4)
      } else {
        data.porUnidade.forEach((u, i) => {
          const label = u.name.length > 20 ? u.name.slice(0, 19) + '…' : u.name
          drawBar(barX, Y_START + i * ROW_H, maxW, u.value, maxVal,
            hex2rgb(u.color?.length === 7 ? u.color : '#15AFA4'), label, String(u.value))
        })
      }
    }

    // Separador vertical
    doc.setDrawColor(220, 224, 230); doc.setLineWidth(0.25)
    doc.line(147, 25, 147, 110)

    // ─── Coluna direita: Vagas por Cargo ─────────────────────────────────
    // barX=207, maxW=64 → termina em 271, valor em 274 + ~6 → 280 < 287 ✓
    {
      const barX = 207, maxW = 64
      sectionTitle('Vagas por Cargo (top 6)', 151, 29)
      const maxVal = Math.max(...data.porCargo.map((c) => c.count), 1)
      if (data.porCargo.length === 0) {
        doc.setFontSize(8); doc.setTextColor(160,160,160); doc.text('Sem dados', barX, Y_START + 4)
      } else {
        data.porCargo.forEach((c, i) => {
          const label = c.cargo.length > 18 ? c.cargo.slice(0, 17) + '…' : c.cargo
          drawBar(barX, Y_START + i * ROW_H, maxW, c.count, maxVal, TEAL, label, String(c.count))
        })
      }
    }

    // ─── Full width: Vagas por Analista ──────────────────────────────────
    // barX=75, maxW=175 → termina em 250, valor em 253 + ~22 → 275 < 287 ✓
    {
      const secY  = 118
      const barX  = 75, maxW = 175
      sectionTitle('Vagas por Analista', M, secY)
      const maxVal = Math.max(...data.porAnalista.map((a) => a.total), 1)
      if (data.porAnalista.length === 0) {
        doc.setFontSize(8); doc.setTextColor(160,160,160); doc.text('Sem dados', barX, secY + 10)
      } else {
        data.porAnalista.forEach((a, i) => {
          const by = secY + 6 + i * ROW_H
          // trilha total (cinza)
          doc.setFillColor(...LIGHT); doc.roundedRect(barX, by, maxW, BAR_H, 1.5, 1.5, 'F')
          // barra abertas (teal)
          const abW = maxVal > 0 ? Math.max((a.abertas / maxVal) * maxW, a.abertas > 0 ? 2 : 0) : 0
          if (abW > 0) { doc.setFillColor(...TEAL); doc.roundedRect(barX, by, abW, BAR_H, 1.5, 1.5, 'F') }
          // label nome (primeiros 3 palavras)
          const shortName = a.name.split(' ').slice(0, 3).join(' ')
          const label = shortName.length > 24 ? shortName.slice(0, 23) + '…' : shortName
          doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(70, 80, 95)
          doc.text(label, barX - 3, by + 4, { align: 'right' })
          // valor
          doc.setFont('helvetica','bold'); doc.setTextColor(...TEAL)
          doc.text(`${a.abertas} aberta${a.abertas !== 1 ? 's' : ''} / ${a.total} total`,
            barX + maxW + 3, by + 4)
        })
      }
    }

    // Rodapés
    const totalPages = (doc as any).internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) { doc.setPage(p); pageFooter(p, totalPages) }

    doc.save(`controle_vagas_${new Date().toISOString().slice(0, 10)}.pdf`)
    setExporting(null)
  }

  const kpiCards = data ? [
    { label: 'Total de Vagas',          value: data.kpis.total,               icon: Briefcase,     color: '#15AFA4' },
    { label: 'Abertas',                 value: data.kpis.abertas,             icon: Clock,         color: '#3B82F6' },
    { label: 'Admissão em Andamento',   value: data.kpis.admissaoEmAndamento, icon: UserCheck,     color: '#6366F1' },
    { label: 'Contratadas',             value: data.kpis.contratadas,         icon: CheckCircle2,  color: '#10B981' },
    { label: 'Vencem em 7 dias',        value: data.kpis.aVencer,             icon: AlertTriangle, color: data.kpis.aVencer > 0 ? '#EF4444' : '#94A3B8' },
  ] : []

  const pieData = data?.statusCounts.map((s) => ({
    name: VAGA_STATUS_LABELS[s.status as keyof typeof VAGA_STATUS_LABELS] ?? s.status,
    value: s.count,
    color: VAGA_STATUS_COLORS[s.status as keyof typeof VAGA_STATUS_COLORS] ?? '#94A3B8',
  })) ?? []

  return (
    <>
      <Header title="Controle de Vagas" subtitle="Dashboard executivo de recrutamento e seleção" />
      <div className="p-6 space-y-6">

        {/* Navegação entre sub-páginas + exportações */}
        <div className="flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
          {[
            { label: 'Dashboard', href: '/vagas' },
            { label: 'Lista', href: '/vagas/lista' },
            { label: 'Controle', href: '/vagas/controle' },
          ].map((tab) => (
            <button
              key={tab.href}
              onClick={() => router.push(tab.href)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab.href === '/vagas'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

          {/* Botões de exportação — admin only */}
          {isAdmin && !isLoading && data && (
            <div className="flex gap-2 ml-auto">
              <Button variant="outline" size="sm"
                icon={<FileSpreadsheet className="w-4 h-4 text-green-600" />}
                isLoading={exporting === 'excel'} onClick={exportExcel}>
                Excel
              </Button>
              <Button variant="outline" size="sm"
                icon={<FileText className="w-4 h-4 text-red-500" />}
                isLoading={exporting === 'pdf'} onClick={exportPDF}>
                Relatório Executivo
              </Button>
            </div>
          )}
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
          {isLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 h-28 animate-pulse">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl mb-3" /><div className="h-3 bg-gray-100 rounded w-2/3 mb-2" /><div className="h-6 bg-gray-100 rounded w-1/2" />
                </div>
              ))
            : kpiCards.map((k) => {
                const Icon = k.icon
                return (
                  <div key={k.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: k.color + '18' }}>
                      <Icon className="w-4 h-4" style={{ color: k.color }} />
                    </div>
                    <p className="text-xs text-gray-500 font-medium leading-tight mb-1">{k.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                  </div>
                )
              })}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Vagas por status (pizza) */}
          <Card>
            <CardHeader>
              <CardTitle>Vagas por Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
              {isLoading ? <div className="h-44 w-full animate-pulse bg-gray-50 rounded-xl" /> : (
                <>
                  <PieChart width={180} height={180}>
                    <Pie data={pieData} cx={90} cy={90} innerRadius={50} outerRadius={80} paddingAngle={2} dataKey="value">
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                  </PieChart>
                  <div className="w-full space-y-1.5">
                    {pieData.map((e) => (
                      <div key={e.name} className="flex items-center gap-2 text-xs">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: e.color }} />
                        <span className="text-gray-600 flex-1">{e.name}</span>
                        <span className="font-bold text-gray-900">{e.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Vagas por unidade */}
          <Card>
            <CardHeader>
              <CardTitle>Em Andamento por Unidade</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="h-48 animate-pulse bg-gray-50 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data?.porUnidade ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="value" name="Vagas" radius={[4, 4, 0, 0]}>
                      {data?.porUnidade.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Vagas próximas do prazo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Próximas do Prazo
              </CardTitle>
              <span className="text-xs text-gray-400">Vencem em 7 dias</span>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="space-y-2">{[1,2,3].map(i=><div key={i} className="h-12 animate-pulse bg-gray-50 rounded-xl"/>)}</div> : (
                data?.vagasAVencer.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle2 className="w-10 h-10 text-green-300 mb-2" />
                    <p className="text-sm text-gray-400">Nenhuma vaga vencendo em 7 dias</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {data?.vagasAVencer.map((v) => (
                      <button
                        key={v.id}
                        onClick={() => router.push(`/vagas/${v.id}`)}
                        className="w-full flex items-start gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors text-left group"
                      >
                        <div className="w-2.5 h-2.5 rounded-full mt-1 flex-shrink-0" style={{ background: v.unitColor }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">{v.cargo}</p>
                          <p className="text-xs text-gray-500">{v.unitName} · {formatDate(v.dataPrevista)}</p>
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#15AFA4] flex-shrink-0 mt-0.5" />
                      </button>
                    ))}
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Por cargo */}
          <Card>
            <CardHeader>
              <CardTitle>Vagas por Cargo</CardTitle>
              <span className="text-xs text-gray-400">Em andamento — top 6</span>
            </CardHeader>
            <CardContent>
              {isLoading ? <div className="h-44 animate-pulse bg-gray-50 rounded-xl" /> : (
                <ResponsiveContainer width="100%" height={180}>
                  <BarChart data={data?.porCargo ?? []} layout="vertical" margin={{ top: 0, right: 20, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} allowDecimals={false} />
                    <YAxis dataKey="cargo" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={120} />
                    <Tooltip contentStyle={{ borderRadius: '12px', fontSize: '12px' }} />
                    <Bar dataKey="count" name="Vagas" fill="#15AFA4" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          {/* Por analista */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle>Vagas por Analista</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <div className="h-44 animate-pulse bg-gray-50 rounded-xl" /> : (
                  data?.porAnalista.length === 0 ? (
                    <p className="text-sm text-gray-400 py-8 text-center">Nenhum dado disponível</p>
                  ) : (
                    <div className="space-y-3">
                      {data?.porAnalista.map((a) => (
                        <div key={a.name}>
                          <div className="flex justify-between text-sm mb-1">
                            <span className="font-medium text-gray-700">{a.name}</span>
                            <span className="text-gray-500">{a.abertas} em aberto / {a.total} total</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-[#15AFA4] rounded-full transition-all"
                              style={{ width: `${a.total > 0 ? (a.abertas / Math.max(...(data?.porAnalista.map(x => x.abertas) ?? [1]))) * 100 : 0}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}
