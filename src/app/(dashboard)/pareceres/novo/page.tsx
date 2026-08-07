'use client'

import { Header } from '@/components/layout/Header'
import { ParecerForm } from '@/components/pareceres/ParecerForm'

export default function NovoParecerPage() {
  return (
    <>
      <Header title="Novo Parecer" subtitle="Parecer de Recrutamento e Seleção" />
      <div className="p-6">
        <ParecerForm mode="create" />
      </div>
    </>
  )
}
