import JSZip from 'jszip'

type Item = { id: string; protocol: string; candidateName: string }
const csv = (values: string[]) => values.map(value => `"${value.replace(/"/g, '""')}"`).join(';')

/** Uma requisição por admissão; o ZIP final é montado no navegador. */
export async function downloadDossierBatch(options: {
  dependentCorrection: boolean; unitId?: string; ids?: string[]
  onProgress: (done: number, total: number, name: string) => void
}, request: typeof fetch = fetch) {
  const endpoint = '/api/admissao-digital/admissoes/dossie-contabilidade/lote'
  const query = new URLSearchParams({ dependentCorrection: String(options.dependentCorrection) })
  if (options.unitId) query.set('unitId', options.unitId)
  const listing = await request(`${endpoint}?${query}`)
  if (!listing.ok) throw new Error('Não foi possível consultar as admissões para o lote.')
  const data = await listing.json() as { items: Item[] }
  const items = options.ids?.length ? data.items.filter(item => options.ids!.includes(item.id)) : data.items
  if (!items.length) throw new Error('Nenhuma admissão elegível foi encontrada para este lote.')
  const zip = new JSZip()
  const reports = [csv(['Colaborador', 'Protocolo', 'Status', 'Detalhes'])]
  let generated = 0, failed = 0
  for (const [index, item] of items.entries()) {
    options.onProgress(index, items.length, item.candidateName)
    try {
      const response = await request(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: [item.id], unitId: options.unitId, dependentCorrection: options.dependentCorrection }) })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || `HTTP ${response.status}${response.status === 524 || response.status === 504 ? ': tempo de espera excedido para esta admissão' : ''}`)
      }
      const part = await JSZip.loadAsync(await response.arrayBuffer())
      for (const file of Object.values(part.files)) {
        if (file.dir) continue
        if (file.name === 'relatorio.csv') {
          const report = (await file.async('string')).replace(/^\uFEFF/, '')
          reports.push(report.slice(report.indexOf('\n') + 1))
        } else zip.file(file.name, await file.async('uint8array'))
      }
      generated += Number(response.headers.get('x-dossiers-generated') || 1)
      failed += Number(response.headers.get('x-dossiers-failed') || 0)
    } catch (caught) {
      failed++
      reports.push(csv([item.candidateName, item.protocol, 'ERRO', caught instanceof Error ? caught.message : 'Falha na geração']))
    }
    options.onProgress(index + 1, items.length, '')
  }
  if (!generated) throw new Error('Nenhum dossiê foi gerado. ' + reports.slice(1, 4).join(' | '))
  zip.file('relatorio.csv', '\uFEFF' + reports.join('\r\n'))
  return { bytes: await zip.generateAsync({ type: 'uint8array', compression: 'STORE' }), generated, failed }
}
