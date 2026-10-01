import { describe, expect, it } from 'vitest'
import { erpnextErrorMessage } from './erpnextClient'

describe('mensagens de erro do ERPNext', () => {
  it('exibe os campos obrigatórios informados pelo Frappe', () => {
    const data = {
      exc_type: 'MandatoryError',
      _server_messages: JSON.stringify([JSON.stringify({ message: 'Valor ausente para Employee: Local de Trabalho, Salário Base' })]),
    }
    expect(erpnextErrorMessage(data, 417)).toBe('MandatoryError: Valor ausente para Employee: Local de Trabalho, Salário Base')
  })

  it('mantém o tipo do erro quando o ERPNext não envia detalhes', () => {
    expect(erpnextErrorMessage({ exc_type: 'MandatoryError' }, 417)).toBe('MandatoryError')
  })
})
