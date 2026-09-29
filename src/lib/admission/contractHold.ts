import { prisma } from '@/lib/prisma'

// Unidades com a assinatura de contrato EM ESPERA (ex.: aguardando o contrato de gestão com a prefeitura).
// Nelas o candidato envia e o RH aprova documentos normalmente, mas o contrato e os termos não são gerados
// nem assinados — e, sem assinatura, nada segue para o ERPNext/eSocial. Configurado em
// Admissão Digital → Configurações (somente ADMIN).

const SETTING_KEY = 'admissionContractHoldUnitIds'

export const CONTRACT_HOLD_MESSAGE = 'Seus documentos foram recebidos. A assinatura do contrato desta unidade ainda não foi liberada: o RH vai avisar você assim que estiver disponível.'

export async function contractHoldUnitIds(): Promise<string[]> {
  const row = await prisma.systemSettings.findUnique({ where: { key: SETTING_KEY } })
  try {
    const value = JSON.parse(row?.value || '[]')
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export async function isContractOnHold(unitId: string | null | undefined) {
  if (!unitId) return false
  return (await contractHoldUnitIds()).includes(unitId)
}

export async function setContractHoldUnitIds(unitIds: string[]) {
  const value = JSON.stringify(Array.from(new Set(unitIds)))
  await prisma.systemSettings.upsert({ where: { key: SETTING_KEY }, update: { value }, create: { key: SETTING_KEY, value } })
}
