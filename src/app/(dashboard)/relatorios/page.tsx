'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useSettings } from '@/components/providers/SettingsProvider'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'
import { FileSpreadsheet, FileText, Loader2, Crown, Download, Building2 } from 'lucide-react'
import { MONTHS_PT } from '@/types'
import {
  formatMonthYear,
  calculateTurnoverRate,
  calculateAbsenteeismRate,
  calculatePCDMinimum,
} from '@/lib/utils'

interface Unit { id: string; name: string; color: string }

const currentYear = new Date().getFullYear()
const years = [currentYear, currentYear - 1, currentYear - 2]
const monthOptions = [
  { value: '0', label: 'Todos os meses' },
  ...MONTHS_PT.map((label, i) => ({ value: String(i + 1), label })),
]

type ReportType = 'pcd' | 'apprentice' | 'turnover' | 'absenteeism' | 'headcount'

const reportOptions = [
  { value: 'pcd', label: 'Indicador PCD' },
  { value: 'apprentice', label: 'Indicador Aprendiz' },
  { value: 'turnover', label: 'Turnover' },
  { value: 'absenteeism', label: 'Absenteísmo' },
  { value: 'headcount', label: 'Headcount' },
]

export default function RelatoriosPage() {
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN'
  const analystUnitId = session?.user?.unitId
  const { settings } = useSettings()

  const [units, setUnits] = useState<Unit[]>([])
  const [reportType, setReportType] = useState<ReportType>('turnover')
  const [filterYear, setFilterYear] = useState(currentYear)
  const [filterMonth, setFilterMonth] = useState(0)
  const [filterUnit, setFilterUnit] = useState('')
  const [tableData, setTableData] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | 'executive' | null>(null)
  const [execModalOpen, setExecModalOpen] = useState(false)
  const [execYear, setExecYear] = useState(currentYear)

  // Inicializa filtro de unidade para analista
  useEffect(() => {
    fetch('/api/units')
      .then((r) => r.json())
      .then((data: Unit[]) => {
        setUnits(data)
        if (!isAdmin && analystUnitId) setFilterUnit(analystUnitId)
      })
  }, [isAdmin, analystUnitId])

  useEffect(() => {
    loadReport()
  }, [reportType, filterYear, filterMonth, filterUnit])

  async function loadReport() {
    setIsLoading(true)
    const apiMap: Record<ReportType, string> = {
      pcd: '/api/indicators/pcd',
      apprentice: '/api/indicators/apprentice',
      turnover: '/api/indicators/turnover',
      absenteeism: '/api/indicators/absenteeism',
      headcount: '/api/headcount',
    }

    const params = new URLSearchParams({ year: String(filterYear) })
    if (filterUnit) params.set('unitId', filterUnit)
    if (filterMonth > 0) params.set('month', String(filterMonth))

    const res = await fetch(`${apiMap[reportType]}?${params}`)
    const data = await res.json()
    setTableData(Array.isArray(data) ? data : [])
    setIsLoading(false)
  }

  function getColumns(): { key: string; label: string; format?: (v: any, row: any) => string }[] {
    switch (reportType) {
      case 'pcd':
        return [
          { key: 'unit.name', label: 'Unidade' },
          { key: 'year', label: 'Ano' },
          { key: 'month', label: 'Mês', format: (_, row) => MONTHS_PT[row.month - 1] },
          { key: 'totalEmployees', label: 'Colaboradores' },
          { key: 'metaPercentage', label: 'Meta (%)' },
          { key: 'min', label: 'Mínimo', format: (_, row) => String(calculatePCDMinimum(row.totalEmployees, row.metaPercentage)) },
          { key: 'currentPcd', label: 'PCD Atual' },
        ]
      case 'apprentice':
        return [
          { key: 'unit.name', label: 'Unidade' },
          { key: 'year', label: 'Ano' },
          { key: 'month', label: 'Mês', format: (_, row) => MONTHS_PT[row.month - 1] },
          { key: 'totalEmployees', label: 'Colaboradores' },
          { key: 'requiredCount', label: 'Obrigatório' },
          { key: 'currentCount', label: 'Atual' },
        ]
      case 'turnover':
        return [
          { key: 'unit.name', label: 'Unidade' },
          { key: 'year', label: 'Ano' },
          { key: 'month', label: 'Mês', format: (_, row) => MONTHS_PT[row.month - 1] },
          { key: 'admissions', label: 'Admissões' },
          { key: 'dismissals', label: 'Desligamentos' },
          { key: 'headcountStart', label: 'HC Início' },
          { key: 'headcountEnd', label: 'HC Fim' },
          { key: 'rate', label: 'Taxa (%)', format: (_, row) => calculateTurnoverRate(row.admissions, row.dismissals, row.headcountStart, row.headcountEnd).toFixed(1) + '%' },
        ]
      case 'absenteeism':
        return [
          { key: 'unit.name', label: 'Unidade' },
          { key: 'year', label: 'Ano' },
          { key: 'month', label: 'Mês', format: (_, row) => MONTHS_PT[row.month - 1] },
          { key: 'totalCertificates', label: 'Atestados' },
          { key: 'totalDaysLost', label: 'Dias Perdidos' },
          { key: 'totalEmployees', label: 'Colaboradores' },
          { key: 'rate', label: 'Taxa (%)', format: (_, row) => calculateAbsenteeismRate(row.totalDaysLost, row.totalEmployees, row.workingDaysInMonth).toFixed(2) + '%' },
        ]
      case 'headcount':
        return [
          { key: 'unit.name', label: 'Unidade' },
          { key: 'position.name', label: 'Cargo' },
          { key: 'year', label: 'Ano' },
          { key: 'month', label: 'Mês', format: (_, row) => MONTHS_PT[row.month - 1] },
          { key: 'count', label: 'Quantidade' },
        ]
    }
  }

  function getCellValue(row: any, col: { key: string; format?: (v: any, row: any) => string }): string {
    if (col.format) return col.format(null, row)
    const keys = col.key.split('.')
    let val = row
    for (const k of keys) val = val?.[k]
    return String(val ?? '')
  }

  async function exportExcel() {
    setIsExporting('excel')
    const XLSX = await import('@/lib/xlsxSafe')
    const columns = getColumns()
    const companyLabel = settings.companyName || 'BHCL'
    const reportLabel = reportOptions.find((r) => r.value === reportType)?.label ?? ''

    // Cabeçalho informativo nas primeiras linhas
    const headerRows = [
      { A: `${companyLabel} — ${reportLabel}` },
      { A: `Período: ${filterYear}${filterMonth > 0 ? ` / ${MONTHS_PT[filterMonth - 1]}` : ''}` },
      { A: `Gerado em: ${new Date().toLocaleDateString('pt-BR')}` },
      {},
    ]

    const dataRows = tableData.map((row) => {
      const obj: Record<string, string> = {}
      columns.forEach((col) => { obj[col.label] = getCellValue(row, col) })
      return obj
    })

    const wb = XLSX.utils.book_new()

    // Cria planilha com cabeçalho + dados
    const wsData = [
      [companyLabel + ' — ' + reportLabel],
      [`Período: ${filterYear}${filterMonth > 0 ? ' / ' + MONTHS_PT[filterMonth - 1] : ''}`],
      [`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`],
      [],
      columns.map((c) => c.label),
      ...tableData.map((row) => columns.map((col) => getCellValue(row, col))),
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)

    // Largura de colunas automática
    const colWidths = columns.map((col) => ({
      wch: Math.max(col.label.length, 15)
    }))
    ws['!cols'] = colWidths

    // Mescla o cabeçalho
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: columns.length - 1 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, 'Relatório')
    XLSX.writeFile(wb, `relatorio_${reportType}_${filterYear}.xlsx`)
    setIsExporting(null)
  }

  async function exportPDF() {
    setIsExporting('pdf')
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')
    const doc = new jsPDF({ orientation: 'landscape' })
    const columns = getColumns()

    let logoBase64: string | null = null
    try {
      const lr = await fetch('/api/settings/logo-base64')
      if (lr.ok) { const ld = await lr.json(); logoBase64 = ld.base64 ?? null }
    } catch {}

    const companyLabel = settings.companyName || 'BHCL'
    const reportLabel = reportOptions.find((r) => r.value === reportType)?.label ?? ''

    if (logoBase64) {
      try { doc.addImage(logoBase64, 10, 6, 28, 10, undefined, 'FAST') } catch {}
      doc.setFontSize(13)
      doc.setTextColor(21, 175, 164)
      doc.text(`${companyLabel} — ${reportLabel}`, 44, 14)
    } else {
      doc.setFontSize(14)
      doc.setTextColor(21, 175, 164)
      doc.text(`${companyLabel} — ${reportLabel}`, 14, 16)
    }

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Período: ${filterYear}${filterMonth > 0 ? ` / ${MONTHS_PT[filterMonth - 1]}` : ''}`, 14, 22)

    autoTable(doc, {
      startY: 28,
      head: [columns.map((c) => c.label)],
      body: tableData.map((row) => columns.map((col) => getCellValue(row, col))),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [21, 175, 164], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 251] },
    })

    doc.save(`relatorio_${reportType}_${filterYear}.pdf`)
    setIsExporting(null)
  }

  async function exportExecutivePDF() {
    setIsExporting('executive')
    try {
      const res = await fetch(`/api/reports/executive?year=${execYear}`)
      const data = await res.json()
      await generateExecutivePDF(data)
    } finally {
      setIsExporting(null)
      setExecModalOpen(false)
    }
  }

  async function generateExecutivePDF(data: any) {
    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    // Carrega logo em base64
    let logoBase64: string | null = null
    try {
      const lr = await fetch('/api/settings/logo-base64')
      if (lr.ok) { const ld = await lr.json(); logoBase64 = ld.base64 ?? null }
    } catch {}

    const companyLabel = settings.companyName || 'BHCL'

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    const H = doc.internal.pageSize.getHeight()
    const PRIMARY = [21, 175, 164] as [number, number, number]
    const PRIMARY_DARK = [13, 140, 130] as [number, number, number]
    const LIGHT_BG = [240, 253, 252] as [number, number, number]
    const TEXT_DARK = [30, 41, 59] as [number, number, number]
    const TEXT_GRAY = [100, 116, 139] as [number, number, number]
    const WHITE = [255, 255, 255] as [number, number, number]

    const fmtBRL = (v: number) => 'R$ ' + Math.round(v).toLocaleString('pt-BR')

    const months = MONTHS_PT
    const generatedAt = new Date(data.generatedAt).toLocaleDateString('pt-BR', {
      day: '2-digit', month: 'long', year: 'numeric',
    })

    // ─── CAPA ────────────────────────────────────────────────────────────────
    doc.setFillColor(...PRIMARY)
    doc.rect(0, 0, W, 42, 'F')
    doc.setFillColor(...PRIMARY_DARK)
    doc.rect(0, 0, W, 8, 'F')

    // Logo (real ou placeholder)
    const titleX = logoBase64 ? 46 : 40
    if (logoBase64) {
      // Logo real — fundo branco arredondado + imagem
      doc.setFillColor(...WHITE)
      doc.roundedRect(10, 11, 28, 20, 3, 3, 'F')
      try { doc.addImage(logoBase64, 12, 13, 24, 16, undefined, 'FAST') } catch {}
    } else {
      // Placeholder com texto
      doc.setFillColor(...WHITE)
      doc.roundedRect(10, 11, 22, 22, 3, 3, 'F')
      doc.setFontSize(13)
      doc.setTextColor(...PRIMARY)
      doc.setFont('helvetica', 'bold')
      doc.text(companyLabel.slice(0, 4), 14, 26)
    }

    // Título principal
    doc.setTextColor(...WHITE)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('Relatório Executivo', titleX, 22)
    doc.setFontSize(11)
    doc.setFont('helvetica', 'normal')
    doc.text('Gestão Estratégica de Pessoas', titleX, 30)

    // Período e data
    doc.setFontSize(9)
    doc.setTextColor(200, 245, 242)
    doc.text(`Ano de Referência: ${data.year}  ·  Gerado em ${generatedAt}`, titleX, 38)

    // Linha separadora
    doc.setFillColor(...PRIMARY_DARK)
    doc.rect(0, 42, W, 1, 'F')

    // ─── SUMÁRIO EXECUTIVO ───────────────────────────────────────────────────
    let y = 52

    doc.setTextColor(...TEXT_DARK)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('SUMÁRIO EXECUTIVO', 14, y)

    // Linha decorativa
    doc.setFillColor(...PRIMARY)
    doc.rect(14, y + 2, 40, 1, 'F')

    y += 10

    const kpis = [
      { label: 'Total de\nColaboradores', value: String(data.consolidated.totalHeadcount || '—') },
      { label: 'Profissionais\nPCD', value: String(data.consolidated.totalPcd) },
      { label: 'Jovens\nAprendizes', value: String(data.consolidated.totalApprentices) },
      { label: 'Turnover\nMédio', value: data.consolidated.avgTurnover !== null ? `${data.consolidated.avgTurnover}%` : '—' },
      { label: 'Dias de\nAbsenteísmo', value: String(data.consolidated.totalAbsenteeismDays) },
      { label: 'Unidades\nMonitoradas', value: String(data.consolidated.totalUnits) },
    ]

    const cardW = (W - 28 - 10) / 6
    kpis.forEach((kpi, i) => {
      const x = 14 + i * (cardW + 2)

      // Card background
      doc.setFillColor(...LIGHT_BG)
      doc.roundedRect(x, y, cardW, 22, 2, 2, 'F')

      // Borda esquerda colorida
      doc.setFillColor(...PRIMARY)
      doc.rect(x, y, 2, 22, 'F')

      // Valor
      doc.setTextColor(...PRIMARY)
      doc.setFontSize(16)
      doc.setFont('helvetica', 'bold')
      doc.text(kpi.value, x + cardW / 2, y + 11, { align: 'center' })

      // Label
      doc.setTextColor(...TEXT_GRAY)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      const lines = kpi.label.split('\n')
      lines.forEach((line, li) => {
        doc.text(line, x + cardW / 2, y + 16 + li * 3.5, { align: 'center' })
      })
    })

    y += 30

    // ─── KPIs COMPLEMENTARES (2ª LINHA) ──────────────────────────────────────
    const kpis2 = [
      {
        label: 'Engajamento\nMédio',
        value: data.consolidated.avgEngagement !== null ? `${data.consolidated.avgEngagement}%` : '—',
      },
      {
        label: 'NPS Médio\n(eNPS)',
        value: data.consolidated.avgNps !== null
          ? (data.consolidated.avgNps >= 0 ? `+${data.consolidated.avgNps}` : String(data.consolidated.avgNps))
          : '—',
      },
      {
        label: 'Custo Médio\np/ Colaborador',
        value: data.consolidated.avgCostPerEmployee !== null ? fmtBRL(data.consolidated.avgCostPerEmployee) : '—',
      },
    ]

    const cardW2 = (W - 28 - 4) / 3
    kpis2.forEach((kpi, i) => {
      const x = 14 + i * (cardW2 + 2)
      doc.setFillColor(250, 250, 250)
      doc.roundedRect(x, y, cardW2, 18, 2, 2, 'F')
      doc.setFillColor(...PRIMARY)
      doc.rect(x, y, 2, 18, 'F')
      doc.setTextColor(...PRIMARY)
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.text(kpi.value, x + cardW2 / 2, y + 9, { align: 'center' })
      doc.setTextColor(...TEXT_GRAY)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      kpi.label.split('\n').forEach((line, li) => {
        doc.text(line, x + cardW2 / 2, y + 13 + li * 3, { align: 'center' })
      })
    })

    y += 26

    // ─── VISÃO GERAL POR UNIDADE ─────────────────────────────────────────────
    doc.setTextColor(...TEXT_DARK)
    doc.setFontSize(12)
    doc.setFont('helvetica', 'bold')
    doc.text('VISÃO GERAL POR UNIDADE', 14, y)
    doc.setFillColor(...PRIMARY)
    doc.rect(14, y + 2, 60, 1, 'F')
    y += 8

    const overviewHead = [['Unidade', 'Headcount', 'PCD Atual', 'PCD Meta', 'Status PCD', 'Aprendizes', 'Status Aprendiz', 'Turnover %', 'Absenteísmo %', 'Dias Abs.']]
    const overviewBody = data.units.map((u: any) => [
      u.unit.name,
      u.summary.totalHeadcount || '—',
      u.summary.pcdCurrent,
      `${u.summary.pcdRequired} (${u.summary.pcdMeta}%)`,
      u.summary.pcdStatus,
      u.summary.apprenticeCurrent,
      u.summary.apprenticeStatus,
      u.summary.turnoverRate !== null ? `${u.summary.turnoverRate}%` : '—',
      u.summary.absenteeismRate !== null ? `${u.summary.absenteeismRate}%` : '—',
      u.summary.absenteeismDays,
    ])

    autoTable(doc, {
      startY: y,
      head: overviewHead,
      body: overviewBody,
      styles: { fontSize: 8, cellPadding: 2.5, textColor: TEXT_DARK },
      headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [248, 250, 251] },
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && (hookData.column.index === 4 || hookData.column.index === 6)) {
          const v = String(hookData.cell.raw)
          hookData.cell.styles.fontStyle = 'bold'
          if (v === 'Atingida') hookData.cell.styles.textColor = [16, 185, 129]
          else if (v === 'Atenção') hookData.cell.styles.textColor = [245, 158, 11]
          else if (v === 'Abaixo') hookData.cell.styles.textColor = [239, 68, 68]
        }
      },
      margin: { left: 14, right: 14 },
    })

    // ─── PÁGINA 2 — PCD EVOLUÇÃO SEMANAL ───────────────────────────────────
    const hasPcdWeekly = data.units.some((u: any) => u.pcdWeeklyHistory?.length > 0)
    if (hasPcdWeekly) {
      doc.addPage()
      doc.setFillColor(...PRIMARY)
      doc.rect(0, 0, W, 12, 'F')
      doc.setTextColor(...WHITE)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('BHCL — Relatório Executivo de Gestão de Pessoas', 14, 8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Ano ${data.year}`, W - 14, 8, { align: 'right' })

      y = 22
      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('PCD — EVOLUÇÃO SEMANAL POR UNIDADE', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 80, 1, 'F')
      y += 10

      const allWeekDates = Array.from(
        new Set(data.units.flatMap((u: any) => (u.pcdWeeklyHistory ?? []).map((w: any) => w.weekDate)))
      ).sort() as string[]

      if (allWeekDates.length > 0) {
        const fmtDate = (iso: string) => {
          const d = new Date(iso)
          return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })
        }

        const pcdWeekHead = [['Unidade', ...allWeekDates.map(fmtDate), 'Variação']]
        const pcdWeekBody = data.units.map((u: any) => {
          const history = u.pcdWeeklyHistory ?? []
          const values = allWeekDates.map((wd: string) => {
            const snap = history.find((w: any) => w.weekDate === wd)
            return snap ? String(snap.currentPcd) : '-'
          })
          const numericValues = allWeekDates
            .map((wd: string) => history.find((w: any) => w.weekDate === wd)?.currentPcd)
            .filter((v: any) => v !== undefined) as number[]
          const variation = numericValues.length >= 2
            ? numericValues[numericValues.length - 1] - numericValues[0]
            : 0
          const variationStr = numericValues.length >= 2
            ? (variation > 0 ? `+${variation}` : String(variation))
            : '-'
          return [u.unit.name, ...values, variationStr]
        })

        autoTable(doc, {
          startY: y,
          head: pcdWeekHead,
          body: pcdWeekBody,
          styles: { fontSize: 8, cellPadding: 2.5, halign: 'center', textColor: TEXT_DARK },
          headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold', fontSize: 8 },
          alternateRowStyles: { fillColor: [248, 250, 251] },
          columnStyles: { 0: { halign: 'left' } },
          didParseCell: (hookData: any) => {
            if (hookData.section === 'body') {
              const lastCol = allWeekDates.length + 1
              if (hookData.column.index === lastCol) {
                const val = String(hookData.cell.raw)
                hookData.cell.styles.fontStyle = 'bold'
                if (val.startsWith('+')) hookData.cell.styles.textColor = [16, 185, 129]
                else if (val.startsWith('-')) hookData.cell.styles.textColor = [239, 68, 68]
              }
            }
          },
          margin: { left: 14, right: 14 },
        })

        y = (doc as any).lastAutoTable.finalY + 10

        doc.setFontSize(7)
        doc.setTextColor(...TEXT_GRAY)
        doc.setFont('helvetica', 'italic')
        doc.text('Valores registrados nas sextas-feiras. Variação = diferença entre primeiro e último registro do período.', 14, y)
      }
    }

    // Helper: adiciona mini header em nova página
    function addPageHeader() {
      doc.addPage()
      doc.setFillColor(...PRIMARY)
      doc.rect(0, 0, W, 12, 'F')
      doc.setTextColor(...WHITE)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.text('BHCL — Relatório Executivo de Gestão de Pessoas', 14, 8)
      doc.setFont('helvetica', 'normal')
      doc.text(`Ano ${data.year}`, W - 14, 8, { align: 'right' })
      return 22
    }

    function checkPageBreak(currentY: number, minSpace = 20): number {
      if (currentY > H - minSpace) return addPageHeader()
      return currentY
    }

    // ─── TURNOVER HISTÓRICO ──────────────────────────────────────────────────
    const hasTurnover = data.units.some((u: any) => u.turnoverHistory.length > 0)
    if (hasTurnover) {
      y = addPageHeader()

      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TURNOVER — HISTÓRICO MENSAL POR UNIDADE', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 80, 1, 'F')
      y += 10

      for (const unitData of data.units) {
        if (unitData.turnoverHistory.length === 0) continue

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...PRIMARY)
        doc.text(`▸ ${unitData.unit.name}`, 14, y)
        y += 5

        autoTable(doc, {
          startY: y,
          head: [['Mês', 'Admissões', 'Desligamentos', 'Taxa de Turnover']],
          body: unitData.turnoverHistory.map((t: any) => [
            months[t.month - 1],
            t.admissions,
            t.dismissals,
            `${t.rate}%`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 251] },
          columnStyles: { 3: { fontStyle: 'bold', textColor: TEXT_DARK } },
          margin: { left: 14, right: W / 2 + 4 },
          tableWidth: W / 2 - 18,
        })

        y = (doc as any).lastAutoTable.finalY + 8
        y = checkPageBreak(y)
      }
    }

    // ─── ABSENTEÍSMO ─────────────────────────────────────────────────────────
    const hasAbsenteeism = data.units.some((u: any) => u.absenteeismHistory.length > 0)
    if (hasAbsenteeism) {
      y = addPageHeader()

      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ABSENTEÍSMO — HISTÓRICO MENSAL POR UNIDADE', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 80, 1, 'F')
      y += 10

      for (const unitData of data.units) {
        if (unitData.absenteeismHistory.length === 0) continue

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...PRIMARY)
        doc.text(`▸ ${unitData.unit.name}`, 14, y)
        y += 5

        autoTable(doc, {
          startY: y,
          head: [['Mês', 'Atestados', 'Dias Perdidos', 'Taxa (%)']],
          body: unitData.absenteeismHistory.map((a: any) => [
            months[a.month - 1],
            a.certificates,
            a.daysLost,
            `${a.rate}%`,
          ]),
          styles: { fontSize: 8, cellPadding: 2 },
          headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 251] },
          margin: { left: 14, right: W / 2 + 4 },
          tableWidth: W / 2 - 18,
        })

        y = (doc as any).lastAutoTable.finalY + 8
        y = checkPageBreak(y)
      }
    }

    // ─── HEADCOUNT POR UNIDADE ───────────────────────────────────────────────
    const hcTableData: string[][] = []
    for (const unitData of data.units) {
      for (const h of unitData.headcountByPosition) {
        hcTableData.push([unitData.unit.name, h.position, String(h.count)])
      }
      if (unitData.headcountByPosition.length > 0) {
        const total = unitData.headcountByPosition.reduce((s: number, h: any) => s + h.count, 0)
        hcTableData.push(['', 'TOTAL', String(total)])
      }
    }

    if (hcTableData.length > 0) {
      y = addPageHeader()

      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('HEADCOUNT — DISTRIBUIÇÃO POR CARGO (MÊS ATUAL)', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 80, 1, 'F')
      y += 10

      autoTable(doc, {
        startY: y,
        head: [['Unidade', 'Cargo', 'Quantidade']],
        body: hcTableData,
        styles: { fontSize: 9, cellPadding: 2.5 },
        headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [248, 250, 251] },
        didParseCell: (hookData: any) => {
          if (hookData.section === 'body' && hookData.row.raw[1] === 'TOTAL') {
            hookData.cell.styles.fontStyle = 'bold'
            hookData.cell.styles.fillColor = LIGHT_BG
            hookData.cell.styles.textColor = PRIMARY
          }
        },
        margin: { left: 14, right: 14 },
      })
    }

    // ─── ENGAJAMENTO & NPS ───────────────────────────────────────────────────
    const hasEngagementNps = data.units.some((u: any) => u.engagementHistory.length > 0 || u.npsHistory.length > 0)
    if (hasEngagementNps) {
      y = addPageHeader()

      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('ENGAJAMENTO & NPS — HISTÓRICO MENSAL POR UNIDADE', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 90, 1, 'F')
      y += 10

      for (const unitData of data.units) {
        const hasEngagement = unitData.engagementHistory.length > 0
        const hasNps = unitData.npsHistory.length > 0
        if (!hasEngagement && !hasNps) continue

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...PRIMARY)
        doc.text(`▸ ${unitData.unit.name}`, 14, y)
        y += 5

        let finalY1 = y
        let finalY2 = y

        if (hasEngagement) {
          autoTable(doc, {
            startY: y,
            head: [['Mês', 'Engajamento', 'Respondentes', 'Total Colab.']],
            body: unitData.engagementHistory.map((e: any) => [
              months[e.month - 1], `${e.rate}%`, e.totalRespondents, e.totalEmployees,
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            margin: { left: 14, right: W / 2 + 4 },
            tableWidth: W / 2 - 18,
          })
          finalY1 = (doc as any).lastAutoTable.finalY
        }

        if (hasNps) {
          autoTable(doc, {
            startY: y,
            head: [['Mês', 'Promotores', 'Neutros', 'Detratores', 'eNPS']],
            body: unitData.npsHistory.map((n: any) => [
              months[n.month - 1], n.promoters, n.neutrals, n.detractors,
              n.score >= 0 ? `+${n.score}` : String(n.score),
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            margin: { left: W / 2 + 4, right: 14 },
            tableWidth: W / 2 - 18,
          })
          finalY2 = (doc as any).lastAutoTable.finalY
        }

        y = Math.max(finalY1, finalY2) + 8
        y = checkPageBreak(y)
      }
    }

    // ─── CUSTOS DE RH ────────────────────────────────────────────────────────
    const hasCosts = data.units.some((u: any) => u.payrollHistory.length > 0 || u.hiringCostHistory.length > 0)
    if (hasCosts) {
      y = addPageHeader()

      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('CUSTOS DE RH — HISTÓRICO MENSAL POR UNIDADE', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 80, 1, 'F')
      y += 10

      for (const unitData of data.units) {
        const hasPayroll = unitData.payrollHistory.length > 0
        const hasHiring  = unitData.hiringCostHistory.length > 0
        if (!hasPayroll && !hasHiring) continue

        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...PRIMARY)
        doc.text(`▸ ${unitData.unit.name}`, 14, y)
        y += 5

        let finalY1 = y
        let finalY2 = y

        if (hasPayroll) {
          autoTable(doc, {
            startY: y,
            head: [['Mês', 'Folha Total', 'Colab.', 'Custo/Colab.']],
            body: unitData.payrollHistory.map((p: any) => [
              months[p.month - 1], fmtBRL(p.totalPayroll), p.totalEmployees, fmtBRL(p.costPerEmployee),
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            margin: { left: 14, right: hasHiring ? W / 2 + 4 : 14 },
            tableWidth: hasHiring ? W / 2 - 18 : undefined,
          })
          finalY1 = (doc as any).lastAutoTable.finalY
        }

        if (hasHiring) {
          autoTable(doc, {
            startY: y,
            head: [['Mês', 'Custo Total', 'Contrat.', 'Custo/Contrat.']],
            body: unitData.hiringCostHistory.map((h: any) => [
              months[h.month - 1], fmtBRL(h.totalCost), h.totalHires,
              h.totalHires > 0 ? fmtBRL(h.costPerHire) : '—',
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            margin: { left: hasPayroll ? W / 2 + 4 : 14, right: 14 },
            tableWidth: hasPayroll ? W / 2 - 18 : undefined,
          })
          finalY2 = (doc as any).lastAutoTable.finalY
        }

        y = Math.max(finalY1, finalY2) + 8
        y = checkPageBreak(y)
      }
    }

    // ─── TEMPO DE EMPRESA & TREINAMENTO ──────────────────────────────────────
    const tenureRows: string[][] = []
    for (const unitData of data.units) {
      if (!unitData.tenureLatest) continue
      const t = unitData.tenureLatest
      tenureRows.push([
        unitData.unit.name,
        String(t.ate1ano), String(t.de1a3), String(t.de3a5), String(t.de5a10), String(t.acima10), String(t.total),
      ])
    }
    const hasTraining = data.units.some((u: any) => u.trainingHistory.length > 0)
    const hasTenureOrTraining = tenureRows.length > 0 || hasTraining

    if (hasTenureOrTraining) {
      y = addPageHeader()

      doc.setTextColor(...TEXT_DARK)
      doc.setFontSize(12)
      doc.setFont('helvetica', 'bold')
      doc.text('TEMPO DE EMPRESA & TREINAMENTO E DESENVOLVIMENTO', 14, y)
      doc.setFillColor(...PRIMARY)
      doc.rect(14, y + 2, 100, 1, 'F')
      y += 10

      if (tenureRows.length > 0) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT_DARK)
        doc.text('Distribuição por Tempo de Empresa (mês mais recente)', 14, y)
        y += 5

        autoTable(doc, {
          startY: y,
          head: [['Unidade', 'Até 1 ano', '1 a 3 anos', '3 a 5 anos', '5 a 10 anos', 'Acima 10 anos', 'Total']],
          body: tenureRows,
          styles: { fontSize: 8, cellPadding: 2.5 },
          headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
          alternateRowStyles: { fillColor: [248, 250, 251] },
          margin: { left: 14, right: 14 },
        })
        y = (doc as any).lastAutoTable.finalY + 10
      }

      y = checkPageBreak(y, 30)

      if (hasTraining) {
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(...TEXT_DARK)
        doc.text('Treinamento e Desenvolvimento — Histórico Mensal por Unidade', 14, y)
        y += 5

        for (const unitData of data.units) {
          if (unitData.trainingHistory.length === 0) continue

      doc.setFontSize(9)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...PRIMARY)
      doc.text(`▸ ${unitData.unit.name}`, 14, y)
      y += 4

          autoTable(doc, {
            startY: y,
            head: [['Mês', 'Horas Totais', 'Participantes', 'Colab.', 'Média h/colab.', 'Taxa Participação']],
            body: unitData.trainingHistory.map((t: any) => [
              months[t.month - 1], t.totalHours, t.totalParticipants, t.totalEmployees,
              `${t.avgHours}h`, `${t.participationRate}%`,
            ]),
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: PRIMARY, textColor: WHITE, fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            margin: { left: 14, right: 14 },
          })

          y = (doc as any).lastAutoTable.finalY + 8
          y = checkPageBreak(y)
        }
      }
    }

    // ─── RODAPÉ EM TODAS AS PÁGINAS ──────────────────────────────────────────
    const totalPages = (doc as any).internal.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      doc.setFillColor(248, 250, 251)
      doc.rect(0, H - 8, W, 8, 'F')
      doc.setFontSize(7)
      doc.setTextColor(...TEXT_GRAY)
      doc.setFont('helvetica', 'normal')
      doc.text('BHCL — Documento confidencial. Uso interno restrito.', 14, H - 3)
      doc.text(`Página ${i} de ${totalPages}`, W - 14, H - 3, { align: 'right' })
    }

    doc.save(`BHCL_Relatorio_Executivo_${data.year}.pdf`)
  }

  const columns = getColumns()

  const unitOptions = units.map((u) => ({ value: u.id, label: u.name }))
  const currentUnitName = units.find((u) => u.id === filterUnit)?.name ?? 'Todas as unidades'

  return (
    <>
      <Header title="Relatórios" subtitle="Exportação e visualização consolidada de indicadores" />
      <div className="p-6 space-y-5">

        {/* Banner de restrição para analista */}
        {!isAdmin && analystUnitId && (
          <div className="flex items-center gap-3 px-4 py-3 bg-[#15AFA4]/8 border border-[#15AFA4]/20 rounded-xl">
            <Building2 className="w-4 h-4 text-[#15AFA4] flex-shrink-0" />
            <p className="text-sm text-[#15AFA4] font-medium">
              Visualizando dados da unidade: <strong>{currentUnitName}</strong>
            </p>
          </div>
        )}

        {/* Filtros */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as ReportType)}
                options={reportOptions}
                className="w-48"
              />
              <Select
                value={String(filterYear)}
                onChange={(e) => setFilterYear(Number(e.target.value))}
                options={years.map((y) => ({ value: String(y), label: String(y) }))}
                className="w-28"
              />
              <Select
                value={String(filterMonth)}
                onChange={(e) => setFilterMonth(Number(e.target.value))}
                options={monthOptions}
                className="w-44"
              />

              {/* Seletor de unidade: admin vê todas, analista vê apenas a sua (bloqueado) */}
              {isAdmin ? (
                <Select
                  value={filterUnit}
                  onChange={(e) => setFilterUnit(e.target.value)}
                  options={unitOptions}
                  placeholder="Todas as unidades"
                  className="w-48"
                />
              ) : (
                <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-gray-100 bg-gray-50 text-sm text-gray-500">
                  <Building2 className="w-4 h-4 text-gray-400" />
                  <span>{currentUnitName}</span>
                </div>
              )}

              <div className="ml-auto flex gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  icon={isExporting === 'excel' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileSpreadsheet className="w-4 h-4 text-green-600" />}
                  onClick={exportExcel}
                  disabled={tableData.length === 0}
                >
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={isExporting === 'pdf' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4 text-red-500" />}
                  onClick={exportPDF}
                  disabled={tableData.length === 0}
                >
                  PDF
                </Button>

                {/* Relatório Executivo — somente admin */}
                {isAdmin && (
                  <Button
                    size="sm"
                    icon={<Crown className="w-4 h-4" />}
                    onClick={() => setExecModalOpen(true)}
                    style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}
                  >
                    Relatório Executivo
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de dados */}
        <Card>
          <CardHeader>
            <CardTitle>
              {reportOptions.find((r) => r.value === reportType)?.label} — {filterYear}
              {filterMonth > 0 && ` / ${MONTHS_PT[filterMonth - 1]}`}
            </CardTitle>
            <Badge variant="secondary">{tableData.length} registro{tableData.length !== 1 ? 's' : ''}</Badge>
          </CardHeader>
          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 animate-spin text-[#15AFA4] mx-auto" />
                <p className="text-sm text-gray-500 mt-2">Carregando dados...</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-y border-gray-100">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.key} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {tableData.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length} className="px-4 py-10 text-center text-gray-400">
                        Nenhum dado encontrado para os filtros selecionados
                      </td>
                    </tr>
                  ) : (
                    tableData.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50/50">
                        {columns.map((col) => (
                          <td key={col.key} className="px-4 py-3 text-gray-700">
                            {getCellValue(row, col)}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

      {/* Modal Relatório Executivo */}
      <Modal
        open={execModalOpen}
        onClose={() => setExecModalOpen(false)}
        title="Relatório Executivo BHCL"
        size="sm"
      >
        <div className="p-6 space-y-5">
          {/* Preview */}
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <div className="h-16 flex items-center px-5 gap-3"
              style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
              <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-white font-bold text-sm leading-none">BHCL</p>
                <p className="text-white/70 text-xs mt-0.5">Relatório Executivo de Gestão de Pessoas</p>
              </div>
            </div>
            <div className="p-4 bg-gray-50 space-y-2">
              {['Sumário Executivo com KPIs', 'Visão geral por unidade', 'PCD — Evolução semanal', 'Turnover histórico', 'Absenteísmo histórico', 'Headcount por cargo', 'Engajamento & NPS histórico', 'Custos de RH e contratação', 'Tempo de empresa & treinamento'].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-gray-600">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#15AFA4]" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <Select
            label="Ano de referência"
            value={String(execYear)}
            onChange={(e) => setExecYear(Number(e.target.value))}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />

          <p className="text-xs text-gray-500">
            O PDF será gerado com todas as unidades, indicadores consolidados e histórico mensal, formatado para apresentação executiva.
          </p>

          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => setExecModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              className="flex-1"
              icon={isExporting === 'executive' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              isLoading={isExporting === 'executive'}
              onClick={exportExecutivePDF}
            >
              Gerar PDF
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
