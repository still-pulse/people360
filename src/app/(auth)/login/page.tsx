'use client'

import { useState, useEffect, useRef } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  BarChart3, Users, Calendar, CheckSquare, TrendingUp,
  Eye, EyeOff, Loader2, Building2, ShieldCheck, ArrowLeft,
  AlertTriangle,
} from 'lucide-react'

const features = [
  { icon: TrendingUp,   label: 'Indicadores Estratégicos de RH' },
  { icon: Users,        label: 'Headcount e Dimensionamento' },
  { icon: Calendar,     label: 'Calendário Operacional' },
  { icon: CheckSquare,  label: 'Gestão de Tarefas' },
  { icon: BarChart3,    label: 'Dashboards em Tempo Real' },
]

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [email, setEmail]               = useState('')
  const [password, setPassword]         = useState('')
  const [totp, setTotp]                 = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading]       = useState(false)
  const [error, setError]               = useState('')
  const [step, setStep]                 = useState<'credentials' | 'mfa'>('credentials')
  const [rateLimitMsg, setRateLimitMsg] = useState('')

  const [logoUrl, setLogoUrl]           = useState<string | null>(null)
  const [companyName, setCompanyName]   = useState('People 360')

  const totpRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then((s) => {
        if (s.logoUrl)      setLogoUrl(s.logoUrl)
        if (s.companyName)  setCompanyName(s.companyName)
      })
      .catch(() => {})
  }, [])

  // Detecta erros vindos do query param (redirect do NextAuth)
  useEffect(() => {
    const err = searchParams.get('error')
    if (err === 'MFA_REQUIRED') {
      setStep('mfa')
      setTimeout(() => totpRef.current?.focus(), 100)
    } else if (err?.startsWith('RATE_LIMIT:')) {
      const mins = err.split(':')[1]
      setRateLimitMsg(`Muitas tentativas. Tente novamente em ${mins} minuto${Number(mins) > 1 ? 's' : ''}.`)
    } else if (err === 'MFA_INVALID') {
      setStep('mfa')
      setError('Código inválido. Verifique seu app autenticador.')
    } else if (err === 'CredentialsSignin') {
      setError('E-mail ou senha inválidos.')
    }
  }, [searchParams])

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setRateLimitMsg('')
    setIsLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      totp: '',
      redirect: false,
    })

    setIsLoading(false)

    if (!result?.error) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    if (result.error === 'MFA_REQUIRED') {
      setStep('mfa')
      setTimeout(() => totpRef.current?.focus(), 100)
    } else if (result.error?.startsWith('RATE_LIMIT:')) {
      const mins = result.error.split(':')[1]
      setRateLimitMsg(`Muitas tentativas. Tente novamente em ${mins} minuto${Number(mins) > 1 ? 's' : ''}.`)
    } else {
      setError('E-mail ou senha inválidos. Verifique seus dados.')
    }
  }

  async function handleMfa(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    const result = await signIn('credentials', {
      email,
      password,
      totp,
      redirect: false,
    })

    setIsLoading(false)

    if (!result?.error) {
      router.push('/dashboard')
      router.refresh()
      return
    }

    if (result.error === 'MFA_INVALID') {
      setError('Código inválido. Tente novamente.')
      setTotp('')
      totpRef.current?.focus()
    } else if (result.error?.startsWith('RATE_LIMIT:')) {
      const mins = result.error.split(':')[1]
      setRateLimitMsg(`Muitas tentativas. Tente novamente em ${mins} minuto${Number(mins) > 1 ? 's' : ''}.`)
      setStep('credentials')
    } else {
      setError('Erro de autenticação. Tente novamente.')
    }
  }

  // Auto-submit quando 6 dígitos inseridos no campo TOTP
  function handleTotpChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, 6)
    setTotp(digits)
  }

  useEffect(() => {
    if (totp.length === 6 && step === 'mfa') {
      handleMfa({ preventDefault: () => {} } as React.FormEvent)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totp])

  return (
    <div className="min-h-screen flex">
      {/* Painel esquerdo — banner */}
      <div
        className="hidden lg:flex lg:w-[60%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0d8c83 0%, #15AFA4 45%, #1dd4c8 100%)' }}
      >
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full opacity-10 -translate-y-1/2 translate-x-1/3"
          style={{ background: 'radial-gradient(circle, white, transparent)' }} />
        <div className="absolute bottom-0 left-0 w-80 h-80 rounded-full opacity-10 translate-y-1/3 -translate-x-1/4"
          style={{ background: 'radial-gradient(circle, white, transparent)' }} />

        <div className="relative z-10 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="max-h-32 max-w-[380px] object-contain brightness-0 invert" />
          ) : (
            <>
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className="text-white font-bold text-xl tracking-wide">{companyName}</span>
            </>
          )}
        </div>

        <div className="relative z-10 space-y-6">
          <div className="space-y-3">
            <h1 className="text-white font-bold leading-tight" style={{ fontSize: 'clamp(1.8rem, 3vw, 2.75rem)' }}>
              Transforme dados em<br />decisões estratégicas.
            </h1>
            <p className="text-white/80 text-base leading-relaxed max-w-md">
              Acompanhe indicadores de RH, headcount, turnover, absenteísmo, metas
              legais e desempenho das unidades em uma única plataforma.
            </p>
          </div>
          <div className="space-y-3">
            {features.map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/15 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/90 font-medium text-sm">{label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/50 text-xs">
            © {new Date().getFullYear()} People 360 — Plataforma de Gestão Estratégica de Pessoas
          </p>
        </div>
      </div>

      {/* Painel direito — autenticação */}
      <div className="flex-1 lg:w-[40%] flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm space-y-8">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 justify-center">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="max-h-24 max-w-[300px] object-contain" />
            ) : (
              <>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <span className="font-bold text-xl text-gray-800">{companyName}</span>
              </>
            )}
          </div>

          {/* Cabeçalho */}
          <div className="space-y-1">
            <div className="hidden lg:flex items-center gap-2 mb-6">
              {logoUrl ? (
                <img src={logoUrl} alt={companyName} className="max-h-24 max-w-[300px] object-contain" />
              ) : (
                <>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <span className="font-bold text-xl text-gray-800">{companyName}</span>
                </>
              )}
            </div>

            {step === 'credentials' ? (
              <>
                <h2 className="text-2xl font-bold text-gray-900">Bem-vindo de volta</h2>
                <p className="text-gray-500 text-sm">Acesse sua conta para continuar</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">Verificação em 2 etapas</h2>
                </div>
                <p className="text-gray-500 text-sm">
                  Abra seu app autenticador e insira o código de 6 dígitos.
                </p>
              </>
            )}
          </div>

          {/* Rate limit */}
          {rateLimitMsg && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100">
              <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-amber-700 font-medium">{rateLimitMsg}</p>
            </div>
          )}

          {/* STEP 1 — Credenciais */}
          {step === 'credentials' && (
            <form onSubmit={handleCredentials} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@bhcl.com.br"
                  required
                  disabled={!!rateLimitMsg}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 focus:bg-white transition-all disabled:opacity-50"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Senha</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={!!rateLimitMsg}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 text-sm outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 focus:bg-white transition-all pr-11 disabled:opacity-50"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
              )}

              <button type="submit" disabled={isLoading || !!rateLimitMsg}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</> : 'Continuar'}
              </button>

              <div className="text-center">
                <button type="button" className="text-sm font-medium transition-colors" style={{ color: '#15AFA4' }}
                  onClick={() => alert('Entre em contato com o administrador do sistema para redefinir sua senha.')}>
                  Esqueceu a senha?
                </button>
              </div>
            </form>
          )}

          {/* STEP 2 — MFA */}
          {step === 'mfa' && (
            <form onSubmit={handleMfa} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Código de 6 dígitos</label>
                <input
                  ref={totpRef}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totp}
                  onChange={(e) => handleTotpChange(e.target.value)}
                  placeholder="000000"
                  autoComplete="one-time-code"
                  className="w-full px-4 py-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-300 text-3xl font-mono tracking-[0.5em] text-center outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 focus:bg-white transition-all"
                />
                <p className="text-xs text-gray-400 text-center">O código expira a cada 30 segundos</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-sm">{error}</div>
              )}

              <button type="submit" disabled={isLoading || totp.length < 6}
                className="w-full py-3 rounded-xl text-white font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #15AFA4, #0d8c83)' }}>
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Verificando...</> : 'Verificar'}
              </button>

              <button type="button" onClick={() => { setStep('credentials'); setTotp(''); setError('') }}
                className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Voltar ao login
              </button>
            </form>
          )}

          <p className="text-center text-xs text-gray-400">Acesso restrito a colaboradores autorizados</p>
        </div>
      </div>
    </div>
  )
}
