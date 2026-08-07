'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { ShieldCheck, Eye, EyeOff, Loader2, KeyRound } from 'lucide-react'

function passwordStrength(pwd: string): { label: string; color: string; width: string } {
  if (!pwd) return { label: '', color: '', width: '0%' }
  if (pwd.length < 6) return { label: 'Fraca', color: 'bg-red-400', width: '25%' }
  const score = [pwd.length >= 8, /[A-Z]/.test(pwd), /\d/.test(pwd), /[^A-Za-z0-9]/.test(pwd)].filter(Boolean).length
  if (score <= 1) return { label: 'Fraca',   color: 'bg-red-400',    width: '25%' }
  if (score === 2) return { label: 'Regular', color: 'bg-yellow-400', width: '50%' }
  if (score === 3) return { label: 'Boa',     color: 'bg-blue-400',   width: '75%' }
  return               { label: 'Forte',   color: 'bg-green-400',  width: '100%' }
}

export default function TrocarSenhaPage() {
  const { data: session, update } = useSession()

  const [newPassword, setNew]         = useState('')
  const [confirmPassword, setConfirm] = useState('')
  const [showNew, setShowNew]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState('')

  const pwStr = passwordStrength(newPassword)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const res = await fetch('/api/profile/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: null, newPassword, skipCurrentCheck: true }),
    })
    const data = await res.json()
    setLoading(false)

    if (res.ok) {
      await update()
      window.location.href = '/dashboard'
    } else {
      setError(data.error ?? 'Erro ao alterar senha.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-7">

        {/* Ícone + título */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Defina sua senha</h1>
            <p className="text-sm text-gray-500 mt-1">
              Bem-vindo(a), <strong>{session?.user?.name?.split(' ')[0]}</strong>!
              Por segurança, crie uma senha pessoal antes de continuar.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Nova senha */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Nova senha</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNew(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 focus:bg-white pr-11 transition-all"
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="space-y-1">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pwStr.color}`} style={{ width: pwStr.width }} />
                </div>
                <p className="text-xs text-gray-400">Força: <span className="font-medium text-gray-600">{pwStr.label}</span></p>
              </div>
            )}
          </div>

          {/* Confirmar */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Confirmar senha</label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 focus:bg-white pr-11 transition-all"
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500">As senhas não coincidem.</p>
            )}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
          )}

          <button
            type="submit"
            disabled={loading || !newPassword || !confirmPassword}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Salvando...</>
              : <><ShieldCheck className="w-4 h-4" /> Definir senha e acessar</>}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400">
          Esta senha substitui a temporária fornecida pelo administrador.
        </p>
      </div>
    </div>
  )
}
