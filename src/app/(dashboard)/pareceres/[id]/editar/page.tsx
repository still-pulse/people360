'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import { ParecerForm } from '@/components/pareceres/ParecerForm'
import { Button } from '@/components/ui/button'
import type { ParecerData } from '@/types'
import { ArrowLeft } from 'lucide-react'

export default function EditarParecerPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()
  const [parecer, setParecer] = useState<ParecerData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/pareceres/${id}`)
      .then(async (r) => {
        if (!r.ok) throw new Error((await r.json()).error || 'Erro')
        return r.json()
      })
      .then(setParecer)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <>
        <Header title="Editar Parecer" subtitle="Carregando..." />
        <div className="p-6 text-sm text-gray-400">Carregando...</div>
      </>
    )
  }

  if (error || !parecer) {
    return (
      <>
        <Header title="Editar Parecer" subtitle="Erro" />
        <div className="p-6">
          <p className="text-sm text-red-600 mb-4">{error || 'Não encontrado'}</p>
          <Button variant="outline" icon={<ArrowLeft className="w-4 h-4" />} onClick={() => router.push('/pareceres')}>
            Voltar
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Editar Parecer" subtitle={parecer.candidatoNome} />
      <div className="p-6">
        <ParecerForm mode="edit" initial={parecer} />
      </div>
    </>
  )
}
