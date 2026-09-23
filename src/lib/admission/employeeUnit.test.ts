import { describe, expect, it } from 'vitest'
import { resolveEmployeeUnit } from '../erpnextEmployeeUnit'

const units = [
  { id: 'rene', name: 'TS - PSI Rene Aprigio ' },
  { id: 'cumbica', name: 'GRU - UPA Cumbica' },
  { id: 'sede', name: 'Núcleo Alphaville' },
]

describe('unidade do colaborador no ERPNext', () => {
  it('usa local de trabalho em vez da empresa matriz', () => {
    expect(resolveEmployeeUnit(units, 'MATRIZ - Beneficência Hospitalar de Cesário Lange', 'UPA Cumbica')?.id).toBe('cumbica')
    expect(resolveEmployeeUnit(units, 'MATRIZ - Beneficência Hospitalar de Cesário Lange', 'Sede - Alphaville Barueri')?.id).toBe('sede')
  })
  it('reconhece PSI René e diferenças de acentos e espaços', () => {
    expect(resolveEmployeeUnit(units, null, ' PSI René ')?.id).toBe('rene')
    expect(resolveEmployeeUnit(units, 'PSI RENÉ APRÍGIO - Beneficência Hospitalar de Cesário Lange')?.id).toBe('rene')
  })
  it('não escolhe uma unidade arbitrária se o local é desconhecido ou ambíguo', () => {
    expect(resolveEmployeeUnit(units, 'PSI RENÉ APRÍGIO', 'Desconhecido')).toBeNull()
    expect(resolveEmployeeUnit([...units, { id: 'outra', name: 'UPA Cumbica' }], null, 'UPA Cumbica')).toBeNull()
    expect(resolveEmployeeUnit(units, '')).toBeNull()
  })
})

describe('tableFieldText', async () => {
  const { tableFieldText } = await import('../erpnextEmployees')
  it('converte linhas de Table MultiSelect em texto', () => {
    expect(tableFieldText([])).toBeNull()
    expect(tableFieldText([{ name: 'x1', idx: 1, parent: 'HR-EMP-1', doctype: 'Tipo Deficiencia Item', tipo_de_deficiencia: 'Física' }, { name: 'x2', tipo_de_deficiencia: 'Visual' }])).toBe('Física, Visual')
    expect(tableFieldText('Auditiva')).toBe('Auditiva')
    expect(tableFieldText(null)).toBeNull()
  })
})
