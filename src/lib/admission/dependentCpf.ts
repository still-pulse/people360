import { decryptAdmissionValue, hashSensitive, isValidCpf } from './security'

/** Recupera somente CPFs cuja máscara e hash correspondem exatamente aos dados cadastrados. */
export function resolveDependentCpf(dependent: { cpfEncrypted?: unknown; cpfMasked: string | null; cpfHash: string | null }): string {
  const decrypted = decryptAdmissionValue(dependent.cpfEncrypted)
  if (typeof decrypted === 'string' && isValidCpf(decrypted)) return decrypted.replace(/\D/g, '')
  const match = /^\*{3}\.(\d{3})\.(\d{3})-\*{2}$/.exec(dependent.cpfMasked || '')
  if (!match || !dependent.cpfHash) return ''
  const digit = (base: string) => {
    const sum = [...base].reduce((total, value, index) => total + Number(value) * (base.length + 1 - index), 0)
    const rest = (sum * 10) % 11
    return rest === 10 ? '0' : String(rest)
  }
  for (let prefix = 0; prefix < 1000; prefix++) {
    const base = String(prefix).padStart(3, '0') + match[1] + match[2]
    const first = base + digit(base)
    const cpf = first + digit(first)
    if (isValidCpf(cpf) && hashSensitive(cpf) === dependent.cpfHash) return cpf
  }
  return ''
}
