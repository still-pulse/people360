'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  User, Mail, Phone, Briefcase, FileText, Camera, Trash2,
  Lock, Eye, EyeOff, CheckCircle2, AlertCircle, Loader2,
  Shield, Building2, Calendar, ShieldCheck, ShieldOff, ScanLine,
} from 'lucide-react'

interface ProfileData {
  id: string
  name: string
  email: string
  role: string
  phone: string | null
  jobTitle: string | null
  bio: string | null
  avatarUrl: string | null
  createdAt: string
  unit: { id: string; name: string; color: string } | null
}

function Avatar({ src, name, size = 80 }: { src?: string | null; name: string; size?: number }) {
  const initials = name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, #15AFA4, #0d8c83)',
        fontSize: size * 0.3,
      }}
    >
      {initials}
    </div>
  )
}

function FeedbackBanner({ type, msg }: { type: 'success' | 'error'; msg: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium border ${
      type === 'success'
        ? 'bg-green-50 border-green-100 text-green-700'
        : 'bg-red-50 border-red-100 text-red-600'
    }`}>
      {type === 'success'
        ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
        : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
      {msg}
    </div>
  )
}

export default function PerfilPage() {
  const { data: session, update: updateSession } = useSession()

  const [profile, setProfile] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)

  // Dados pessoais
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [jobTitle, setJobTitle] = useState('')
  const [bio, setBio] = useState('')
  const [savingData, setSavingData] = useState(false)
  const [dataFeedback, setDataFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Avatar
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [removingAvatar, setRemovingAvatar] = useState(false)
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Senha
  // MFA
  const [mfaStatus, setMfaStatus]     = useState<{ enabled: boolean; qrDataUrl?: string; secret?: string } | null>(null)
  const [mfaLoading, setMfaLoading]   = useState(false)
  const [mfaCode, setMfaCode]         = useState('')
  const [disableCode, setDisableCode] = useState('')
  const [mfaFeedback, setMfaFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  useEffect(() => {
    fetch('/api/profile')
      .then((r) => r.json())
      .then((d: ProfileData) => {
        setProfile(d)
        setName(d.name || '')
        setPhone(d.phone || '')
        setJobTitle(d.jobTitle || '')
        setBio(d.bio || '')
      })
      .finally(() => setLoading(false))
  }, [])

  const currentAvatar = avatarPreview || profile?.avatarUrl || null

  function handleAvatarSelect(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setAvatarFeedback({ type: 'error', msg: 'Arquivo muito grande. Limite: 2 MB.' })
      return
    }
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) {
      setAvatarFeedback({ type: 'error', msg: 'Formato inválido. Use PNG, JPG ou WEBP.' })
      return
    }
    setAvatarFile(file)
    const reader = new FileReader()
    reader.onload = (e) => setAvatarPreview(e.target?.result as string)
    reader.readAsDataURL(file)
    setAvatarFeedback(null)
  }

  async function uploadAvatar() {
    if (!avatarFile) return
    setUploadingAvatar(true)
    const fd = new FormData()
    fd.append('avatar', avatarFile)
    const res = await fetch('/api/upload/avatar', { method: 'POST', body: fd })
    const data = await res.json()
    setUploadingAvatar(false)
    if (res.ok) {
      setProfile((p) => p ? { ...p, avatarUrl: data.avatarUrl } : p)
      setAvatarFile(null)
      setAvatarPreview(null)
      await updateSession()
      setAvatarFeedback({ type: 'success', msg: 'Foto atualizada com sucesso!' })
      setTimeout(() => setAvatarFeedback(null), 4000)
    } else {
      setAvatarFeedback({ type: 'error', msg: data.error ?? 'Erro ao enviar foto.' })
    }
  }

  async function removeAvatar() {
    if (!confirm('Remover a foto do perfil?')) return
    setRemovingAvatar(true)
    await fetch('/api/upload/avatar', { method: 'DELETE' })
    setRemovingAvatar(false)
    setProfile((p) => p ? { ...p, avatarUrl: null } : p)
    setAvatarFile(null)
    setAvatarPreview(null)
    await updateSession()
    setAvatarFeedback({ type: 'success', msg: 'Foto removida.' })
    setTimeout(() => setAvatarFeedback(null), 3000)
  }

  async function savePersonalData() {
    if (!name.trim()) {
      setDataFeedback({ type: 'error', msg: 'O nome não pode ser vazio.' })
      return
    }
    setSavingData(true)
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), phone: phone.trim(), jobTitle: jobTitle.trim(), bio: bio.trim() }),
    })
    const data = await res.json()
    setSavingData(false)
    if (res.ok) {
      setProfile((p) => p ? { ...p, ...data } : p)
      await updateSession()
      setDataFeedback({ type: 'success', msg: 'Dados atualizados com sucesso!' })
      setTimeout(() => setDataFeedback(null), 4000)
    } else {
      setDataFeedback({ type: 'error', msg: data.error ?? 'Erro ao salvar.' })
    }
  }

  function passwordStrength(pwd: string): { label: string; color: string; width: string } {
    if (!pwd) return { label: '', color: '', width: '0%' }
    if (pwd.length < 6) return { label: 'Fraca', color: 'bg-red-400', width: '25%' }
    const hasUpper = /[A-Z]/.test(pwd)
    const hasNumber = /\d/.test(pwd)
    const hasSpecial = /[^A-Za-z0-9]/.test(pwd)
    const score = [pwd.length >= 8, hasUpper, hasNumber, hasSpecial].filter(Boolean).length
    if (score <= 1) return { label: 'Fraca', color: 'bg-red-400', width: '25%' }
    if (score === 2) return { label: 'Regular', color: 'bg-yellow-400', width: '50%' }
    if (score === 3) return { label: 'Boa', color: 'bg-blue-400', width: '75%' }
    return { label: 'Forte', color: 'bg-green-400', width: '100%' }
  }

  async function changePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({ type: 'error', msg: 'Preencha todos os campos.' })
      return
    }
    if (newPassword.length < 6) {
      setPasswordFeedback({ type: 'error', msg: 'A nova senha deve ter pelo menos 6 caracteres.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', msg: 'As senhas não coincidem.' })
      return
    }
    setSavingPassword(true)
    const res = await fetch('/api/profile/password', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword, newPassword }),
    })
    const data = await res.json()
    setSavingPassword(false)
    if (res.ok) {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFeedback({ type: 'success', msg: 'Senha alterada com sucesso!' })
      setTimeout(() => setPasswordFeedback(null), 4000)
    } else {
      setPasswordFeedback({ type: 'error', msg: data.error ?? 'Erro ao alterar senha.' })
    }
  }

  const pwdStrength = passwordStrength(newPassword)

  async function loadMfa() {
    setMfaLoading(true)
    const res = await fetch('/api/profile/mfa')
    const data = await res.json()
    setMfaLoading(false)
    setMfaStatus(data)
  }

  async function enableMfa() {
    if (mfaCode.length !== 6) return
    setMfaLoading(true)
    const res = await fetch('/api/profile/mfa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: mfaCode }),
    })
    const data = await res.json()
    setMfaLoading(false)
    if (res.ok) {
      setMfaStatus({ enabled: true })
      setMfaCode('')
      await updateSession()
      setMfaFeedback({ type: 'success', msg: 'MFA ativado com sucesso! Exigido no próximo login.' })
      setTimeout(() => setMfaFeedback(null), 5000)
    } else {
      setMfaFeedback({ type: 'error', msg: data.error ?? 'Erro ao ativar MFA.' })
    }
  }

  async function disableMfa() {
    if (disableCode.length !== 6) return
    setMfaLoading(true)
    const res = await fetch('/api/profile/mfa', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: disableCode }),
    })
    const data = await res.json()
    setMfaLoading(false)
    if (res.ok) {
      setMfaStatus(null)
      setDisableCode('')
      await updateSession()
      setMfaFeedback({ type: 'success', msg: 'MFA desativado.' })
      setTimeout(() => setMfaFeedback(null), 4000)
    } else {
      setMfaFeedback({ type: 'error', msg: data.error ?? 'Erro ao desativar MFA.' })
    }
  }

  if (loading) {
    return (
      <>
        <Header title="Meu Perfil" subtitle="Gerencie suas informações pessoais e segurança" />
        <div className="p-6 flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-[#15AFA4]" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Meu Perfil" subtitle="Gerencie suas informações pessoais e segurança" />
      <div className="p-6 space-y-6 max-w-2xl">

        {/* Card de resumo */}
        <div className="flex items-center gap-5 px-6 py-5 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Avatar src={currentAvatar} name={profile?.name || 'U'} size={64} />
          <div className="flex-1 min-w-0">
            <p className="text-gray-900 font-bold text-lg leading-tight truncate">{profile?.name}</p>
            <p className="text-gray-500 text-sm mt-0.5">{profile?.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold"
                style={{ background: '#15AFA4' + '18', color: '#0d8c83' }}>
                <Shield className="w-3 h-3" />
                {profile?.role === 'ADMIN' ? 'Administrador' : profile?.role === 'GERENTE' ? 'Gerente' : profile?.role === 'SUPERINTENDENT' ? 'Superintendente' : profile?.role === 'JURIDICO' ? 'Jurídico' : 'Analista de RH'}
              </span>
              {profile?.unit && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-600">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: profile.unit.color }} />
                  {profile.unit.name}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500">
                <Calendar className="w-3 h-3" />
                Desde {new Date(profile?.createdAt ?? '').toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        {/* Foto de perfil */}
        <Card>
          <CardHeader>
            <CardTitle>Foto de Perfil</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {avatarFeedback && <FeedbackBanner {...avatarFeedback} />}

            <div className="flex items-center gap-6">
              <Avatar src={currentAvatar} name={profile?.name || 'U'} size={80} />
              <div className="flex-1 space-y-2">
                <p className="text-sm text-gray-500">
                  PNG, JPG ou WEBP com fundo preferencialmente neutro. Máximo 2 MB.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  {avatarFile ? (
                    <>
                      <Button
                        icon={<Camera className="w-4 h-4" />}
                        isLoading={uploadingAvatar}
                        onClick={uploadAvatar}
                        size="sm"
                      >
                        Salvar foto
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setAvatarFile(null); setAvatarPreview(null) }}
                      >
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      icon={<Camera className="w-4 h-4" />}
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {currentAvatar ? 'Trocar foto' : 'Adicionar foto'}
                    </Button>
                  )}
                  {profile?.avatarUrl && !avatarFile && (
                    <Button
                      variant="danger"
                      size="sm"
                      icon={removingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      onClick={removeAvatar}
                      disabled={removingAvatar}
                    >
                      Remover
                    </Button>
                  )}
                </div>
                {avatarFile && (
                  <p className="text-xs text-gray-400">{avatarFile.name} · {(avatarFile.size / 1024).toFixed(0)} KB</p>
                )}
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarSelect(f); e.target.value = '' }}
            />
          </CardContent>
        </Card>

        {/* Dados pessoais */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {dataFeedback && <FeedbackBanner {...dataFeedback} />}

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-gray-400" /> Nome completo
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-gray-400" /> E-mail
                </label>
                <Input value={profile?.email ?? ''} disabled className="bg-gray-50 text-gray-400 cursor-not-allowed" />
                <p className="text-xs text-gray-400">O e-mail só pode ser alterado por um administrador.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-gray-400" /> Telefone
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-gray-400" /> Cargo / Função
                </label>
                <Input
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Ex: Analista de RH Sênior"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-gray-400" /> Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Uma breve descrição sobre você..."
                  maxLength={280}
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 text-sm transition-all outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20 resize-none"
                />
                <p className="text-xs text-gray-400 text-right">{bio.length}/280</p>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button isLoading={savingData} onClick={savePersonalData}>
                Salvar alterações
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Segurança — Troca de senha */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" />
              Segurança
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {passwordFeedback && <FeedbackBanner {...passwordFeedback} />}

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Senha atual</label>
                <div className="relative">
                  <Input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Nova senha</label>
                <div className="relative">
                  <Input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {newPassword && (
                  <div className="space-y-1">
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pwdStrength.color}`}
                        style={{ width: pwdStrength.width }}
                      />
                    </div>
                    <p className="text-xs text-gray-400">Força: <span className="font-medium text-gray-600">{pwdStrength.label}</span></p>
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Confirmar nova senha</label>
                <div className="relative">
                  <Input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-red-500">As senhas não coincidem.</p>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button isLoading={savingPassword} onClick={changePassword}>
                Alterar senha
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MFA — apenas para admins/gerentes */}
        {(profile?.role === 'ADMIN' || profile?.role === 'GERENTE') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ScanLine className="w-4 h-4 text-gray-400" />
                Autenticação em Dois Fatores (MFA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {mfaFeedback && <FeedbackBanner {...mfaFeedback} />}

              {/* Status atual */}
              <div className="flex items-center gap-3 p-4 rounded-xl border border-gray-100 bg-gray-50">
                {mfaStatus?.enabled ? (
                  <>
                    <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center flex-shrink-0">
                      <ShieldCheck className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">MFA ativado</p>
                      <p className="text-xs text-gray-500">Seu login exige verificação em 2 etapas.</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <ShieldOff className="w-5 h-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">MFA desativado</p>
                      <p className="text-xs text-gray-500">Recomendado para contas de administrador.</p>
                    </div>
                  </>
                )}
              </div>

              {/* Botão para iniciar setup ou ver QR */}
              {!mfaStatus && (
                <Button variant="outline" icon={<ScanLine className="w-4 h-4" />} isLoading={mfaLoading} onClick={loadMfa}>
                  Configurar MFA
                </Button>
              )}

              {/* Setup: QR code + verificação */}
              {mfaStatus && !mfaStatus.enabled && mfaStatus.qrDataUrl && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">1. Escaneie o QR code com seu app autenticador</p>
                    <p className="text-xs text-gray-400">Google Authenticator, Authy, Microsoft Authenticator ou similar.</p>
                    <div className="flex justify-center p-4 bg-white border border-gray-100 rounded-xl w-fit">
                      <img src={mfaStatus.qrDataUrl} alt="QR Code MFA" className="w-48 h-48" />
                    </div>
                    <details className="text-xs text-gray-400">
                      <summary className="cursor-pointer hover:text-gray-600">Não consegue escanear? Ver código manual</summary>
                      <code className="block mt-2 p-2 bg-gray-50 rounded-lg break-all font-mono text-gray-600 select-all">
                        {mfaStatus.secret}
                      </code>
                    </details>
                  </div>

                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-700">2. Digite o código gerado para confirmar o setup</p>
                    <div className="flex gap-3">
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={mfaCode}
                        onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        placeholder="000000"
                        className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-mono text-xl tracking-[0.4em] text-center outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
                      />
                      <Button
                        onClick={enableMfa}
                        isLoading={mfaLoading}
                        disabled={mfaCode.length !== 6}
                        icon={<ShieldCheck className="w-4 h-4" />}
                      >
                        Ativar MFA
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Desativar MFA */}
              {mfaStatus?.enabled && (
                <div className="space-y-3 pt-1 border-t border-gray-100">
                  <p className="text-sm font-medium text-gray-700">Desativar MFA</p>
                  <p className="text-xs text-gray-400">Confirme com um código atual do seu app para desativar.</p>
                  <div className="flex gap-3">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={disableCode}
                      onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      className="flex-1 px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 font-mono text-xl tracking-[0.4em] text-center outline-none focus:border-[#15AFA4] focus:ring-2 focus:ring-[#15AFA4]/20"
                    />
                    <Button
                      variant="danger"
                      onClick={disableMfa}
                      isLoading={mfaLoading}
                      disabled={disableCode.length !== 6}
                      icon={<ShieldOff className="w-4 h-4" />}
                    >
                      Desativar
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      </div>
    </>
  )
}
